import { useEffect, useState } from 'react';
import { Clock, Droplet, Flag, Gauge, Info, type LucideIcon } from 'lucide-react';
import { MAX_TIME, QUICK } from '../config';
import type { HillKey, SplitKey } from '../config';
import { hillCopy } from '../i18n/hills';
import { clockDot, fmtP, fmtT, parseT, quickLabel, sgnS } from '../lib/format';
import { WINNERS, type WinnerGender } from '../lib/winners';
import { useActivePlan } from '../state/active';
import { StepContinue } from './StepContinue';
import { useUi } from '../i18n/useUi';
import { usePreviewLocale } from '../state/previewLocale';
import { scrollToView, timeIsSet, usePlan } from '../state/plan';

const TIME_RANGE = {
  half: { min: 60 * 60, max: MAX_TIME.half },
  full: { min: 2 * 3600, max: MAX_TIME.full },
} as const;

function TimeSlider({
  dist,
  seconds,
  pending,
  onChange,
  copy,
}: {
  dist: 'half' | 'full';
  seconds: number;
  pending: boolean;
  onChange: (sec: number) => void;
  copy: ReturnType<typeof useUi>['tempoPlan'];
}) {
  const { min, max } = TIME_RANGE[dist];
  const minM = min / 60;
  const maxM = max / 60;
  const value = Math.min(maxM, Math.max(minM, Math.round(seconds / 60)));
  return (
    <label className={`slider${pending ? ' is-pending' : ''}`}>
      <span>{pending ? copy.finishTimeUnset : copy.finishTime.replace('{time}', fmtT(seconds))}</span>
      <input
        type="range"
        min={minM}
        max={maxM}
        step={1}
        value={value}
        aria-label={copy.finishTimeAria}
        aria-valuemin={minM}
        aria-valuemax={maxM}
        aria-valuenow={value}
        aria-valuetext={fmtT(value * 60)}
        onChange={(e) => onChange(Number(e.target.value) * 60)}
      />
      <span className="time-ends">
        <span>{fmtT(min)}</span>
        <span>{fmtT(max)}</span>
      </span>
    </label>
  );
}

