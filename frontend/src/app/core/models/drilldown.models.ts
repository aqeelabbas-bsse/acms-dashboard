/**
 * Mirrors the backend's DrilldownKind/Dimension enums (as kebab-case route
 * segments and lowerCamel query values respectively).
 *
 * The first five render as the coloured tile strip. The last four are the
 * headline KPI cards at the top of the dashboard, which became drillable after
 * the second review - every number on the screen can now be opened.
 */
export type DrilldownKind =
  | 'active-cards'
  | 'blocked-cards'
  | 'pending-printing'
  | 'pending-approval'
  | 'visitors-today'
  | 'total-employees'
  | 'active-visitor-cards'
  | 'visitors-on-site'
  | 'pending-requests';

export type DrilldownDimension = 'cardCategory' | 'opicode';

export interface BreakdownItem {
  code: string;
  label: string;
  count: number;
}

/** One grid column. The table head, the "search in" dropdown and the sort
 *  controls are all built from this - there is no per-kind markup. */
export interface DrilldownColumn {
  key: string;
  label: string;
  /** text | mono | date | status */
  type: string;
  searchable: boolean;
  sortable: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface DrilldownFilter {
  key: string;
  label: string;
  /** select | dateRange */
  type: string;
  options?: FilterOption[] | null;
}

export interface DrilldownSummary {
  kind: string;
  total: number;
  breakdown: BreakdownItem[];
  supportsDimensionToggle: boolean;
  breakdownLabel: string;
  /** The exact SQL predicate behind `total`, shown in the modal so the figure
   *  can be re-run in SSMS and verified line for line. */
  definition: string;
  sourceTable: string;
  columns: DrilldownColumn[];
  filters: DrilldownFilter[];
  reconciliation?: string | null;
}

export interface DrilldownRow {
  id: string;
  categoryCode: string | null;
  date: string | null;
  cells: Record<string, string | null>;
  statusTone: string | null;
}

/** Colour identity for the tile - matches the app's semantic token set. */
export type DrilldownTone = 'teal' | 'rose' | 'amber' | 'blue' | 'violet' | 'cyan';

export interface DrilldownMeta {
  kind: DrilldownKind;
  title: string;
  subtitle: string;
  icon: 'card' | 'shield' | 'printer' | 'clock' | 'userCheck' | 'users' | 'pin';
  tone: DrilldownTone;
}

export const DRILLDOWN_META: Record<DrilldownKind, DrilldownMeta> = {
  /* ---- headline KPI cards ---- */
  'total-employees': {
    kind: 'total-employees', title: 'Total Employees',
    subtitle: 'Every registered smart-card profile', icon: 'users',
    tone: 'violet',
  },
  'active-visitor-cards': {
    kind: 'active-visitor-cards', title: 'Active Visitor Cards',
    subtitle: 'Visitor passes issued and not blocked', icon: 'card',
    tone: 'cyan',
  },
  'visitors-on-site': {
    kind: 'visitors-on-site', title: 'Visitors On Site Now',
    subtitle: 'Open visits with no recorded checkout', icon: 'pin',
    tone: 'blue',
  },
  'pending-requests': {
    kind: 'pending-requests', title: 'Pending Staff Requests',
    subtitle: 'Card requests not yet printed', icon: 'clock',
    tone: 'rose',
  },

  /* ---- tile strip ---- */
  'active-cards': {
    kind: 'active-cards', title: 'Active Staff Cards',
    subtitle: 'Registered PersonalRFID cards currently active', icon: 'card',
    tone: 'teal',
  },
  'blocked-cards': {
    // Renamed from "Blocked Staff Cards". The tile now counts every
    // deactivated card (IsDeactive = 1), which is what SSMS returns; the
    // security-blocked subset is one filter away.
    kind: 'blocked-cards', title: 'Deactivated Staff Cards',
    subtitle: 'Cards no longer active, grouped by reason', icon: 'shield',
    tone: 'rose',
  },
  'pending-printing': {
    kind: 'pending-printing', title: 'Pending Printing',
    subtitle: 'Verified requests awaiting a printed card', icon: 'printer',
    tone: 'amber',
  },
  'pending-approval': {
    kind: 'pending-approval', title: 'Pending Approval',
    subtitle: 'Requests submitted but not yet verified', icon: 'clock',
    tone: 'blue',
  },
  'visitors-today': {
    kind: 'visitors-today', title: "Today's Visitors",
    subtitle: 'Checked in today, grouped by company', icon: 'userCheck',
    tone: 'violet',
  },
};

/**
 * Which kinds render as the coloured tile strip under the charts. Deliberately
 * separate from DRILLDOWN_META so the four KPI kinds can share all the same
 * modal machinery without also appearing twice on the page.
 */
export const DRILL_TILE_KINDS: DrilldownKind[] = [
  'active-cards',
  'blocked-cards',
  'pending-printing',
  'pending-approval',
  'visitors-today',
];