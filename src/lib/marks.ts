import { CP, FULL_EXTRA_STATION, LAP, type TerrKey } from '../config';

export type CourseMark = { km: number; name: string };

export type MarkLabels = {
  start: string;
  halfwayCutoff: string;
  drinkBryggen: string;
  finish: string;
  km: string;
};

export function splitMarks(full: boolean, marks: MarkLabels): CourseMark[] {
  const rows: CourseMark[] = [{ km: 0, name: marks.start }];
  if (!full) {
    for (const [km, name] of CP) rows.push({ km, name });
  } else {
    for (const [km, name] of CP) {
      rows.push({ km, name: Math.abs(km - LAP) < 0.02 ? marks.halfwayCutoff : name });
    }
    rows.push({ km: FULL_EXTRA_STATION, name: marks.drinkBryggen });
    for (const [km, name] of CP) {
      rows.push({ km: km + LAP, name: Math.abs(km - LAP) < 0.02 ? marks.finish : name });
    }
    for (const k of [25, 30, 35, 40]) rows.push({ km: k, name: marks.km.replace('{n}', String(k)) });
  }
  rows.sort((a, b) => a.km - b.km);
  const out: CourseMark[] = [];
  for (const r of rows) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.km - r.km) <= 0.02) {
      if (r.name === marks.halfwayCutoff || r.name === marks.finish || r.name === marks.drinkBryggen) {
        prev.name = r.name;
      }
      continue;
    }
    out.push({ ...r });
  }
  return out;
}

export function terrOf(a: number, b: number, g: number): TerrKey {
  const mid = (a + b) / 2;
  const lk = ((mid % LAP) + LAP) % LAP;
  const atJoin = Math.abs(lk) < 1e-4 || Math.abs(lk - LAP) < 1e-3;
  const lapKm = atJoin ? (mid > LAP / 2 ? LAP : 0) : lk;
  if (lapKm >= 17.79 && lapKm <= 18.41) return 'cobble';
  if (g >= 2) return 'climb';
  if (g <= -2) return 'down';
  return 'flat';
}