export function TempoPlan() {
  const { state, patch } = usePlan();
  const { plan } = useActivePlan();
  const T = state.dist === 'full' ? state.targetFull : state.targetHalf;
  const timeSet = timeIsSet(state);
  const [focus, setFocus] = useState(false);
  const [draft, setDraft] = useState(timeSet ? fmtT(T) : '');
  const [bad, setBad] = useState(false);
  const [step2Error, setStep2Error] = useState(false);
  const [winnersOpen, setWinnersOpen] = useState(false);
  useEffect(() => {
    if (!focus) setDraft(timeSet ? fmtT(T) : '');
  }, [T, focus, state.dist, timeSet]);

  const m = useUi();
  const tp = m.tempoPlan;
  const { locale } = usePreviewLocale();
  if (!plan) return <p className="intro">{tp.loading}</p>;

  const quick = QUICK[state.dist];
  const t5 = plan.tAt(5);
  const even5 = 5 * (plan.input.T / plan.D);
  const diff = t5 - even5;
  const deltaStr = sgnS(diff).replace('+', '').replace('−', '−');
  const behind =
    Math.abs(diff) < 0.5
      ? tp.paceEven
      : diff > 0
        ? tp.paceBehind.replace('{delta}', deltaStr)
        : tp.paceAhead.replace('{delta}', deltaStr.replace('−', ''));
  const halfT = plan.tAt(plan.D / 2);
  const nStops = plan.stations.length;

  function setTarget(sec: number) {
    setBad(false);
    setStep2Error(false);
    setDraft(fmtT(sec));
    patch(
      state.dist === 'full'
        ? { targetFull: sec, timeSetFull: true }
        : { targetHalf: sec, timeSetHalf: true },
    );
  }

  function goToLopeplan() {
    if (!timeSet) {
      setStep2Error(true);
      return;
    }
    setStep2Error(false);
    patch({ view: 'splits' });
    scrollToView('splits');
  }

  return (
    <section className="section tempo-section" aria-labelledby="tempo-tittel">
      <h2 id="tempo-tittel">{tp.h2}</h2>
      <p className="intro tempo-intro">{tp.intro}</p>
      <div className="split-2 tempo-split-2">
        <div className="card tempo-form-card">
          <div className="tempo-form-top">
            <label className="lbl" htmlFor="maal">
              {tp.targetLabel}
            </label>
            <div className="target-row">
              <input
                id="maal"
                className={`target ${bad ? 'bad' : ''}`}
                inputMode="numeric"
                aria-invalid={bad}
                placeholder={tp.unsetTime}
                value={focus || !timeSet ? draft : fmtT(T)}
                onFocus={() => {
                  setFocus(true);
                  setDraft(timeSet ? fmtT(T) : draft);
                }}
                onBlur={() => {
                  setFocus(false);
                  if (!draft.trim()) {
                    setBad(false);
                    patch(state.dist === 'full' ? { timeSetFull: false } : { timeSetHalf: false });
                    return;
                  }
                  const p = parseT(draft);
                  if (p == null || p <= 0) setBad(true);
                  else setTarget(p);
                }}
                onChange={(e) => {
                  setDraft(e.target.value);
                  const p = parseT(e.target.value);
                  setBad(e.target.value.trim() !== '' && p == null);
                  if (p != null && p > 0) setTarget(p);
                }}
              />
              {timeSet && <span className="hint">{tp.targetAvg.replace('{pace}', fmtP(T / plan.D))}</span>}
            </div>
            <div className="pills" role="group" aria-label={tp.quickGroup}>
              {quick.map((s) => (
                <button key={s} type="button" className={`pill ${timeSet && T === s ? 'on' : ''}`} onClick={() => setTarget(s)}>
                  {quickLabel(s)}
                </button>
              ))}
              <button
                type="button"
                className={`pill pill-winners${winnersOpen ? ' is-open' : ''}`}
                aria-expanded={winnersOpen}
                onClick={() => setWinnersOpen((open) => !open)}
              >
                {tp.fromWinners}
              </button>
            </div>
            {winnersOpen && (
              <div className="winner-picks">
                {(['men', 'women'] as WinnerGender[]).map((gender) => (
                  <div key={gender} className="winner-group" role="group" aria-label={gender === 'men' ? tp.winnersMen : tp.winnersWomen}>
                    <p className="winner-gender">{gender === 'men' ? tp.winnersMen : tp.winnersWomen}</p>
                    {WINNERS[state.dist]
                      .filter((w) => w.gender === gender)
                      .map((w) => {
                        const on = timeSet && T === w.seconds;
                        return (
                          <button
                            key={`${w.gender}-${w.year}-${w.name}`}
                            type="button"
                            className={`winner-pick${on ? ' on' : ''}`}
                            aria-pressed={on}
                            aria-label={tp.winnerPickAria
                              .replace('{name}', w.name)
                              .replace('{year}', String(w.year))
                              .replace('{time}', w.time)}
                            onClick={() => setTarget(w.seconds)}
                          >
                            <span className="winner-name">
                              {w.name} <span className="winner-year">{w.year}</span>
                            </span>
                            <b>{w.time}</b>
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            )}
            <TimeSlider dist={state.dist} seconds={T} pending={!timeSet} onChange={setTarget} copy={tp} />
          </div>

          <div className="tempo-form-mid">
            <div className="tempo-form-cell">
              <p className="lbl">{tp.labels.split}</p>
              <div className="seg" role="group" aria-label={tp.labels.split}>
                {(['negativ', 'jevn', 'positiv'] as SplitKey[]).map((k) => (
                  <button key={k} type="button" aria-pressed={state.split === k} onClick={() => patch({ split: k })}>
                    {m.split[k]}
                  </button>
                ))}
              </div>
              <label className={`slider ${state.split === 'jevn' ? 'off' : ''}`}>
                <span>{tp.splitSigma.replace('{sigma}', state.sigma.toFixed(1).replace('.', locale === 'nb' ? ',' : '.'))}</span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={state.sigma}
                  disabled={state.split === 'jevn'}
                  onChange={(e) => patch({ sigma: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="tempo-form-cell">
              <p className="lbl">{tp.labels.hill}</p>
              <div className="seg" role="group" aria-label={tp.labels.hill} title={hillCopy(locale, state.hill).t}>
                {(['fort', 'middels', 'sakte'] as HillKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={state.hill === k}
                    title={hillCopy(locale, k).t}
                    onClick={() => patch({ hill: k })}
                  >
                    {hillCopy(locale, k).l}
                  </button>
                ))}
              </div>
              <p className="help tempo-hill-hint">{hillCopy(locale, state.hill).t}</p>
            </div>
          </div>

          <div className="tempo-form-foot">
            <div className="drink-row">
              <span className="lbl">{tp.labels.drink}</span>
              <button
                type="button"
                className={`switch ${state.drink ? 'on' : ''}`}
                role="switch"
                aria-checked={state.drink}
                aria-label={tp.drinkAria}
                onClick={() => patch({ drink: !state.drink })}
              />
              <input
                className="stop"
                type="number"
                min={0}
                max={120}
                aria-label={tp.stopSecAria}
                disabled={!state.drink}
                value={state.stopOn}
                onChange={(e) => patch({ stopOn: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })}
              />
              <span className="hint">{tp.secPerStop}</span>
            </div>
            <div className="tempo-start">
              <label className="lbl" htmlFor="starttid">
                {tp.startTime}
              </label>
              <input
                id="starttid"
                type="time"
                value={state.dist === 'full' ? state.startFull : state.startHalf}
                onChange={(e) => patch(state.dist === 'full' ? { startFull: e.target.value } : { startHalf: e.target.value })}
              />
            </div>
            <p className="help tempo-drink-hint">
              {tp.stationsTotal
                .replace('{n}', String(nStops))
                .replace('{sec}', String(plan.input.stopSec))
                .replace('{total}', String(plan.S))}
            </p>
          </div>
        </div>

        <div className="result-col">
          {!timeSet ? (
            <div className="card result tempo-need-time">
              <p>{tp.needTime}</p>
            </div>
          ) : (
          <>
          {plan.warnings.map((w) => (
            <div key={w.title} className={`warn-card ${w.level}`} role="status">
              <strong>{w.title}</strong>
              <p>{w.text}</p>
            </div>
          ))}
          <div className="card result">
            <div className="result-hero">
              <p className="lbl">{tp.labels.flatP0}</p>
              <p className="flat">
                <b>{fmtP(plan.p0)}</b>
                <span> {tp.perKm}</span>
              </p>
              {state.hill !== 'middels' && (
                <p className="pill-note">
                  {tp.flatNote.replace('{cur}', fmtP(plan.p0)).replace('{mid}', fmtP(plan.p0mid))}
                </p>
              )}
            </div>
            <div className="split-vis">
              <div className="split-vis-bar" aria-hidden="true">
                <span className="h1" style={{ flexGrow: Math.max(halfT, 1) }} />
                <span className="h2" style={{ flexGrow: Math.max(plan.input.T - halfT, 1) }} />
              </div>
              <div className="split-vis-key">
                <span>
                  <i /> {tp.half1} <b>{fmtT(halfT)}</b>
                </span>
                <span>
                  <i /> {tp.half2} <b>{fmtT(plan.input.T - halfT)}</b>
                </span>
              </div>
            </div>
            <div className="kpis">
              <Kpi icon={Gauge} label={tp.kpiAvg} value={`${fmtP(plan.input.T / plan.D)}/km`} />
              <Kpi
                icon={Flag}
                label={tp.kpiHalf}
                value={fmtT(halfT)}
                hint={tp.atClock.replace('{time}', clockDot(plan.input.start, halfT))}
              />
              <Kpi icon={Droplet} label={tp.kpiStops} value={`${Math.round(plan.S)} s`} />
              <Kpi icon={Clock} label={tp.kpiFinish} value={clockDot(plan.input.start, plan.input.T)} />
            </div>
            <p className="note">
              <Info size={16} strokeWidth={1.75} />
              <span>
                {tp.note5k.replace('{t5}', fmtT(t5)).replace('{behind}', behind)}
              </span>
            </p>
          </div>
          </>
          )}
        </div>
        <StepContinue
          id="tempo-step-continue"
          step={3}
          phrase={m.stepContinue.goTo.replace('{n}', '3')}
          muted={!timeSet}
          attention={timeSet}
          error={step2Error ? m.stepContinue.needStep.replace('{n}', '2') : undefined}
          onClick={goToLopeplan}
        />
      </div>
      <details className="explain">
        <summary>{tp.labels.summaryTitle}</summary>
        <p>{tp.explainP1}</p>
        <p>{tp.explainP2}</p>
        <p>{tp.explainP3}</p>
        <p>{tp.explainP4}</p>
        <p className="help">{tp.labels.help}</p>
      </details>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-ico" aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span>{label}</span>
      <b>{value}</b>
      {hint && <em>{hint}</em>}
    </div>
  );
}
