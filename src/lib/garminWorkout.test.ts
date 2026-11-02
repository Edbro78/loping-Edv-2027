import { Decoder, Stream } from '@garmin/fitsdk';
import { describe, expect, it } from 'vitest';
import { reserveElev } from './gpx';
import {
  GarminWorkoutError,
  buildGarminWorkout,
  collapseGarminSteps,
  createGarminWorkout,
  fitLabel,
  workoutStepsFromPlan,
  type GarminStep,
} from './garminWorkout';
import { buildPlan, type Plan } from './model';

const halfInput = {
  full: false,
  T: 1 * 3600 + 45 * 60,
  split: 'jevn' as const,
  sigma: 2,
  hill: 'middels' as const,
  stopSec: 2,
  start: '09:00',
};

const fullInput = {
  ...halfInput,
  full: true,
  T: 3 * 3600 + 30 * 60,
  start: '07:45',
};

const fixed = { serialNumber: 42, timeCreated: new Date('2026-11-02T15:00:00Z'), locale: 'nb' as const };

function decode(bytes: Uint8Array) {
  const stream = Stream.fromByteArray(Array.from(bytes));
  expect(Decoder.isFIT(stream)).toBe(true);
  const decoder = new Decoder(stream);
  expect(decoder.checkIntegrity()).toBe(true);
  const { messages, errors } = decoder.read();
  expect(errors).toEqual([]);
  return messages;
}

function expectMatchesPlan(plan: Plan, mode: 'segment' | 'km', gpsFactor = 1) {
  const options = { ...fixed, mode, gpsFactor, toleranceSec: 5 };
  const prepared = workoutStepsFromPlan(plan, options);
  const bytes = buildGarminWorkout(plan, options);
  const messages = decode(bytes);
  const steps = messages.workoutStepMesgs ?? [];

  expect(messages.fileIdMesgs?.[0]).toMatchObject({
    type: 'workout',
    manufacturer: 'development',
    product: 0,
    serialNumber: 42,
  });
  expect(messages.workoutMesgs?.[0]).toMatchObject({
    sport: 'running',
    subSport: 'road',
    numValidSteps: prepared.steps.length,
  });
  expect(String(messages.workoutMesgs?.[0].wktName).length).toBeLessThanOrEqual(15);
  expect(steps).toHaveLength(prepared.steps.length);
  expect(prepared.steps.length).toBeGreaterThan(0);
  expect(prepared.steps.length).toBeLessThanOrEqual(50);

  let sum = 0;
  steps.forEach((step, i) => {
    const source = prepared.steps[i];
    const low = 1000 / (source.paceSecPerKm + 5);
    const high = 1000 / (source.paceSecPerKm - 5);
    expect(step.durationType).toBe('distance');
    expect(step.targetType).toBe('speed');
    expect(step.targetValue).toBe(0);
    expect(step.intensity).toBe('active');
    expect(step.messageIndex).toBe(i);
    expect(step.wktStepName).toBe(source.name);
    expect(String(step.wktStepName)).toMatch(/^[\x20-\x7E]{1,15}$/);
    expect(step.durationDistance).toBeCloseTo(source.meters, 2);
    expect(Math.round(Number(step.customTargetSpeedLow) * 1000)).toBe(Math.round(low * 1000));
    expect(Math.round(Number(step.customTargetSpeedHigh) * 1000)).toBe(Math.round(high * 1000));
    sum += Number(step.durationDistance);
  });

  const expected = plan.D * 1000 * gpsFactor;
  expect(Math.abs(sum - expected)).toBeLessThan(0.02 * steps.length + 0.05);
}

