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

export interface FunnelStats {
  submitted: number;
  verified: number;
  printed: number;
}

export type Role = 'Admin' | 'Security' | 'Printer' | 'Viewer';

export interface LoginResponse {
  token: string;
  role: Role | null;
  expiresIn: number;
}

/** ETL rows. Field casing is normalised defensively at the call site. */
export type EtlRow = Record<string, unknown>;