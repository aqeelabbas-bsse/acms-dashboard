import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import {
  AgentAnswer, ChatMessage, SuggestionChip,
} from '../models/agent.models';

/** Fallback chips if GET /agent/suggestions is unavailable. Phrased to match
 *  what the schema can actually answer - nothing about gates, since GateId
 *  is still NULL until AccessLog is approved. */
const FALLBACK_CHIPS: SuggestionChip[] = [
  { label: 'Who is on site?',      question: 'How many visitors are currently on site?' },
  { label: 'Pending cards',        question: 'How many card requests are still awaiting verification?' },
  { label: 'Printed this month',   question: 'How many cards were printed in the last 30 days?' },
  { label: 'Blocked RFID',         question: 'Which RFID cards are currently blocked?' },
  { label: 'Busiest day',          question: 'Which day had the most visitor entries recently?' },
];

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly api = inject(ApiService);

  /* ---------- Panel visibility (shared by the orb, sidebar CTA, topbar) ---------- */

  private readonly _open = signal(false);
  readonly isOpen = this._open.asReadonly();

  open(): void { this._open.set(true); }
  close(): void { this._open.set(false); }
  toggle(): void { this._open.update(v => !v); }

  /* ---------- Conversation ---------- */

  private seq = 0;
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _busy = signal(false);

  readonly messages = this._messages.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly isEmpty = computed(() => this._messages().length === 0);

  readonly chips = signal<SuggestionChip[]>(FALLBACK_CHIPS);

  /** Loads server-provided chips; silently keeps the fallbacks on failure. */
  loadSuggestions(): void {
    this.api.get<unknown>('/agent/suggestions').subscribe({
      next: raw => {
        const chips = this.normaliseChips(raw);
        if (chips.length) this.chips.set(chips);
      },
      error: () => { /* fallbacks already in place */ },
    });
  }

  /**
   * The API may return string[] or {label,question}[] - tolerate both.
   * Labels are shown IN FULL - no truncation. The chip button wraps to a
   * second line rather than cutting text off with an ellipsis, since a
   * half-visible question ("How many employees are r...") reads as broken
   * UI, not as a deliberately short label.
   */
  private normaliseChips(raw: unknown): SuggestionChip[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item): SuggestionChip[] => {
      if (typeof item === 'string') {
        return [{ label: item, question: item }];
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const q = (o['question'] ?? o['text'] ?? o['prompt']) as string | undefined;
        if (typeof q === 'string') {
          const l = (o['label'] ?? o['title']) as string | undefined;
          return [{ label: l ?? q, question: q }];
        }
      }
      return [];
    });
  }

  clear(): void {
    this._messages.set([]);
  }

  ask(question: string): void {
    const q = question.trim();
    if (!q || this._busy()) return;

    this.pushMessage({
      id: `u${++this.seq}`, role: 'user', text: q, status: 'done', at: Date.now(),
    });

    const placeholderId = `a${++this.seq}`;
    this.pushMessage({
      id: placeholderId, role: 'agent', text: '', status: 'pending', at: Date.now(),
    });

    this._busy.set(true);

    this.api.post<AgentAnswer>('/agent/query', { question: q }).subscribe({
      next: res => {
        this.resolve(placeholderId, {
          text: res.answer,
          status: 'done',
          sql: res.generatedSql,
          rowCount: res.rowCount,
          elapsedMs: res.elapsedMs,
          rows: res.rows,
        });
        this._busy.set(false);
      },
      error: err => {
        const { text, status } = this.describeError(err);
        this.resolve(placeholderId, { text, status });
        this._busy.set(false);
      },
    });
  }

  /**
   * Turns backend failures into something a non-technical user can act on.
   * A raw 403 UNSAFE_QUERY dump would be useless to a Security officer.
   */
  private describeError(err: { status?: number; error?: { error?: { code?: string; message?: string } } }) {
    const code = err?.error?.error?.code;
    const msg = err?.error?.error?.message;

    if (code === 'UNSAFE_QUERY') {
      return {
        status: 'refused' as const,
        text: 'I can only read data, never change it. That question would have '
            + 'required writing to the database, so I stopped before running it. '
            + 'Try rephrasing it as a question about what the data shows.',
      };
    }
    if (err?.status === 429 || code === 'RATE_LIMITED') {
      return {
        status: 'error' as const,
        text: 'Too many questions in a short period. The assistant is limited to '
            + '20 per minute to stay inside the free-tier quota - give it a moment '
            + 'and try again.',
      };
    }
    if (err?.status === 401) {
      return {
        status: 'error' as const,
        text: 'Your session expired while I was working on that. Sign in again and '
            + 'ask me once more.',
      };
    }
    if (err?.status === 0) {
      return {
        status: 'error' as const,
        text: 'I could not reach the server. Check that the backend is running, '
            + 'then try again.',
      };
    }
    return {
      status: 'error' as const,
      text: msg ?? 'Something went wrong answering that. Try rephrasing the question.',
    };
  }

  private pushMessage(m: ChatMessage): void {
    this._messages.update(list => [...list, m]);
  }

  private resolve(id: string, patch: Partial<ChatMessage>): void {
    this._messages.update(list =>
      list.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }
}