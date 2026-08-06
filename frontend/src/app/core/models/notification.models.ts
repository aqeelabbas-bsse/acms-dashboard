// =============================================================================
// src/app/core/models/notification.models.ts
// =============================================================================

import type { IconName } from '../../shared/ui/icon/icons';

export type NotificationTone = 'ok' | 'info' | 'warn' | 'danger' | 'muted';

export interface AcmsNotification {
  /** Stable dedupe key: type|subject|at. */
  id: string;
  type: string;
  title: string;
  detail: string | null;
  /** ISO timestamp from the server event. */
  at: string;
  tone: NotificationTone;
  icon: IconName;
  /** Where clicking it should take you, or null for non-navigable events. */
  route: string | null;
  read: boolean;
}

/**
 * Presentation rules per event type.
 *
 * ⚠️ VERIFY THE KEYS. These are the type strings the Phase 5 controllers and
 * the Phase 14 AdminController broadcast. If your Phase 5 code used different
 * wording (e.g. 'VisitorCheckIn' rather than 'VisitorCheckedIn'), fix it HERE
 * and nowhere else - unmapped types still render via the fallback below, they
 * just get a generic icon and no route.
 *
 * Quickest way to confirm: open the dashboard's live audit feed with the
 * browser console open and perform one of each action.
 */
export interface EventRule {
  label: (subject: string) => string;
  tone: NotificationTone;
  icon: IconName;
  route: string | null;
}

export const EVENT_RULES: Record<string, EventRule> = {
  // --- Card request workflow (Phase 5) ---
  CardRequested: {
    label: (s) => `Card request submitted for ${s}`,
    tone: 'info', icon: 'card', route: '/card-requests',
  },
  CardVerified: {
    label: (s) => `Card request verified for ${s}`,
    tone: 'ok', icon: 'shield', route: '/card-requests',
  },
  CardPrinted: {
    label: (s) => `Card printed for ${s}`,
    tone: 'ok', icon: 'card', route: '/card-requests',
  },

  // --- Visitor flow (Phase 5) ---
  VisitorCheckedIn: {
    label: (s) => `${s} checked in`,
    tone: 'info', icon: 'userCheck', route: '/visitors',
  },
  VisitorCheckedOut: {
    label: (s) => `${s} checked out`,
    tone: 'muted', icon: 'users', route: '/visitors',
  },

  // --- RFID (Phase 5) ---
  CardBlocked: {
    label: (s) => `RFID card ${s} blocked`,
    tone: 'danger', icon: 'shield', route: '/rfid',
  },

  // --- Account administration (Phase 14) ---
  UserCreated: {
    label: (s) => `Account created: ${s}`,
    tone: 'info', icon: 'users', route: '/admin',
  },
  UserRoleChanged: {
    label: (s) => `Role changed for ${s}`,
    tone: 'warn', icon: 'shield', route: '/admin',
  },
  UserActivated: {
    label: (s) => `Account reactivated: ${s}`,
    tone: 'ok', icon: 'userCheck', route: '/admin',
  },
  UserDeactivated: {
    label: (s) => `Account deactivated: ${s}`,
    tone: 'warn', icon: 'users', route: '/admin',
  },
};

/** Used for any event type not in EVENT_RULES, so nothing is ever silently dropped. */
export const FALLBACK_RULE: EventRule = {
  label: (s) => (s ? `Activity: ${s}` : 'System activity'),
  tone: 'muted', icon: 'bell', route: null,
};

/**
 * FR-RT-03: "scoped to the logged-in user's role".
 *
 * The point of scoping is signal, not secrecy - these events already stream to
 * every connected client over SignalR, and this is a client-side filter. If an
 * event genuinely must not reach a role, it has to be filtered server-side in
 * the hub, not here. Documented as a known limitation.
 */
export const ROLE_INTEREST: Record<string, string[] | '*'> = {
  // Admin sees the whole system, including account administration.
  Admin: '*',

  // Security verifies requests and cares about blocked cards and who is on site.
  Security: [
    'CardRequested', 'CardVerified', 'CardBlocked',
    'VisitorCheckedIn', 'VisitorCheckedOut',
  ],

  // Printer only needs to know when something becomes printable, and when it's done.
  Printer: ['CardVerified', 'CardPrinted'],

  // Viewer is read-only: operational activity, nothing administrative.
  Viewer: ['CardVerified', 'CardPrinted', 'VisitorCheckedIn', 'VisitorCheckedOut'],
};

export function isInterested(role: string | null | undefined, type: string): boolean {
  if (!role) return false;
  const interest = ROLE_INTEREST[role];
  if (!interest) return false;
  return interest === '*' || interest.includes(type);
}

/** Newest first, capped - see NotificationService for why 50. */
export const MAX_NOTIFICATIONS = 50;