describe('buildGarminWorkout', () => {
  const half = buildPlan(reserveElev, halfInput);
  const full = buildPlan(reserveElev, fullInput);

  it('lager en gyldig FIT for halvmaraton, segment og per km', () => {
    expectMatchesPlan(half, 'segment');
    expectMatchesPlan(half, 'km');
    expect(workoutStepsFromPlan(half, { mode: 'km' }).steps).toHaveLength(22);
  });

  it('lager en gyldig FIT for maraton, segment og per km', () => {
    expectMatchesPlan(full, 'segment');
    expectMatchesPlan(full, 'km');
    expect(workoutStepsFromPlan(full, { mode: 'km' }).steps).toHaveLength(43);
  });

  it('skalerer distansen når GPS-faktor er på', () => {
    expectMatchesPlan(half, 'segment', 1.005);
    const file = createGarminWorkout(half, { ...fixed, mode: 'segment', gpsFactor: 1.005 });
    expect(file.filename).toBe('BCM-halv-1-45-00.fit');
    expect(file.merged).toBe(false);
  });

  it('navngir maratonfilen med sluttid', () => {
    const file = createGarminWorkout(full, { ...fixed, mode: 'segment' });
    expect(file.filename).toBe('BCM-maraton-3-30-00.fit');
    const messages = decode(file.bytes);
    expect(messages.workoutMesgs?.[0].wktName).toBe('BCM 3:30:00');
  });

  it('avviser tempo 0, feil distansesum og for stor toleranse', () => {
    expect(() => buildGarminWorkout(buildPlan(reserveElev, { ...halfInput, T: 0 }), fixed)).toThrow(GarminWorkoutError);

    const short: Plan = {
      ...half,
      agg: (a, b) => ({ t: 300 * (b - a), fd: b - a, up: 0, dn: 0, stops: 0, len: (b - a) * 0.5 }),
    };
    expect(() => buildGarminWorkout(short, fixed)).toThrowError(expect.objectContaining({ code: 'distance-mismatch' }));

    const stopped: Plan = {
      ...half,
      agg: () => ({ t: 0, fd: 0, up: 0, dn: 0, stops: 0, len: 0 }),
    };
    expect(() => buildGarminWorkout(stopped, fixed)).toThrowError(expect.objectContaining({ code: 'invalid-distance' }));

    expect(() => buildGarminWorkout(half, { ...fixed, toleranceSec: 10000 })).toThrowError(
      expect.objectContaining({ code: 'pace-tolerance' }),
    );
  });

  it('slår sammen like naboer og sier fra når grensen er nådd', () => {
    const flat = (name: string, pace: number): GarminStep => ({ name, meters: 1000, paceSecPerKm: pace, terrain: 'flat' });
    const collapsed = collapseGarminSteps([flat('a', 300), flat('b', 360), flat('c', 300)], 2);
    expect(collapsed.merged).toBe(true);
    expect(collapsed.steps).toHaveLength(2);
    expect(collapsed.steps[0].paceSecPerKm).toBeCloseTo(330, 5);
    expect(collapsed.steps[0].meters).toBe(2000);

    const mixed: GarminStep[] = [
      { name: 'opp', meters: 1000, paceSecPerKm: 300, terrain: 'climb' },
      { name: 'flatt', meters: 1000, paceSecPerKm: 300, terrain: 'flat' },
    ];
    expect(() => collapseGarminSteps(mixed, 1)).toThrowError(expect.objectContaining({ code: 'too-many-steps' }));

    const tight = createGarminWorkout(half, { ...fixed, maxSteps: 8 });
    expect(tight.merged).toBe(true);
    expect(tight.stepCount).toBeLessThanOrEqual(8);
    expect(Decoder.isFIT(Stream.fromByteArray(Array.from(tight.bytes)))).toBe(true);
  });
});

describe('fitLabel', () => {
  it('bytter æ ø å og kutter til 15 tegn', () => {
    expect(fitLabel('Mål')).toBe('Mal');
    expect(fitLabel('Møhlenpris')).toBe('Mohlenpris');
    expect(fitLabel('Grønneviksøren')).toBe('Gronneviksoren');
    expect(fitLabel('Slutten av Fjellveien (topp)')).toHaveLength(15);
    expect(fitLabel('Halvveis · cut-off')).toMatch(/^[\x20-\x7E]{1,15}$/);
  });
});
