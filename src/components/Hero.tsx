import { useEffect, useRef, useState } from 'react';
import { CalendarRange, ClipboardList, Flag, Route, Timer, type LucideIcon } from 'lucide-react';
import { RACE_START } from '../config';
import { LAP } from '../config';
import { elevAt } from '../lib/gpx';
import { useCourse } from '../state/course';
import { useUi } from '../i18n/useUi';
import { useMobileLayout } from '../state/previewLocale';
import { guideAttention, scrollToStepRail, usePlan, type PlanState } from '../state/plan';

function Countdown({ dist }: { dist: 'half' | 'full' }) {
  const m = useUi();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const target = new Date(RACE_START[dist]).getTime();
  const diff = Math.max(0, target - now);
  const u = m.hero.countdown.units;
  const parts: [string, number][] = [
    [u.days, Math.floor(diff / 86400000)],
    [u.hours, Math.floor((diff % 86400000) / 3600000)],
    [u.minutes, Math.floor((diff % 3600000) / 60000)],
    [u.seconds, Math.floor((diff % 60000) / 1000)],
  ];
  return (
    <>
      <p className="count-label">
        {diff === 0 ? m.hero.countdown.started : dist === 'full' ? m.hero.countdown.untilFull : m.hero.countdown.untilHalf}
      </p>
      <div className="count-boxes">
        {parts.map(([l, n]) => (
          <div key={l} className="count-box">
            <b>{String(n).padStart(2, '0')}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const STEP_ICONS: LucideIcon[] = [Flag, Timer, Route, CalendarRange, ClipboardList];
const STEP_VIEWS: PlanState['view'][] = ['distanse', 'plan', 'splits', 'mile', 'oppsummering'];
const PLACE_KM = [0, 3.2, 6.2, 14, LAP - 2, LAP] as const;

export function Hero() {
  const { state, patch } = usePlan();
  const course = useCourse();
  const m = useUi();
  const mobileLayout = useMobileLayout();
  const stepLabels = mobileLayout ? m.hero.stepsShort : m.hero.steps;
  const attention = guideAttention(state);

  function goToStep(view: PlanState['view']) {
    patch({ view });
    scrollToStepRail();
  }

  return (
    <section className="hero">
      <div className="hero-grid">
        <div>
          <p className="kicker">{m.hero.kicker}</p>
          <h1>{m.hero.h1}</h1>
        </div>
        <div className="hero-side">
          <Countdown dist={state.dist} />
          {course.status === 'loading' ? (
            <p className="badge wait">{m.hero.course.loading}</p>
          ) : course.status === 'ok' ? (
            <p className="badge ok">{m.hero.course.ok}</p>
          ) : (
            <p className="badge warn">{m.hero.course.warn}</p>
          )}
          {course.error && (
            <p className="hero-error" role="alert">
              {course.error}
            </p>
          )}
        </div>
        <ol className="steps" aria-label={m.hero.stepsAria}>
          {stepLabels.map((text, i) => {
            const Icon = STEP_ICONS[i]!;
            const view = STEP_VIEWS[i]!;
            const live = attention === i + 1;
            return (
              <li key={text}>
                <button
                  type="button"
                  className={`step-card${live ? ' is-attention' : ''}`}
                  onClick={() => goToStep(view)}
                  aria-label={m.hero.stepAria
                    .replace('{n}', String(i + 1))
                    .replace('{text}', m.hero.steps[i] ?? text)}
                >
                  <span className="step-ico">
                    <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                    <span className="step-n">{i + 1}</span>
                  </span>
                  <span className="step-text">{text}</span>
                  {live && !mobileLayout && (
                    <span className="step-action" aria-hidden="true">
                      {m.hero.stepAction}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {course.points.length > 10 && <Spark />}
    </section>
  );
}

function Spark() {
  const course = useCourse();
  const m = useUi();
  const places = m.hero.places;
  const svgRef = useRef<SVGSVGElement>(null);
  const runRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const runnerFigRef = useRef<SVGGElement>(null);
  const labelRef = useRef<SVGTextElement>(null);
  const applyRef = useRef<(t: number) => void>(() => {});
  const tRef = useRef(0);
  const scrubbing = useRef(false);
  const holdUntil = useRef(0);
  const W = 1000;
  const H = 78;
  const pad = 48;
  /** Luft mellom hvit prikk og strekmann (viewBox-enheter). */
  const runnerGap = 12;
  const pts = course.points.filter((_, i) => i % 4 === 0);
  const Y = (e: number) => 8 + (1 - Math.min(e, 150) / 150) * 46;
  const X = (k: number) => pad + (k / LAP) * (W - pad * 2);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.km).toFixed(1)},${Y(p.ele).toFixed(1)}`).join(' ');

  useEffect(() => {
    const run = runRef.current;
    const dot = dotRef.current;
    const runnerFig = runnerFigRef.current;
    const label = labelRef.current;
    if (!run || !dot || !d) return;
    const len = run.getTotalLength();
    const apply = (t: number) => {
      const clamped = Math.min(1, Math.max(0, t));
      run.style.strokeDasharray = `${len}`;
      run.style.strokeDashoffset = `${len * (1 - clamped)}`;
      const at = Math.max(0, len * clamped - 0.01);
      const p = run.getPointAtLength(at);
      dot.setAttribute('cx', p.x.toFixed(1));
      dot.setAttribute('cy', p.y.toFixed(1));
      runnerFig?.setAttribute(
        'transform',
        `translate(${p.x.toFixed(1)},${(p.y - runnerGap).toFixed(1)})`,
      );
      if (label) {
        const km = (clamped * LAP).toFixed(1).replace('.', ',');
        label.textContent = `${km} km`;
        const flip = p.x > W * 0.78;
        label.setAttribute('x', (flip ? p.x - 10 : p.x + 10).toFixed(1));
        label.setAttribute('y', Math.max(12, p.y - runnerGap - 30).toFixed(1));
        label.setAttribute('text-anchor', flip ? 'end' : 'start');
      }
      svgRef.current?.setAttribute('aria-valuenow', String(Math.round(clamped * LAP * 10) / 10));
    };
    applyRef.current = apply;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      apply(1);
      return;
    }
    apply(tRef.current);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!scrubbing.current) {
        if (holdUntil.current > now) {
          apply(1);
        } else {
          tRef.current += dt / 18000;
          if (tRef.current >= 1) {
            tRef.current = 1;
            holdUntil.current = now + 700;
          }
          if (holdUntil.current && now > holdUntil.current) {
            tRef.current = 0;
            holdUntil.current = 0;
          }
          apply(tRef.current);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [d]);

  const scrub = (clientX: number) => {
    const svg = svgRef.current;
    const run = runRef.current;
    if (!svg || !run) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    tRef.current = Math.min(1, Math.max(0, (x - pad) / (W - pad * 2)));
    holdUntil.current = 0;
    applyRef.current(tRef.current);
  };

  return (
    <svg
      ref={svgRef}
      className="spark"
      viewBox={`0 0 ${W} ${H}`}
      overflow="visible"
      role="slider"
      aria-label={m.hero.sparkAria}
      aria-valuemin={0}
      aria-valuemax={21.1}
      aria-valuenow={0}
      tabIndex={0}
      onPointerDown={(e) => {
        scrubbing.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        scrub(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' || scrubbing.current) {
          scrubbing.current = true;
          scrub(e.clientX);
        }
      }}
      onPointerUp={() => {
        scrubbing.current = false;
      }}
      onPointerLeave={() => {
        scrubbing.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        scrubbing.current = true;
        tRef.current = Math.min(1, Math.max(0, tRef.current + (e.key === 'ArrowRight' ? 0.02 : -0.02)));
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        scrub(rect.left + ((pad + tRef.current * (W - pad * 2)) / W) * rect.width);
        window.setTimeout(() => {
          scrubbing.current = false;
        }, 1200);
      }}
    >
      <path className="track" d={d} />
      <path ref={runRef} className="run" d={d} />
      {PLACE_KM.map((k, i) => {
        const name = places[i] ?? '';
        const last = i === PLACE_KM.length - 1;
        const anchor = i === 0 ? 'start' : last ? 'end' : 'middle';
        const x = i === 0 ? 8 : last ? W - 8 : X(k);
        return (
          <g key={`${name}-${k}`}>
            <circle cx={X(k)} cy={Y(elevAt(course.points, k))} r={3} />
            <text x={x} y={H - 6} textAnchor={anchor}>
              {name}
            </text>
          </g>
        );
      })}
      <circle ref={dotRef} className="runner" r={5.5} cx={X(0)} cy={Y(elevAt(course.points, 0))} />
      <g
        ref={runnerFigRef}
        className="runner-fig"
        aria-hidden="true"
        pointerEvents="none"
        transform={`translate(${X(0)},${Y(elevAt(course.points, 0)) - runnerGap})`}
      >
        <circle className="runner-head" cx="0" cy="-22" r="4" fill="#fff" stroke="#c43d0a" strokeWidth={1.25} />
        <path
          className="runner-body"
          d="M0 -18 V -9 M0 -15.5 L -8 -12 M0 -15.5 L 8 -12 M0 -9 L -7 0 M0 -9 L 7 0"
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text ref={labelRef} className="spark-km" x={X(0) + 10} y={12}>
        0,0 km
      </text>
    </svg>
  );
}
