/**
 * Mirrors the backend's DrilldownKind/Dimension enums (as kebab-case route
 * segments and lowerCamel query values respectively).
 */
export type DrilldownKind =
  | 'active-cards'
  | 'blocked-cards'
  | 'pending-printing'
  | 'pending-approval'
  | 'visitors-today';

export type DrilldownDimension = 'cardCategory' | 'opicode';

export interface BreakdownItem {
  code: string;
  label: string;
  count: number;
}

export interface DrilldownSummary {
  kind: string;
  total: number;
  breakdown: BreakdownItem[];
  supportsDimensionToggle: boolean;
}

export interface DrilldownRow {
  id: string;
  primary: string;
  secondary: string | null;
  categoryLabel: string | null;
  statusLabel: string | null;
  statusTone: string | null;
  date: string | null;
  note: string | null;
}

/** Colour identity for the dashboard tile - matches the app's existing
 *  semantic token set (teal-bg/teal-fg, danger-bg/danger-fg, etc). */
export type DrilldownTone = 'teal' | 'rose' | 'amber' | 'blue' | 'violet';

/** Static copy for each KPI - title, subtitle, icon, and colour, all in one place. */
export interface DrilldownMeta {
  kind: DrilldownKind;
  title: string;
  subtitle: string;
  icon: 'card' | 'shield' | 'printer' | 'clock' | 'userCheck';
  tone: DrilldownTone;
}

export const DRILLDOWN_META: Record<DrilldownKind, DrilldownMeta> = {
  'active-cards': {
    kind: 'active-cards', title: 'Active Staff Cards',
    subtitle: 'Registered PersonalRFID cards currently active', icon: 'card',
    tone: 'teal',
  },
  'blocked-cards': {
    kind: 'blocked-cards', title: 'Blocked Staff Cards',
    subtitle: 'Cards revoked, grouped by reason', icon: 'shield',
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