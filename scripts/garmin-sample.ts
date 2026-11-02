import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reserveElev } from '../src/lib/gpx';
import { createGarminWorkout } from '../src/lib/garminWorkout';
import { buildPlan } from '../src/lib/model';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const plan = buildPlan(reserveElev, {
  full: false,
  T: 1 * 3600 + 45 * 60,
  split: 'jevn',
  sigma: 2,
  hill: 'middels',
  stopSec: 2,
  start: '09:00',
});

const file = createGarminWorkout(plan, {
  mode: 'segment',
  toleranceSec: 5,
  gpsFactor: 1,
  locale: 'nb',
  serialNumber: 1,
});

const dir = path.join(root, 'tmp');
mkdirSync(dir, { recursive: true });
const out = path.join(dir, file.filename);
writeFileSync(out, file.bytes);
console.log(`${out} · ${file.stepCount} steg`);
