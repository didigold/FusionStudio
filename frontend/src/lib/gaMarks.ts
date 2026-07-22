/**
 * Gaze Analysis (GA) marks model — mirrors backend/core/ga_marks.py.
 *
 * Each distraction period holds up to 4 typed marks:
 *   move_start : eyes start moving away from the road (transition away begins)
 *   gaze_on    : gaze fixates on the distraction target (start of VATS time)
 *   move_end   : eyes start moving back to the road (end of VATS time)
 *   road_on    : gaze fixates back on the road
 *
 * GA_marks.json v2 stores { version: 2, periods: GaPeriod[] } per file key.
 * Legacy entries were flat number arrays where each pair = (gaze_on, move_end).
 */

export type GaMarkKey = 'move_start' | 'gaze_on' | 'move_end' | 'road_on';

export interface GaPeriod {
  move_start: number | null;
  gaze_on: number | null;
  move_end: number | null;
  road_on: number | null;
}

export interface GaMarksStorage {
  version: number;
  periods: GaPeriod[];
}

/** Reference to a single placed mark. */
export interface GaMarkerRef {
  periodIdx: number;
  key: GaMarkKey;
  t: number;
}

/** Order in which marks are placed within a period (click cycle). */
export const GA_MARK_SEQUENCE: GaMarkKey[] = ['move_start', 'gaze_on', 'move_end', 'road_on'];

export const GA_MARK_META: Record<GaMarkKey, { label: string; color: string; dash: number[] | null }> = {
  move_start: { label: 'Move Start', color: '#FFC107', dash: [4, 4] },
  gaze_on:    { label: 'Gaze On',    color: '#FF9800', dash: null },
  move_end:   { label: 'Move End',   color: '#FF5722', dash: [4, 4] },
  road_on:    { label: 'Road On',    color: '#4CAF50', dash: null },
};

export const emptyGaPeriod = (): GaPeriod => ({
  move_start: null,
  gaze_on: null,
  move_end: null,
  road_on: null,
});

const toNum = (v: unknown): number | null => {
  if (v == null || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const periodRefTime = (p: GaPeriod): number => {
  for (const k of ['gaze_on', 'move_start', 'move_end', 'road_on'] as GaMarkKey[]) {
    const v = p[k];
    if (v != null) return v;
  }
  return 0;
};

/** Normalize any stored entry (legacy number[] or v2 dict) to canonical periods. */
export function normalizeGaPeriods(entry: unknown): GaPeriod[] {
  const periods: GaPeriod[] = [];

  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const raw = (entry as Partial<GaMarksStorage>).periods;
    if (Array.isArray(raw)) {
      for (const rp of raw) {
        if (!rp || typeof rp !== 'object') continue;
        const p: GaPeriod = {
          move_start: toNum((rp as GaPeriod).move_start),
          gaze_on: toNum((rp as GaPeriod).gaze_on),
          move_end: toNum((rp as GaPeriod).move_end),
          road_on: toNum((rp as GaPeriod).road_on),
        };
        if (GA_MARK_SEQUENCE.some(k => p[k] != null)) periods.push(p);
      }
    }
  } else if (Array.isArray(entry)) {
    if (entry.length > 0 && entry.every(item => item != null && typeof item === 'object')) {
      // Already-canonical list of period dicts (e.g. from /marks/load)
      for (const rp of entry) {
        const p: GaPeriod = {
          move_start: toNum((rp as GaPeriod).move_start),
          gaze_on: toNum((rp as GaPeriod).gaze_on),
          move_end: toNum((rp as GaPeriod).move_end),
          road_on: toNum((rp as GaPeriod).road_on),
        };
        if (GA_MARK_SEQUENCE.some(k => p[k] != null)) periods.push(p);
      }
    } else {
      const floats = entry.map(toNum).filter((v): v is number => v != null);
      for (let i = 0; i + 1 < floats.length; i += 2) {
        periods.push({ move_start: null, gaze_on: floats[i], move_end: floats[i + 1], road_on: null });
      }
      if (floats.length % 2 === 1) {
        periods.push({ move_start: null, gaze_on: floats[floats.length - 1], move_end: null, road_on: null });
      }
    }
  }

  periods.sort((a, b) => periodRefTime(a) - periodRefTime(b));
  return periods;
}

/** Canonical v2 payload to persist in GA_marks.json. */
export function toGaStoragePayload(periods: GaPeriod[]): GaMarksStorage {
  const cleaned = periods
    .map(p => ({
      move_start: toNum(p.move_start),
      gaze_on: toNum(p.gaze_on),
      move_end: toNum(p.move_end),
      road_on: toNum(p.road_on),
    }))
    .filter(p => GA_MARK_SEQUENCE.some(k => p[k] != null));
  return { version: 2, periods: cleaned };
}

/** Flatten all placed marks into a chronological list for drawing/hit-testing. */
export function flattenGaMarkers(periods: GaPeriod[]): GaMarkerRef[] {
  const out: GaMarkerRef[] = [];
  periods.forEach((p, periodIdx) => {
    for (const key of GA_MARK_SEQUENCE) {
      const t = p[key];
      if (t != null) out.push({ periodIdx, key, t });
    }
  });
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Total number of placed marks. */
export function countGaMarks(periods: GaPeriod[]): number {
  return periods.reduce((n, p) => n + GA_MARK_SEQUENCE.filter(k => p[k] != null).length, 0);
}

/** Slot that the next click should fill (cyclic sequence within the last period). */
export function nextGaMarkSlot(periods: GaPeriod[]): { periodIdx: number; key: GaMarkKey } {
  if (periods.length === 0) return { periodIdx: 0, key: 'move_start' };
  const lastIdx = periods.length - 1;
  const last = periods[lastIdx];
  for (const key of GA_MARK_SEQUENCE) {
    if (last[key] == null) return { periodIdx: lastIdx, key };
  }
  return { periodIdx: periods.length, key: 'move_start' };
}

/** Derived durations (s) for a period; null when not computable. */
export function gaPeriodMetrics(p: GaPeriod): { tTransAway: number | null; tVats: number | null; tTransBack: number | null } {
  return {
    tTransAway: p.gaze_on != null && p.move_start != null ? p.gaze_on - p.move_start : null,
    tVats: p.move_end != null && p.gaze_on != null ? p.move_end - p.gaze_on : null,
    tTransBack: p.road_on != null && p.move_end != null ? p.road_on - p.move_end : null,
  };
}
