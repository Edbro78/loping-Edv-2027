import { type HillKey, type SplitKey } from '../config';
import { hillCopy } from '../i18n/hills';
import { ui } from '../i18n/ui';
import type { Locale } from '../state/previewLocale';
import type { Plan } from './model';
import { clockDot, dateDM, fmtP, fmtT } from './format';
import { addDays, lookupMilestones, rngT, WEEK1 } from './milestones';
import type { PlanState } from '../state/plan';

const RACE = new Date(Date.UTC(2027, 3, 24));
const BCM_URL = 'https://www.bergencitymarathon.com';
function guideUrl(): string {
  if (typeof location === 'undefined') return '';
  return location.origin + location.pathname;
}

const TAPER_FROM_WEEK = 12;

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function trainingVolumeBrief(plan: Plan) {
  const hit = lookupMilestones(plan.input.full, plan.input.T);
  return {
    volRange: hit.vol,
    taperFromWeek: TAPER_FROM_WEEK,
    taperFromDate: dateDM(addDays(WEEK1, (TAPER_FROM_WEEK - 1) * 7)),
  };
}

export function formatTrainingBrief(plan: Plan, locale: Locale): string {
  const { volRange, taperFromWeek, taperFromDate } = trainingVolumeBrief(plan);
  const s = ui[locale].summaryExport;
  return fill(s.trainingBrief, {
    volLo: volRange[0],
    volHi: volRange[1],
    week: taperFromWeek,
    date: taperFromDate,
  });
}

const MILESTONE_TESTS = [
  { week: 4, key: 'k3' as const, dist: 3, kmLabel: '3 km' },
  { week: 8, key: 'k5' as const, dist: 5, kmLabel: '5 km' },
  { week: 10, key: 'k10' as const, dist: 10, kmLabel: '10 km' },
];

function splitLabel(locale: Locale, split: SplitKey, sigma: number): string {
  const s = ui[locale].summaryExport;
  const sp = ui[locale].split;
  if (split === 'jevn') return s.splitJevn;
  const name = split === 'negativ' ? sp.negativ : sp.positiv;
  return fill(s.splitNamed, { name, sigma: sigma.toFixed(1).replace('.', locale === 'nb' ? ',' : '.') });
}

function milestoneDay(week: number): Date {
  return addDays(WEEK1, (week - 1) * 7 + 5);
}

export type MilestoneSummary = {
  title: string;
  date: Date;
  dateLabel: string;
  daysBefore: number;
  distKm: number;
  targetRange: string;
  paceHint: string;
  icsFilename: string;
};

export function milestoneSummaries(plan: Plan, locale: Locale): MilestoneSummary[] {
  const hit = lookupMilestones(plan.input.full, plan.input.T);
  const titles = ui[locale].summaryExport.milestoneTitles;
  const paceTpl = ui[locale].summaryExport.paceHint;
  return MILESTONE_TESTS.map((t, i) => {
    const rng = hit[t.key];
    const date = milestoneDay(t.week);
    const daysBefore = Math.round((RACE.getTime() - date.getTime()) / 86400000);
    return {
      title: titles[i] ?? `M${i + 1}`,
      date,
      dateLabel: dateDM(date),
      daysBefore,
      distKm: t.dist,
      targetRange: rngT(rng[0], rng[1]),
      paceHint: fill(paceTpl, { pace: fmtP(rng[1] / t.dist) }),
      icsFilename: `bcm-2027-${t.kmLabel.replace(' ', '')}-test.ics`,
    };
  });
}

