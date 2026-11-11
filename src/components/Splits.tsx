import { Fragment } from 'react';
import { Printer, Droplet } from 'lucide-react';
import {
  BAND_FULL,
  BAND_HALF,
  LAP,
  REF_COLS_FULL,
  REF_COLS_HALF,
  REF_FULL,
  REF_HALF,
  TERR,
  type TerrKey,
} from '../config';
import { clockDot, clockS, fmtP, fmtT, kmL, nb, sgn, sgnS } from '../lib/format';
import { buildPlan, gradeOf, type Plan } from '../lib/model';
import { elevAt, type Pt } from '../lib/gpx';
import { PaceChartCard } from './chart';
import { useActivePlan } from '../state/active';
import { useCourse } from '../state/course';
import { StepContinue } from './StepContinue';
import type { UiCopy } from '../i18n/ui';
import { useUi } from '../i18n/useUi';
import { usePreviewLocale } from '../state/previewLocale';
import { splitMarks, terrOf } from '../lib/marks';
import { guideAttention, scrollToView, usePlan } from '../state/plan';

export function Splits() {
  const { state, patch } = usePlan();
  const { plan } = useActivePlan();
  const course = useCourse();
  const m = useUi();
  if (!plan) return <p className="intro">{m.splits.loading}</p>;

  function goToMilepaeler() {
    patch({ view: 'mile' });
    scrollToView('mile');
  }

  return (
    <section className="section" aria-labelledby="mellom-tittel">
      <h2 id="mellom-tittel">{m.splits.h2}</h2>
      <div className="subtabs" role="tablist" aria-label={m.splits.tablist}>
        {(
          [
            ['seg', m.splits.tabSeg],
            ['km', m.splits.tabKm],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={state.tab === id} className={state.tab === id ? 'is-on' : ''} onClick={() => patch({ tab: id })}>
            {label}
          </button>
        ))}
      </div>
      {state.tab === 'seg' && <Segments plan={plan} marks={m.marks} terrain={m.terrain} copy={m.splits} />}
      {state.tab === 'km' && <PerKm plan={plan} copy={m.splits} />}
      <Reference plan={plan} points={course.points} copy={m.splits} marks={m.marks} />
      <StepContinue
        id="splits-step-continue"
        step={4}
        phrase={m.stepContinue.goTo.replace('{n}', '4')}
        attention={guideAttention(state) === 4}
        onClick={goToMilepaeler}
      />
      <div className="legend-row" aria-hidden="true">
        <span><i className="swatch pace" /> {m.splits.legendPace}</span>
        <span><i className="swatch gap" /> {m.splits.legendGap}</span>
        <span><i className="swatch elev" /> {m.splits.legendElev}</span>
      </div>
      <PaceChartCard plan={plan} points={course.points} />
    </section>
  );
}

