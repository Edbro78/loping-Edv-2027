import { Encoder, Profile, type CourseMesg, type CoursePointMesg, type EventMesg, type FileIdMesg, type LapMesg, type RecordMesg } from '@garmin/fitsdk';
import type { TrackPoint } from './courseSlice';

const SEMICIRCLE = 2147483648 / 180;
/** Nominell fart så løypefila har en sammenhengende tid. Klokka bruker den ikke som tempoplan. */
const NOMINAL_SPEED = 3;

export type GarminCourseOptions = {
  name: string;
  filename: string;
  startName: string;
  endName: string;
  serialNumber?: number;
  timeCreated?: Date;
};

export type GarminCourseFile = {
  bytes: Uint8Array;
  filename: string;
};

export function toSemicircles(degrees: number): number {
  return Math.round(degrees * SEMICIRCLE);
}

export function createGarminCourse(points: TrackPoint[], options: GarminCourseOptions): GarminCourseFile {
  if (points.length < 2) throw new Error('course');
  const meters = points[points.length - 1].km * 1000;
  if (!(meters > 100)) throw new Error('course');

  const created = options.timeCreated instanceof Date && !Number.isNaN(options.timeCreated.getTime()) ? options.timeCreated : new Date();
  const elapsed = Math.max(points.length - 1, meters / NOMINAL_SPEED);
  const stamps = timestamps(created, points.length, elapsed);
  const timerSec = (stamps[stamps.length - 1].getTime() - stamps[0].getTime()) / 1000;
  const start = points[0];
  const end = points[points.length - 1];

  const encoder = new Encoder();
  const fileId: FileIdMesg = {
    type: 'course',
    manufacturer: 'development',
    product: 0,
    serialNumber: serialOf(options.serialNumber),
    timeCreated: created,
  };
  const course: CourseMesg = {
    sport: 'running',
    name: options.name,
    capabilities: 'navigation',
  };
  const lap: LapMesg = {
    messageIndex: 0,
    timestamp: stamps[stamps.length - 1],
    startTime: stamps[0],
    startPositionLat: toSemicircles(start.lat),
    startPositionLong: toSemicircles(start.lng),
    endPositionLat: toSemicircles(end.lat),
    endPositionLong: toSemicircles(end.lng),
    totalElapsedTime: timerSec,
    totalTimerTime: timerSec,
    totalDistance: meters,
    avgSpeed: meters / timerSec,
    sport: 'running',
    subSport: 'generic',
    lapTrigger: 'sessionEnd',
  };
  const startEvent: EventMesg = { timestamp: stamps[0], event: 'timer', eventType: 'start' };
  const stopEvent: EventMesg = { timestamp: stamps[stamps.length - 1], event: 'timer', eventType: 'stopAll' };

  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  encoder.onMesg(Profile.MesgNum.COURSE, course);
  encoder.onMesg(Profile.MesgNum.LAP, lap);
  encoder.onMesg(Profile.MesgNum.EVENT, startEvent);
  points.forEach((point, index) => {
    const record: RecordMesg = {
      timestamp: stamps[index],
      positionLat: toSemicircles(point.lat),
      positionLong: toSemicircles(point.lng),
      distance: point.km * 1000,
      altitude: point.ele,
      enhancedAltitude: point.ele,
    };
    encoder.onMesg(Profile.MesgNum.RECORD, record);
  });
  encoder.onMesg(Profile.MesgNum.EVENT, stopEvent);
  coursePoint(encoder, 0, stamps[0], start, 0, 'segmentStart', options.startName);
  coursePoint(encoder, 1, stamps[stamps.length - 1], end, meters, 'segmentEnd', options.endName);

  return { bytes: encoder.close(), filename: options.filename };
}

function coursePoint(
  encoder: Encoder,
  index: number,
  timestamp: Date,
  point: TrackPoint,
  meters: number,
  type: 'segmentStart' | 'segmentEnd',
  name: string,
) {
  const mesg: CoursePointMesg = {
    messageIndex: index,
    timestamp,
    positionLat: toSemicircles(point.lat),
    positionLong: toSemicircles(point.lng),
    distance: meters,
    type,
    name,
  };
  encoder.onMesg(Profile.MesgNum.COURSE_POINT, mesg);
}

function timestamps(start: Date, count: number, elapsedSec: number): Date[] {
  const out: Date[] = [];
  let prev = -1;
  for (let i = 0; i < count; i++) {
    let sec = Math.round((i * elapsedSec) / (count - 1));
    if (sec <= prev) sec = prev + 1;
    prev = sec;
    out.push(new Date(start.getTime() + sec * 1000));
  }
  return out;
}

function serialOf(value: number | undefined): number {
  if (value != null && Number.isInteger(value) && value > 0 && value <= 0xffffffff) return value;
  return (Date.now() % 0xfffffffe) + 1;
}
