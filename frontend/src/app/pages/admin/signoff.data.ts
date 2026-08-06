// =============================================================================
// src/app/pages/admin/signoff.data.ts
// =============================================================================

export type PhaseStatus = 'done' | 'active' | 'pending';

export interface PhaseRow {
  /** Phase number from the Detailed Way Forward & Implementation Plan. */
  n: number;
  name: string;
  status: PhaseStatus;
  /** Milestone from the Project Report (1, 2 or 3). */
  milestone: 1 | 2 | 3;
  /** One line the supervisor can read without opening the plan. */
  note: string;
}

/** Shown on the page so nobody mistakes a manual file for live telemetry. */
export const SIGNOFF_AS_OF = '2026-08-04';

export const MILESTONE_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Database & Core API',
  2: 'Audit Log & Analytics',
  3: 'Admin Console & Sign-off',
};

export const PHASES: readonly PhaseRow[] = [
  { n: 0,  name: 'Environment & Tooling Setup',   status: 'done',    milestone: 1, note: '.NET SDK, Node/Angular CLI, SQL Server, SSMS, Git repo.' },
  { n: 1,  name: 'Database Setup',                status: 'done',    milestone: 1, note: 'All 5 supervisor-provided tables created and seeded.' },
  { n: 2,  name: 'Backend Foundation',            status: 'done',    milestone: 1, note: 'ASP.NET Core Web API, EF Core database-first scaffold, Serilog.' },
  { n: 3,  name: 'Authentication & Authorization',status: 'done',    milestone: 1, note: 'Identity + JWT, four roles seeded, login endpoint.' },
  { n: 4,  name: 'Core Backend APIs',             status: 'done',    milestone: 1, note: 'Employees, card requests, visitors, RFID. FluentValidation, DTO redaction.' },
  { n: 5,  name: 'Real-Time Layer',               status: 'done',    milestone: 1, note: 'SignalR AuditHub, JWT over WebSocket via query-string token.' },
  { n: 6,  name: 'ETL & Analytics Pipeline',      status: 'done',    milestone: 2, note: 'Quartz.NET job, three summary tables, 90-day historical backfill.' },
  { n: 7,  name: 'Natural-Language Query Agent',  status: 'done',    milestone: 2, note: 'Gemini text-to-SQL, SELECT-only login, multi-layer SQL safety validation.' },
  { n: 8,  name: 'Frontend Foundation',           status: 'done',    milestone: 1, note: 'Angular workspace, glass design system, light + dark themes, app shell.' },
  { n: 9,  name: 'Authentication UI',             status: 'done',    milestone: 1, note: 'Login page, auth guard, role guard, JWT interceptor, role-conditional UI.' },
  { n: 10, name: 'Core Feature UI',               status: 'done',    milestone: 1, note: 'Employees, profile, card requests, visitors, RFID screens.' },
  { n: 11, name: 'Design System & Accessibility', status: 'done',    milestone: 2, note: 'Six WCAG AA contrast failures fixed, focus trap, toast/confirm systems.' },
  { n: 12, name: 'Analytics & Real-Time UI',      status: 'done',    milestone: 2, note: 'Chart.js charts on ETL data, live audit feed, live occupancy counter.' },
  { n: 13, name: 'Natural-Language Agent UI',     status: 'done',    milestone: 2, note: 'Floating orb, slide-over chat panel, suggested-question chips.' },
  { n: 14, name: 'Admin Console',                 status: 'active',  milestone: 3, note: 'User management, role assignment, this sign-off view.' },
  { n: 15, name: 'Testing & Quality Assurance',   status: 'pending', milestone: 3, note: 'xUnit + WebApplicationFactory (backend), Jasmine/Karma (frontend).' },
  { n: 16, name: 'Security Hardening',            status: 'pending', milestone: 3, note: 'Remove demo credentials, rotate agent password, lock CORS, HSTS.' },
  { n: 17, name: 'Performance Optimization',      status: 'pending', milestone: 3, note: 'SQL indexes, lazy routes, Lighthouse audit (still owed from Phase 11).' },
  { n: 18, name: 'Deployment & Hosting',          status: 'pending', milestone: 3, note: 'Render/Azure + Vercel/Netlify, GitHub Actions, free tier throughout.' },
];

/**
 * Items needing a supervisor decision. These are the ones from the running
 * doc-gap list that genuinely cannot be closed by writing more code - keep this
 * short and decision-shaped, not a dump of all 55 gaps.
 */
export interface OpenItem {
  title: string;
  detail: string;
  ref: string;
}

export const OPEN_ITEMS: readonly OpenItem[] = [
  {
    title: 'Colour palette deviation',
    detail: 'Implemented in violet/blue/cyan/rose rather than the approved navy/teal/gold. Original tokens retained as comments in styles.scss for a one-commit revert.',
    ref: 'Feature Specification, Sec. 3.1',
  },
  {
    title: 'On-premise hosting requirement',
    detail: 'Unanswered. Blocks the Phase 18 hosting choice, and would also rule out the cloud Gemini API if the answer is on-prem only.',
    ref: 'Technical Documentation, Sec. 10',
  },
  {
    title: 'Gate-level entry tracking',
    detail: 'No GateID exists in the schema, so "entries through Gate 1" cannot be answered by the NL agent. Needs either a GateID column or the proposed AccessLog table.',
    ref: 'Database Design Document, Sec. 5.1',
  },
  {
    title: 'Live JWTs survive deactivation',
    detail: 'Deactivating an account blocks new logins but an already-issued token stays valid until it expires (24h). Options range from a shorter lifetime to server-side revocation.',
    ref: 'Doc-gap #55',
  },
  {
    title: 'NL agent inline charts blocked',
    detail: 'POST /agent/query returns no result rows, so the promised inline mini-charts cannot render. Frontend slot is built and inert pending a backend change.',
    ref: 'Feature Specification, Sec. 4',
  },
];