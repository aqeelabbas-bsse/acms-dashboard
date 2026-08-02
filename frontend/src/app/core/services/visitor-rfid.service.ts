import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { VisitorRfid } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class VisitorRfidService {
  private readonly api = inject(ApiService);

  list(blocked?: boolean): Observable<VisitorRfid[]> {
    return this.api.get<VisitorRfid[]>('/visitor-rfid', { blocked });
  }

  block(card: string, reason: string): Observable<VisitorRfid> {
    return this.api.patch<VisitorRfid>(
      `/visitor-rfid/${encodeURIComponent(card)}/block`, { reason });
  }
}