function Segments({
  plan,
  marks,
  terrain,
  copy,
}: {
  plan: Plan;
  marks: UiCopy['marks'];
  terrain: UiCopy['terrain'];
  copy: UiCopy['splits'];
}) {
  const full = plan.input.full;
  const m = splitMarks(full, marks);
  const segs = [];
  for (let i = 1; i < m.length; i++) segs.push({ a: m[i - 1].km, b: m[i].km, name: m[i].name });
  const r1 = segs.filter((s) => s.b <= LAP + 0.001);
  const r2 = segs.filter((s) => s.b > LAP + 0.001);

  const row = (s: { a: number; b: number; name: string }) => {
    const g = plan.agg(s.a, s.b);
    const grade = gradeOf(g);
    const terr = terrOf(s.a, s.b, grade);
    const pace = g.len ? (g.t + g.stops) / g.len : 0;
    const cum = plan.tAt(s.b);
    const dev = cum - s.b * (plan.input.T / plan.D);
    const meta = TERR[terr];
    return (
      <tr key={`${s.a}-${s.name}`} style={{ background: meta.bg }}>
        <td className="lead-time">{fmtT(cum)}</td>
        <th scope="row" className="seg-label">
          <span className="seg-name">{s.name}</span>
          <span className="chip" style={{ background: meta.chipBg, color: meta.chipFg }}>{terrain[terr]}</span>
          <span className="km-range">
            {copy.kmRange.replace('{a}', kmL(s.a)).replace('{b}', kmL(s.b))}
          </span>
        </th>
        <td>{fmtT(g.t + g.stops)}</td>
        <td>{fmtP(pace)}</td>
        <td>{clockS(plan.input.start, cum)}</td>
        <td className={dev < -0.5 ? 'ahead' : 'behind'}>{sgnS(dev)}</td>
        <td>{sgn(grade)}</td>
        <td>{Math.round(g.len * 1000)}</td>
      </tr>
    );
  };

  const sum = (a: number, b: number, title: string) => {
    const g = plan.agg(a, b);
    return (
      <tr key={title} className="sum">
        <td className="lead-time">{fmtT(plan.tAt(b))}</td>
        <th scope="row" className="seg-label">{title}</th>
        <td>{fmtT(g.t + g.stops)}</td>
        <td>{fmtP(g.len ? (g.t + g.stops) / g.len : 0)}</td>
        <td>{clockS(plan.input.start, plan.tAt(b))}</td>
        <td>{sgnS(plan.tAt(b) - b * (plan.input.T / plan.D))}</td>
        <td>{sgn(gradeOf(g))}</td>
        <td>{Math.round(g.len * 1000)}</td>
      </tr>
    );
  };

  return (
    <>
      <div className="chips">
        {(Object.keys(TERR) as TerrKey[]).map((k) => (
          <span key={k} className="chip" style={{ background: TERR[k].chipBg, color: TERR[k].chipFg }}>{terrain[k]}</span>
        ))}
        <span className="help">{copy.devHelp}</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {copy.segHeaders.map((h) => (
                <th key={h} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {full ? (
              <>
                <tr className="round"><th colSpan={copy.segHeaders.length}>{copy.round1}</th></tr>
                {r1.map(row)}
                {sum(0, LAP, copy.sumRound1)}
                <tr className="round"><th colSpan={copy.segHeaders.length}>{copy.round2}</th></tr>
                {r2.map(row)}
                {sum(LAP, plan.D, copy.sumRound2)}
              </>
            ) : (
              segs.map(row)
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PerKm({ plan, copy }: { plan: Plan; copy: UiCopy['splits'] }) {
  const rows = [];
  for (let a = 0; a < plan.D - 1e-6; a += 1) {
    const b = Math.min(plan.D, a + 1);
    const g = plan.agg(a, b);
    const grade = gradeOf(g);
    const pace = g.len ? (g.t + g.stops) / g.len : 0;
    const gap = g.fd ? g.t / g.fd : 0;
    const steep = Math.abs(grade) >= 3;
    const label = Math.abs(b - plan.D) < 0.02 && b - a < 0.999 ? kmL(b) : String(Math.round(a + 1));
    rows.push({ a, b, g, grade, pace, gap, steep, label });
  }
  return (
    <div className="table-wrap">
      <table className="data km">
        <thead>
          <tr>
            {copy.kmHeaders.map((h) => (
              <th key={h} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cum = plan.tAt(r.b);
            const band = plan.input.full && r.a === 21;
            return (
              <Fragment key={r.a}>
                {band && (
                  <tr className="cut-band">
                    <td colSpan={9}>{copy.cutBand}</td>
                  </tr>
                )}
                <tr className={r.steep ? 'steep' : ''}>
                  <td className="lead-time">{fmtP(r.pace)}</td>
                  <th scope="row">{r.label}</th>
                  <td className={r.steep ? 'hot' : ''}>{sgn(r.grade)}</td>
                  <td>{sgn(r.g.up - r.g.dn, 0)}</td>
                  <td>{nb(r.g.len ? r.g.fd / r.g.len : 0, 3)}</td>
                  <td>{fmtP(r.gap)}</td>
                  <td>{fmtT(cum)}</td>
                  <td>{clockS(plan.input.start, cum)}</td>
                  <td>{r.g.stops > 0 && <span className="drop"><Droplet size={14} /> {copy.drinkSec.replace('{sec}', String(Math.round(r.g.stops)))}</span>}</td>
                </tr>
                {r.steep && (
                  <tr className="steep-note">
                    <td colSpan={9}>
                      {copy.steepNote
                        .replace('{km}', r.label)
                        .replace('{grade}', sgn(r.grade))
                        .replace('{pace}', fmtP(r.pace))
                        .replace('{gap}', fmtP(r.gap))}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type ArmbandPrintButtonProps = {
  className?: string;
  variant?: 'primary' | 'band';
};

export function ArmbandPrintButton({ className = '', variant = 'band' }: ArmbandPrintButtonProps) {
  const label = useUi().armband.print;
  const styleClass = variant === 'primary' ? 'btn primary' : 'btn oppsummering-band-print';
  return (
    <button type="button" className={`no-print ${styleClass} ${className}`.trim()} onClick={() => window.print()}>
      <Printer size={17} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  );
}

export function ArmbandCard({ plan }: { plan: Plan }) {
  const ui = useUi();
  const rows = plan.input.full ? BAND_FULL : BAND_HALF;
  const hill = ui.hills[plan.input.hill].label;
  const split = ui.split[plan.input.split];
  return (
    <article id="armband" className="oppsummering-armband">
      <header>
        <p>BCM 2027 · {plan.input.full ? ui.common.full : ui.common.half}</p>
        <b>{fmtT(plan.input.T)}</b>
      </header>
      <ul>
        {rows.map(([km, name]) => {
          const hi = name === ui.marks.halfwayCutoff || name === ui.marks.finish || /Halvveis|Mål|Halfway|Finish/.test(name);
          return (
            <li key={name + km} className={hi ? 'hi' : ''}>
              <span>
                <strong>{kmL(km)}</strong>
                <em>{name}</em>
              </span>
              <b>{fmtT(plan.tAt(km))}</b>
              <small>{clockDot(plan.input.start, plan.tAt(km))}</small>
            </li>
          );
        })}
      </ul>
      <footer>
        <span>
          {ui.splits.armbandFlat
            .replace('{pace}', fmtP(plan.p0))
            .replace('{hill}', hill)
            .replace('{split}', split)}
        </span>
        <span>{ui.splits.armbandStart.replace('{time}', plan.input.start.replace(':', '.'))}</span>
      </footer>
    </article>
  );
}

function Band({ plan }: { plan: Plan }) {
  return (
    <div className="band-wrap">
      <ArmbandCard plan={plan} />
      <ArmbandPrintButton variant="primary" />
    </div>
  );
}

export function Wristband() {
  const { plan } = useActivePlan();
  const m = useUi();
  if (!plan) return <p className="intro">{m.splits.wristLoading}</p>;
  return (
    <section className="section" aria-labelledby="band-tittel">
      <h2 id="band-tittel">{m.splits.wristH2}</h2>
      <p className="intro">{m.splits.wristIntro}</p>
      <Band plan={plan} />
    </section>
  );
}

function Reference({
  plan,
  points,
  copy,
  marks,
}: {
  plan: Plan;
  points: Pt[];
  copy: UiCopy['splits'];
  marks: UiCopy['marks'];
}) {
  const { locale } = usePreviewLocale();
  const full = plan.input.full;
  const targets = full ? REF_FULL : REF_HALF;
  const cols = full ? REF_COLS_FULL : REF_COLS_HALF;
  const rows = targets.map((T) => {
    const p = buildPlan(
      (k) => elevAt(points, k),
      {
        full,
        T,
        split: 'jevn',
        sigma: 0,
        hill: 'middels',
        stopSec: 2,
        start: plan.input.start,
      },
      locale,
    );
    return { T, p };
  });
  const strategies = full
    ? ([
        [copy.sub3Strategies[0], 'middels', 'jevn', 0],
        [copy.sub3Strategies[1], 'sakte', 'jevn', 0],
        [copy.sub3Strategies[2], 'fort', 'jevn', 0],
        [copy.sub3Strategies[3], 'middels', 'negativ', 2],
        [copy.sub3Strategies[4], 'sakte', 'negativ', 2],
        [copy.sub3Strategies[5], 'middels', 'positiv', 2],
      ] as const)
    : [];

  return (
    <details className="explain">
      <summary>{copy.refTitle}</summary>
      <p className="help">{copy.refHelp}</p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">{copy.refGoal}</th>
              {cols.map((c) => (
                <th key={c} scope="col">{Math.abs(c - (full ? LAP * 2 : LAP)) < 0.01 ? marks.finish : kmL(c)}</th>
              ))}
              <th scope="col">{copy.refFlat}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ T, p }) => (
              <tr key={T} className={Math.abs(T - plan.input.T) <= 60 ? 'is-you' : ''}>
                <th scope="row">{fmtT(T)}</th>
                {cols.map((c) => (
                  <td key={c}>{fmtT(p.tAt(c))}</td>
                ))}
                <td>{fmtP(p.p0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {full && (
        <>
          <h3>{copy.sub3Title}</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">{copy.sub3Strategy}</th>
                  <th scope="col">{copy.sub3Km5}</th>
                  <th scope="col">{copy.sub3Km10}</th>
                  <th scope="col">{copy.sub3Km211}</th>
                  <th scope="col">{copy.refFlat}</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map(([label, hill, split, sigma]) => {
                  const p = buildPlan(
                    (k) => elevAt(points, k),
                    {
                      full: true,
                      T: 10800,
                      split,
                      sigma,
                      hill,
                      stopSec: 2,
                      start: '07:45',
                    },
                    locale,
                  );
                  return (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{fmtT(p.tAt(5))}</td>
                      <td>{fmtT(p.tAt(10))}</td>
                      <td>{fmtT(p.tAt(LAP))}</td>
                      <td>{fmtP(p.p0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}
