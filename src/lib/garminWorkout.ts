import { Encoder, Profile, type FileIdMesg, type WorkoutMesg, type WorkoutStepMesg } from '@garmin/fitsdk';
import type { TerrKey } from '../config';
import { ui } from '../i18n/ui';
import type { Locale } from '../state/previewLocale';
import { kmL } from './format';
import { splitMarks, terrOf } from './marks';
import type { Plan } from './model';

/** Garmin-klokker tar et begrenset antall steg. Over dette slås like naboer sammen. */
export const GARMIN_MAX_STEPS = 50;

/** Offisiell løpsdistanse i meter. Nettstedet bruker 21,097 / 42,194 km, innenfor toleransen. */
const OFFICIAL_M = { half: 21097.5, full: 42195 } as const;
const OFFICIAL_TOLERANCE_M = 50;
const PLAN_SUM_TOLERANCE_M = 1;

/**
 * Encoder skriver bare hovedfeltene. Underfelt som durationDistance og
 * customTargetSpeedLow blir ignorert. Skalaen ligger i FIT-profilen:
 * distanse × 100 (meter) og fart × 1000 (m/s).
 */
const DISTANCE_SCALE = 100;
const SPEED_SCALE = 1000;
const NAME_MAX = 15;

export type GarminMode = 'segment' | 'km';

export type GarminWorkoutErrorCode =
  | 'invalid-pace'
  | 'invalid-distance'
  | 'distance-mismatch'
  | 'too-many-steps'
  | 'pace-tolerance';

export class GarminWorkoutError extends Error {
  readonly code: GarminWorkoutErrorCode;

  constructor(code: GarminWorkoutErrorCode) {
    super(code);
    this.name = 'GarminWorkoutError';
    this.code = code;
  }
}

export type GarminStep = {
  name: string;
  meters: number;
  paceSecPerKm: number;
  terrain: TerrKey;
};

export type GarminWorkoutOptions = {
  /** segment = ett steg per løypesegment. km = ett steg per kilometer. */
  mode?: GarminMode;
  /** ± sekunder per km rundt måltempo. Standard 5. */
  toleranceSec?: number;
  /** 1 = av. 1,005 gjør hvert steg litt lenger, mot GPS som måler langt. */
  gpsFactor?: number;
  locale?: Locale;
  /** Øvre grense for antall steg. Standard 50. */
  maxSteps?: number;
  serialNumber?: number;
  timeCreated?: Date;
};

export type GarminWorkoutFile = {
  bytes: Uint8Array;
  filename: string;
  stepCount: number;
  merged: boolean;
};

type ResolvedOptions = {
  mode: GarminMode;
  toleranceSec: number;
  gpsFactor: number;
  locale: Locale;
  maxSteps: number;
  serialNumber: number;
  timeCreated: Date;
};

export function fitLabel(name: string): string {
  const ascii = name
    .replace(/Æ/g, 'Ae')
    .replace(/æ/g, 'ae')
    .replace(/Ø/g, 'O')
    .replace(/ø/g, 'o')
    .replace(/Å/g, 'A')
    .replace(/å/g, 'a')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cut = ascii.slice(0, NAME_MAX).trim();
  return cut || 'Steg';
}

export function garminFilename(plan: Plan): string {
  const { h, m, s } = clockParts(plan.input.T);
  const dist = plan.input.full ? 'maraton' : 'halv';
  return `BCM-${dist}-${h}-${pad(m)}-${pad(s)}.fit`;
}

export function garminWorkoutName(plan: Plan): string {
  const { h, m, s } = clockParts(plan.input.T);
  return `BCM ${h}:${pad(m)}:${pad(s)}`.slice(0, NAME_MAX);
}

/** Stegene slik de blir kodet, etter eventuell sammenslåing og GPS-faktor. */
export function workoutStepsFromPlan(plan: Plan, options: GarminWorkoutOptions = {}): { steps: GarminStep[]; merged: boolean } {
  const opts = resolveOptions(options);
  const raw = opts.mode === 'km' ? kmSteps(plan) : segmentSteps(plan, opts.locale);
  if (raw.length === 0) throw new GarminWorkoutError('invalid-distance');

  for (const step of raw) assertStep(step, opts.toleranceSec);

  const sum = raw.reduce((total, step) => total + step.meters, 0);
  const official = plan.input.full ? OFFICIAL_M.full : OFFICIAL_M.half;
  if (Math.abs(sum - plan.D * 1000) > PLAN_SUM_TOLERANCE_M || Math.abs(sum - official) > OFFICIAL_TOLERANCE_M) {
    throw new GarminWorkoutError('distance-mismatch');
  }

  const collapsed = collapseGarminSteps(raw, opts.maxSteps);
  return {
    merged: collapsed.merged,
    steps: collapsed.steps.map((step) => ({ ...step, meters: step.meters * opts.gpsFactor })),
  };
}

export function collapseGarminSteps(steps: GarminStep[], maxSteps: number): { steps: GarminStep[]; merged: boolean } {
  if (!(maxSteps >= 1)) throw new GarminWorkoutError('too-many-steps');
  const out = steps.map((step) => ({ ...step }));
  let merged = false;
  while (out.length > maxSteps) {
    const idx = out.findIndex((step, i) => i < out.length - 1 && step.terrain === out[i + 1].terrain);
    if (idx < 0) throw new GarminWorkoutError('too-many-steps');
    const a = out[idx];
    const b = out[idx + 1];
    const meters = a.meters + b.meters;
    out.splice(idx, 2, {
      name: b.name,
      meters,
      paceSecPerKm: (a.paceSecPerKm * a.meters + b.paceSecPerKm * b.meters) / meters,
      terrain: a.terrain,
    });
    merged = true;
  }
  return { steps: out, merged };
}

