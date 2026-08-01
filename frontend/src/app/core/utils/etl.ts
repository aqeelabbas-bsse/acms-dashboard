import { EtlRow } from '../models/api.models';

/** Case-insensitive numeric column read from an ETL row. */
export function numField(row: EtlRow, key: string): number | null {
  const match = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
  const value = match ? row[match] : undefined;
  return typeof value === 'number' ? value : null;
}

/** Pulls one numeric series out of ETL rows. Returns [] if the shape is wrong. */
export function series(rows: EtlRow[] | null, key: string, limit = 30): number[] {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const out: number[] = [];
  for (const row of rows) {
    const v = numField(row, key);
    if (v === null) return [];
    out.push(v);
  }
  return out.slice(-limit);
}