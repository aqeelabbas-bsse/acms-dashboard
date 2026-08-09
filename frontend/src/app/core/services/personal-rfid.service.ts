import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.models';
import {
  BlockReasonOption, PersonalRfid, PersonalRfidQuery,
} from '../models/personal-rfid.models';

/**
 * Staff RFID cards. Separate from VisitorRfidService on purpose — see the note
 * on PersonalRfidController for why the two populations are never merged.
 */
@Injectable({ providedIn: 'root' })
export class PersonalRfidService {
  private readonly api = inject(ApiService);

  /** Uses getEnvelope because the grid needs `meta.total` for pagination. */
  list(q: PersonalRfidQuery = {}): Observable<ApiResponse<PersonalRfid[]>> {
    return this.api.getEnvelope<PersonalRfid[]>('/personal-rfid', {
      status: q.status && q.status !== 'all' ? q.status : undefined,
      search: q.search,
      page: q.page ?? 1,
      limit: q.limit ?? 25,
    });
  }

  blockReasons(): Observable<BlockReasonOption[]> {
    return this.api.get<BlockReasonOption[]>('/personal-rfid/block-reasons');
  }

  block(regId: number, category: string, reason: string): Observable<unknown> {
    return this.api.patch(`/personal-rfid/${regId}/block`, { category, reason });
  }

  reactivate(regId: number, reason: string): Observable<unknown> {
    return this.api.patch(`/personal-rfid/${regId}/reactivate`, { reason });
  }
}