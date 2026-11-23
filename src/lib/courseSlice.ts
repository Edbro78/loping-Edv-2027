import { haversine } from './gpx';

/** Punkt med kilometer langs det umålte GPX-sporet. */
export type TrackPoint = { km: number; lat: number; lng: number; ele: number };

/**
 * Offisiell halvmaraton er 21,097 km. GPX-fila måler 21,204 km.
 * Kutt på 10,000 km langs det sporet etterlater 11,204 km, som er 11,2 km.
 */
export const FIRST_SEGMENT_KM = 10;
const STEP_KM = 0.01;

export type CourseSegment = {
  points: TrackPoint[];
  /** Lengde i meter, fra første til siste punkt. */
  meters: number;
};

export function parseRawTrack(xml: string): TrackPoint[] {
  const re = /<trkpt lat="([^"]+)" lon="([^"]+)">([\s\S]*?)<\/trkpt>/g;
  const raw: { lat: number; lng: number; ele: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const eleMatch = match[3].match(/<ele>([^<]*)<\/ele>/);
    const ele = eleMatch ? Number(eleMatch[1]) : 0;
    raw.push({ lat, lng, ele: Number.isFinite(ele) ? ele : 0 });
  }
  if (raw.length < 50) throw new Error('track');

  const points: TrackPoint[] = [];
  let cum = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i) cum += haversine(raw[i - 1].lat, raw[i - 1].lng, raw[i].lat, raw[i].lng);
    points.push({ km: cum, lat: raw[i].lat, lng: raw[i].lng, ele: raw[i].ele });
  }
  const total = points[points.length - 1].km;
  if (total < 20 || total > 23) throw new Error('track');
  return points;
}

function pointAt(points: TrackPoint[], km: number): TrackPoint {
  if (km <= points[0].km) return { ...points[0], km };
  const last = points[points.length - 1];
  if (km >= last.km) return { ...last, km };
  let lo = 0;
  let hi = points.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].km <= km) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const f = (km - a.km) / (b.km - a.km || 1);
  return {
    km,
    lat: a.lat + (b.lat - a.lat) * f,
    lng: a.lng + (b.lng - a.lng) * f,
    ele: a.ele + (b.ele - a.ele) * f,
  };
}

/** Kutter sporet på nøyaktig kilometer og legger igjen et punkt hver 10. meter. */
export function sliceTrack(points: TrackPoint[], fromKm: number, toKm: number): CourseSegment {
  const endKm = Math.min(toKm, points[points.length - 1].km);
  const startKm = Math.max(0, fromKm);
  if (!(endKm > startKm + 0.05)) throw new Error('slice');

  const fromM = Math.round(startKm * 1000);
  const toM = Math.round(endKm * 1000);
  const stepM = Math.round(STEP_KM * 1000);
  const sliced: TrackPoint[] = [];
  for (let m = fromM; m < toM; m += stepM) {
    const p = pointAt(points, m / 1000);
    sliced.push({ ...p, km: (m - fromM) / 1000 });
  }
  const end = pointAt(points, toM / 1000);
  sliced.push({ ...end, km: (toM - fromM) / 1000 });
  sliced[0].km = 0;
  return { points: sliced, meters: toM - fromM };
}

export function bcmCourseSegments(xml: string): { first: CourseSegment; last: CourseSegment } {
  const track = parseRawTrack(xml);
  const total = track[track.length - 1].km;
  return {
    first: sliceTrack(track, 0, FIRST_SEGMENT_KM),
    last: sliceTrack(track, FIRST_SEGMENT_KM, total),
  };
}
