/**
 * dbo.PersonalRFID — STAFF card-to-personnel mapping.
 *
 * Kept in its own model file rather than bolted onto api.models.ts's
 * `VisitorRfid`, because the two are genuinely different records. Sharing one
 * interface is what let the personal and visitor card populations blur together
 * in the UI.
 */
export interface PersonalRfid {
  regId: number;
  cnic: string | null;
  holderName: string | null;
  designation: string | null;
  smartCardNo: string | null;
  isActive: boolean;
  isDeactive: boolean;
  isBlocked: boolean;
  /** Category code, present only when isBlocked. */
  blockReason: string | null;
  /** 0 = escorted / restricted, 1 = full access. */
  fullAccess: number;
  activationDate: string | null;
  deactiveDate: string | null;
  actionDate: string | null;
  cardStatus: number | null;
  exportStatus: number | null;
}

export interface BlockReasonOption {
  code: string;
  label: string;
}

export type PersonalRfidStatus = 'all' | 'active' | 'blocked' | 'inactive';

export interface PersonalRfidQuery {
  status?: PersonalRfidStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Fallback labels, used only if GET /personal-rfid/block-reasons fails.
 * Must stay in sync with BlockReasons.Labels on the backend.
 */
export const BLOCK_REASON_LABELS: Record<string, string> = {
  LostOrStolen: 'Lost or stolen',
  SecurityIncident: 'Security incident',
  EmploymentEnded: 'Employment ended',
  Expired: 'Expired',
  Damaged: 'Damaged',
  PolicyViolation: 'Policy violation',
  Other: 'Other',
  Unspecified: 'Unspecified',
};