import { useMemo, useState } from 'react';
import { CalendarPlus, Copy, Download } from 'lucide-react';
import { GarminExportButton } from './GarminExport';
import { ArmbandCard, ArmbandPrintButton } from './Splits';
import {
  BCM_URL,
  buildFacebookPost,
  buildMilestoneIcs,
  buildPlanSummaryText,
  downloadTextFile,
  milestoneSummaries,
  formatTrainingBrief,
} from '../lib/summary';
import { clockDot, fmtP, fmtT } from '../lib/format';
import { hillCopy } from '../i18n/hills';
import { useUi } from '../i18n/useUi';
import { useActivePlan } from '../state/active';
import { usePlan } from '../state/plan';
import { usePreviewLocale } from '../state/previewLocale';

export function OppsummeringPage() {
  const { state } = usePlan();
  const { plan } = useActivePlan();
  const { locale } = usePreviewLocale();
  const m = useUi();
  const o = m.oppsummering;
  const sp = m.split;
  const [copyMsg, setCopyMsg] = useState('');

  const milestones = useMemo(() => (plan ? milestoneSummaries(plan, locale) : []), [plan, locale]);
  const trainingBrief = useMemo(() => (plan ? formatTrainingBrief(plan, locale) : ''), [plan, locale]);
  const plainText = useMemo(() => (plan ? buildPlanSummaryText(plan, state, locale) : ''), [plan, state, locale]);
  const facebookText = useMemo(() => (plan ? buildFacebookPost(plan, state, locale) : ''), [plan, state, locale]);

  if (!plan) return <p className="intro">{o.loading}</p>;

  const distLabel = state.dist === 'full' ? m.common.full : m.common.half;
  const hill = hillCopy(locale, state.hill);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(label);
      window.setTimeout(() => setCopyMsg(''), 2400);
    } catch {
      setCopyMsg(m.oppsummering.copyFailed);
    }
  }

  return (
    <section className="section oppsummering-section" id="oppsummering" aria-labelledby="oppsummering-tittel">
      <h2 id="oppsummering-tittel">{o.h2}</h2>
      <p className="intro">{o.intro}</p>

      <div className="card oppsummering-lead">
        <dl className="oppsummering-dl">
          <div>
            <dt>{o.dl.distance}</dt>
            <dd>{distLabel}</dd>
          </div>
          <div>
            <dt>{o.dl.targetTime}</dt>
            <dd>{fmtT(plan.input.T)}</dd>
          </div>
          <div>
            <dt>{o.dl.avgFlat}</dt>
            <dd>
              {fmtP(plan.input.T / plan.D)}/km · p₀ {fmtP(plan.p0)}/km
            </dd>
          </div>
          <div>
            <dt>{o.dl.finishPlan}</dt>
            <dd>{locale === 'en' ? '' : 'kl. '}{clockDot(plan.input.start, plan.input.T)}</dd>
          </div>
        </dl>
      </div>

      <div className="card oppsummering-body">
        <h3>{o.strategy.h3}</h3>
        <ul className="oppsummering-list">
          <li>
            <strong>{o.strategy.split}</strong>{' '}
            {state.split === 'negativ' ? sp.negativ : state.split === 'positiv' ? sp.positiv : sp.jevn}
            {state.split !== 'jevn' &&
              ` (σ ${state.sigma.toFixed(1).replace('.', locale === 'nb' ? ',' : '.')} %)`}
          </li>
          <li>
            <strong>{o.strategy.hills}</strong> {hill.l} – {hill.t}
          </li>
          <li>
            <strong>{o.strategy.drink}</strong>{' '}
            {state.drink
              ? o.strategy.drinkOn.replace('{stopSec}', String(state.stopOn)).replace('{totalSec}', String(Math.round(plan.S)))
              : o.strategy.drinkOff.replace('{totalSec}', String(Math.round(plan.S)))}
          </li>
          <li>
            <strong>{o.strategy.course}</strong> {o.strategy.courseNote}
          </li>
        </ul>

        <h3>{o.milestones.h3}</h3>
        <ul className="oppsummering-milestones">
          {milestones.map((m) => (
            <li key={m.title} className="oppsummering-milestone">
              <div>
                <strong>{m.title}</strong> · {m.dateLabel}
                <span className="help">
                  {' '}
                  {o.milestones.daysBefore.replace('{days}', String(m.daysBefore))}
                </span>
                <p>
                  {m.distKm} km {locale === 'en' ? 'in' : 'på'} {m.targetRange} ({m.paceHint})
                </p>
              </div>
              <button
                type="button"
                className="btn secondary oppsummering-ics"
                onClick={() =>
                  downloadTextFile(m.icsFilename, buildMilestoneIcs(m, plan, locale), 'text/calendar;charset=utf-8')
                }
              >
                <CalendarPlus size={18} aria-hidden="true" />
                {o.milestones.calendar}
              </button>
            </li>
          ))}
        </ul>

        {trainingBrief && (
          <>
            <h3>{o.training.h3}</h3>
            <div className="oppsummering-training-row">
              <p className="oppsummering-training">{trainingBrief}</p>
              <div className="oppsummering-band-actions">
                <ArmbandPrintButton />
                <GarminExportButton plan={plan} />
              </div>
            </div>
          </>
        )}

        <h3>{o.armband.h3}</h3>
        <p className="help oppsummering-band-help">{o.armband.help}</p>
        <div className="oppsummering-band-wrap">
          <ArmbandCard plan={plan} />
        </div>
        {!trainingBrief && (
          <div className="oppsummering-band-actions oppsummering-band-print--solo">
            <ArmbandPrintButton />
            <GarminExportButton plan={plan} />
          </div>
        )}
      </div>

      <div className="card oppsummering-export">
        <h3>{o.export.h3}</h3>
        <p className="help">{o.export.help}</p>
        <textarea className="oppsummering-text" readOnly value={plainText} aria-label={o.export.textareaAria} rows={18} />
        <div className="oppsummering-actions">
          <button type="button" className="btn primary" onClick={() => copyText(plainText, o.export.planCopied)}>
            <Copy size={18} aria-hidden="true" />
            {o.export.copyPlan}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => downloadTextFile('bcm-2027-min-plan.txt', plainText)}
          >
            <Download size={18} aria-hidden="true" />
            {o.export.downloadTxt}
          </button>
        </div>
      </div>

      <div className="card oppsummering-export">
        <h3>{o.facebook.h3}</h3>
        <p className="help">{o.facebook.help}</p>
        <textarea
          className="oppsummering-text oppsummering-text--short"
          readOnly
          value={facebookText}
          rows={10}
          aria-label={o.facebook.textareaAria}
        />
        <div className="oppsummering-actions">
          <button type="button" className="btn primary" onClick={() => copyText(facebookText, o.facebook.postCopied)}>
            <Copy size={18} aria-hidden="true" />
            {o.facebook.copyPost}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => downloadTextFile('bcm-2027-facebook.txt', facebookText)}
          >
            <Download size={18} aria-hidden="true" />
            {o.facebook.downloadTxt}
          </button>
        </div>
        <p className="help">
          {m.common.officialSite}{' '}
          <a href={BCM_URL} target="_blank" rel="noopener noreferrer">
            {BCM_URL.replace('https://', '')}
          </a>
        </p>
      </div>

      {copyMsg && (
        <p className="oppsummering-toast" role="status">
          {copyMsg}
        </p>
      )}
    </section>
  );
}
