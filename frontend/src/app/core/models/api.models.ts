/** Standard response envelope - matches the API Specification exactly. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string };
}

export interface KpiSummary {
  totalEmployees: number;
  activeCards: number;
  onSiteNow: number;
  pendingRequests: number;
}

/**
 * Matches the REAL shape of GET /v1/analytics/funnel - a daily time series
 * plus aggregate totals, not a flat { submitted, verified, printed } object
 * as originally assumed. Confirmed against the live API response.
 */
export interface FunnelPoint {
  date: string;
  submitted: number;
  verified: number;
  printed: number;
  conversionRate: number;
  bottleneckStage: string;
}

export interface FunnelStats {
  points: FunnelPoint[];
  totals: {
    submitted: number;
    verified: number;
    printed: number;
    overallConversionRate: number;
    avgProcessingHours: number;
  };
}

export type Role = 'Admin' | 'Security' | 'Printer' | 'Viewer';

export interface LoginResponse {
  token: string;
  role: Role | null;
  expiresIn: number;
}

/** ETL rows. Field casing is normalised defensively at the call site. */
export type EtlRow = Record<string, unknown>;

/* ═══════════════ Pagination ═══════════════ */

export interface PageMeta { page: number; total: number; }

export interface Paged<T> { items: T[]; page: number; total: number; }

/* ═══════════════ Employees ═══════════════ */

export interface EmployeeListItem {
  cnic: string;
  name: string | null;
  designation: string | null;
  isActive: boolean;
}

export interface EmployeeDetail {
  cnic: string;
  name: string | null;
  fatherName: string | null;
  serviceNo: string | null;
  designation: string | null;
  rank: string | null;
  email: string | null;
  contactNo: string | null;
  companyName: string | null;
  expiryDate: string | null;
  isActive: boolean;
}

export interface CreateEmployeeRequest {
  cnic: string;
  name: string;
  designation?: string;
  email?: string;
  contactNo?: string;
}

/* ═══════════════ Card requests ═══════════════ */

export type CardRequestStatus = 'submitted' | 'verified' | 'printed';

export interface CardRequest {
  crid: number;
  cnic: string | null;
  remarks: string | null;
  processDate: string | null;
  markedOn: string | null;
  printingDate: string | null;
  isVerified: boolean;
  isPrinted: boolean;
  printBy: string | null;
}

export interface CreateCardRequest { cnic: string; remarks?: string; }

/* ═══════════════ Visitors ═══════════════ */

export interface Visitor {
  id: number;
  cnic: string;
  name: string | null;
  designation: string | null;
  companyName: string | null;
  contactNo: string | null;
  entryDate: string | null;
  exitDate: string | null;
  cardSerialNumber: string | null;
}

export interface CreateVisitorRequest {
  cnic: string;
  name: string;
  companyName?: string;
  designation?: string;
  contactNo?: string;
  cardSerialNumber?: string;
}

/* ═══════════════ RFID ═══════════════ */

export interface VisitorRfid {
  smartCardNo: string;
  isActive: boolean;
  isBlocked: boolean;
  checkStatus: boolean;
  activeDate: string | null;
  blockedDate: string | null;
}

export interface BlockCardRequest { reason: string; }