export function buildPlanSummaryText(plan: Plan, state: PlanState, locale: Locale): string {
  const full = plan.input.full;
  const c = ui[locale].common;
  const s = ui[locale].summaryExport;
  const dist = full ? c.full : c.half;
  const distKm = full ? s.distKmFull : s.distKmHalf;
  const goal = fmtT(plan.input.T);
  const start = plan.input.start;
  const raceStart = full ? '07.45' : '09.00';
  const hit = lookupMilestones(full, plan.input.T);
  const milestones = milestoneSummaries(plan, locale);
  const hill = hillCopy(locale, state.hill as HillKey);

  const lines: string[] = [
    s.header,
    '========================',
    '',
    `${ui[locale].oppsummering.dl.distance}: ${dist} (${distKm})`,
    `${ui[locale].oppsummering.dl.targetTime}: ${goal}`,
    fill(s.startLine, { time: raceStart }),
    `${ui[locale].oppsummering.dl.finishPlan}: ca. kl. ${clockDot(start, plan.input.T)}`,
    '',
    s.tempoSection,
    '-----------------',
    `${ui[locale].oppsummering.dl.avgFlat}: ${fmtP(plan.input.T / plan.D)}/km`,
    `Flat p₀: ${fmtP(plan.p0)}/km`,
    splitLabel(locale, state.split, state.sigma),
    `${ui[locale].oppsummering.strategy.hills} ${hill.l} – ${hill.t}`,
    state.drink
      ? fill(s.drinkOn, { sec: state.stopOn, total: Math.round(plan.S) })
      : fill(s.drinkOff, { total: Math.round(plan.S) }),
    '',
    s.planSection,
    '----------------------',
    s.planNote,
    `${s.halfway}: ${fmtT(plan.tAt(plan.D / 2))} · ${s.finish}: ${goal}.`,
    '',
    s.milestonesSection,
    '----------------------------------------',
    `VDOT ≈ ${hit.vdot.toFixed(1).replace('.', locale === 'nb' ? ',' : '.')}`,
  ];

  const daysLabel = locale === 'en' ? 'days before race' : 'dager før løpet';
  for (const m of milestones) {
    lines.push(
      '',
      `${m.title} – ${m.dateLabel} (${m.daysBefore} ${daysLabel})`,
      `${m.distKm} km ${locale === 'en' ? 'in' : 'på'} ${m.targetRange} (${m.paceHint})`,
    );
  }

  lines.push('', s.trainingSection, '-------', formatTrainingBrief(plan, locale));

  lines.push('', s.generated);
  const gu = guideUrl();
  if (gu) lines.push(gu);

  return lines.join('\n');
}

export function buildFacebookPost(plan: Plan, state: PlanState, locale: Locale): string {
  const c = ui[locale].common;
  const s = ui[locale].summaryExport;
  const sp = ui[locale].split;
  const dist = plan.input.full ? c.full.toLowerCase() : c.half.toLowerCase();
  const goal = fmtT(plan.input.T);
  const milestones = milestoneSummaries(plan, locale);
  const mLines = milestones.map((m) => `• ${m.dateLabel}: ${m.distKm} km (${m.targetRange})`).join('\n');
  const { volRange, taperFromWeek, taperFromDate } = trainingVolumeBrief(plan);
  const hill = hillCopy(locale, state.hill as HillKey);

  const splitText =
    state.split === 'jevn' ? `${sp.jevn} split` : `${sp[state.split as keyof typeof sp]} split`;

  return [
    s.fbTitle,
    '',
    `${dist.charAt(0).toUpperCase() + dist.slice(1)} ${locale === 'en' ? 'in' : 'på'} ${goal}.`,
    `${hill.l} ${locale === 'en' ? 'on hills' : 'i bakkene'}, ${splitText}.`,
    `${locale === 'en' ? 'Flat pace' : 'Flatfart'} ca. ${fmtP(plan.p0)}/km.`,
    `${locale === 'en' ? 'Training' : 'Trening'} ca. ${volRange[0]}–${volRange[1]} km/${locale === 'en' ? 'wk' : 'uke'} · ${locale === 'en' ? 'taper from week' : 'nedtrapping fra uke'} ${taperFromWeek} (${taperFromDate}).`,
    '',
    s.fbTests,
    mLines,
    '',
    `${ui[locale].common.officialSite} ${BCM_URL}`,
  ].join('\n');
}

/** CET/CEST: enkel offset for milepæler (feb–apr 2027). */
function localToUtcIcs(d: Date, hour: number, minute: number): string {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const dst = month >= 2 && month <= 9;
  const offset = dst ? 2 : 1;
  let uh = hour - offset;
  let ud = day;
  if (uh < 0) {
    uh += 24;
    ud -= 1;
  }
  return `${y}${String(mo).padStart(2, '0')}${String(ud).padStart(2, '0')}T${String(uh).padStart(2, '0')}${String(minute).padStart(2, '0')}00Z`;
}

export function buildMilestoneIcs(m: MilestoneSummary, plan: Plan, locale: Locale): string {
  const start = localToUtcIcs(m.date, 9, 0);
  const end = localToUtcIcs(m.date, 10, 0);
  const dist = plan.input.full ? ui[locale].common.full.toLowerCase() : ui[locale].common.half.toLowerCase();
  const desc = [
    `BCM 2027 – ${m.title}`,
    `${locale === 'en' ? 'Goal' : 'Mål'}: ${fmtT(plan.input.T)} (${dist})`,
    `${locale === 'en' ? 'Test' : 'Test'}: ${m.distKm} km ${locale === 'en' ? 'in' : 'på'} ${m.targetRange} (${m.paceHint})`,
    BCM_URL,
  ].join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BCM Lopeguide//NO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:bcm27-${m.dateLabel}-${m.distKm}km@lopeguide`,
    `DTSTAMP:${localToUtcIcs(new Date(), 12, 0)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:BCM test ${m.distKm} km (${m.targetRange})`,
    `DESCRIPTION:${desc}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { BCM_URL };
