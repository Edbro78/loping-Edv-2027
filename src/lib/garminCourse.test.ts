import { readFileSync } from 'node:fs';
import { Decoder, Stream } from '@garmin/fitsdk';
import { describe, expect, it } from 'vitest';
import { bcmCourseSegments } from './courseSlice';
import { createGarminCourse, toSemicircles } from './garminCourse';

const xml = readFileSync('public/data/bcm-course.gpx', 'utf8');
const fixed = { serialNumber: 42, timeCreated: new Date('2026-11-02T15:00:00Z') };

function decode(bytes: Uint8Array) {
  const stream = Stream.fromByteArray(Array.from(bytes));
  expect(Decoder.isFIT(stream)).toBe(true);
  const decoder = new Decoder(stream);
  expect(decoder.checkIntegrity()).toBe(true);
  const { messages, errors } = decoder.read();
  expect(errors).toEqual([]);
  return messages;
}

describe('bcmCourseSegments', () => {
  const segments = bcmCourseSegments(xml);

  it('måler de første 10,000 km fra start til Haraldsplass', () => {
    expect(segments.first.meters).toBe(10000);
    expect(segments.first.points[0].km).toBe(0);
    expect(segments.first.points.at(-1)?.km).toBe(10);
    expect(segments.first.points[0].lat).toBeCloseTo(60.397037, 4);
    expect(segments.first.points.at(-1)?.lat).toBeGreaterThan(60.376);
    expect(segments.first.points.at(-1)?.lat).toBeLessThan(60.386);
    expect(segments.first.points.at(-1)?.lng).toBeGreaterThan(5.35);
    expect(segments.first.points.at(-1)?.lng).toBeLessThan(5.37);
  });

  it('lar resten fra Haraldsplass til mål være 11,2 km', () => {
    expect(segments.last.meters).toBeGreaterThanOrEqual(11200);
    expect(segments.last.meters).toBeLessThanOrEqual(11210);
    expect(segments.last.points[0].lat).toBeCloseTo(segments.first.points.at(-1)!.lat, 5);
    expect(segments.last.points[0].lng).toBeCloseTo(segments.first.points.at(-1)!.lng, 5);
    expect(segments.first.meters + segments.last.meters).toBeGreaterThan(21200);
    expect(segments.first.meters + segments.last.meters).toBeLessThan(21210);
  });
});

describe('createGarminCourse', () => {
  const segments = bcmCourseSegments(xml);

  it('lager en gyldig løypefil for de første 10 km', () => {
    const file = createGarminCourse(segments.first.points, {
      ...fixed,
      name: 'BCM 10 km',
      filename: 'BCM-forste-10-km.fit',
      startName: 'Start',
      endName: 'Haraldsplass',
    });
    expect(file.filename).toBe('BCM-forste-10-km.fit');
    const messages = decode(file.bytes);
    expect(messages.fileIdMesgs?.[0].type).toBe('course');
    expect(messages.courseMesgs?.[0]).toMatchObject({ sport: 'running', name: 'BCM 10 km' });
    expect(messages.lapMesgs?.[0].totalDistance).toBeCloseTo(10000, 0);
    const records = messages.recordMesgs ?? [];
    expect(records.length).toBeGreaterThan(900);
    expect(records[0].distance).toBeCloseTo(0, 2);
    expect(records.at(-1)?.distance).toBeCloseTo(10000, 0);
    expect(records[0].positionLat).toBe(toSemicircles(segments.first.points[0].lat));
    expect(records.at(-1)?.positionLong).toBe(toSemicircles(segments.first.points.at(-1)!.lng));
    expect(messages.coursePointMesgs?.map((point) => point.name)).toEqual(['Start', 'Haraldsplass']);
    expect(messages.coursePointMesgs?.[1].distance).toBeCloseTo(10000, 0);
  });

  it('lager en gyldig løypefil for de siste 11,2 km', () => {
    const file = createGarminCourse(segments.last.points, {
      ...fixed,
      name: 'BCM 11.2 km',
      filename: 'BCM-siste-11-2-km.fit',
      startName: 'Haraldsplass',
      endName: 'Mal',
    });
    const messages = decode(file.bytes);
    expect(messages.lapMesgs?.[0].totalDistance).toBeCloseTo(segments.last.meters, 0);
    expect(messages.recordMesgs?.at(-1)?.distance).toBeCloseTo(segments.last.meters, 0);
    expect(messages.coursePointMesgs?.map((point) => point.name)).toEqual(['Haraldsplass', 'Mal']);
  });
});