export function createGarminWorkout(plan: Plan, options: GarminWorkoutOptions = {}): GarminWorkoutFile {
  const opts = resolveOptions(options);
  const prepared = workoutStepsFromPlan(plan, options);
  const encoder = new Encoder();
  const fileId: FileIdMesg = {
    type: 'workout',
    manufacturer: 'development',
    product: 0,
    serialNumber: opts.serialNumber,
    timeCreated: opts.timeCreated,
  };
  const workout: WorkoutMesg = {
    sport: 'running',
    subSport: 'road',
    wktName: garminWorkoutName(plan),
    numValidSteps: prepared.steps.length,
  };
  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  encoder.onMesg(Profile.MesgNum.WORKOUT, workout);
  prepared.steps.forEach((step, index) => {
    const low = 1000 / (step.paceSecPerKm + opts.toleranceSec);
    const high = 1000 / (step.paceSecPerKm - opts.toleranceSec);
    const workoutStep: WorkoutStepMesg = {
      messageIndex: index,
      wktStepName: step.name,
      durationType: 'distance',
      durationValue: Math.round(step.meters * DISTANCE_SCALE),
      targetType: 'speed',
      targetValue: 0,
      customTargetValueLow: Math.round(low * SPEED_SCALE),
      customTargetValueHigh: Math.round(high * SPEED_SCALE),
      intensity: 'active',
    };
    encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, workoutStep);
  });
  return {
    bytes: encoder.close(),
    filename: garminFilename(plan),
    stepCount: prepared.steps.length,
    merged: prepared.merged,
  };
}

export function buildGarminWorkout(plan: Plan, options: GarminWorkoutOptions = {}): Uint8Array {
  return createGarminWorkout(plan, options).bytes;
}

function segmentSteps(plan: Plan, locale: Locale): GarminStep[] {
  const marks = splitMarks(plan.input.full, ui[locale].marks);
  const steps: GarminStep[] = [];
  for (let i = 1; i < marks.length; i++) {
    const a = marks[i - 1].km;
    const b = marks[i].km;
    steps.push(stepBetween(plan, a, b, marks[i].name));
  }
  return steps;
}

function kmSteps(plan: Plan): GarminStep[] {
  const steps: GarminStep[] = [];
  for (let a = 0; a < plan.D - 1e-6; a += 1) {
    const b = Math.min(plan.D, a + 1);
    const label = Math.abs(b - plan.D) < 0.02 && b - a < 0.999 ? kmL(b) : String(Math.round(a + 1));
    steps.push(stepBetween(plan, a, b, label));
  }
  return steps;
}

function stepBetween(plan: Plan, a: number, b: number, name: string): GarminStep {
  const g = plan.agg(a, b);
  const grade = g.len > 0 ? (g.up - g.dn) / (g.len * 10) : 0;
  return {
    name: fitLabel(name),
    meters: g.len * 1000,
    paceSecPerKm: g.len > 0 ? (g.t + g.stops) / g.len : 0,
    terrain: terrOf(a, b, grade),
  };
}

function assertStep(step: GarminStep, toleranceSec: number) {
  if (!(step.meters > 0) || !Number.isFinite(step.meters)) throw new GarminWorkoutError('invalid-distance');
  if (!(step.paceSecPerKm > 0) || !Number.isFinite(step.paceSecPerKm)) throw new GarminWorkoutError('invalid-pace');
  if (!(toleranceSec > 0) || !(step.paceSecPerKm - toleranceSec > 0)) throw new GarminWorkoutError('pace-tolerance');
}

function resolveOptions(options: GarminWorkoutOptions): ResolvedOptions {
  const gpsFactor = options.gpsFactor ?? 1;
  if (!(gpsFactor > 0) || !Number.isFinite(gpsFactor)) throw new GarminWorkoutError('invalid-distance');
  const toleranceSec = options.toleranceSec ?? 5;
  if (!(toleranceSec > 0) || !Number.isFinite(toleranceSec)) throw new GarminWorkoutError('pace-tolerance');
  const maxSteps = options.maxSteps ?? GARMIN_MAX_STEPS;
  return {
    mode: options.mode === 'km' ? 'km' : 'segment',
    toleranceSec,
    gpsFactor,
    locale: options.locale === 'en' ? 'en' : 'nb',
    maxSteps,
    serialNumber: serialOf(options.serialNumber),
    timeCreated: options.timeCreated instanceof Date && !Number.isNaN(options.timeCreated.getTime()) ? options.timeCreated : new Date(),
  };
}

function serialOf(value: number | undefined): number {
  if (value != null && Number.isInteger(value) && value > 0 && value <= 0xffffffff) return value;
  if (value != null) throw new GarminWorkoutError('invalid-distance');
  return (Date.now() % 0xfffffffe) + 1;
}

function clockParts(totalSec: number): { h: number; m: number; s: number } {
  const x = Math.round(Math.abs(totalSec));
  return {
    h: Math.floor(x / 3600),
    m: Math.floor((x % 3600) / 60),
    s: x % 60,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
