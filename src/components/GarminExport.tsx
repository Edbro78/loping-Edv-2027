import { useId, useRef, useState, type FormEvent } from 'react';
import { Watch } from 'lucide-react';
import { kmL } from '../lib/format';
import {
  garminRangeFilename,
  garminSegmentRange,
  type GarminWorkoutErrorCode,
  type GarminWorkoutFile,
  type GarminWorkoutOptions,
} from '../lib/garminWorkout';
import type { Plan } from '../lib/model';
import { useUi } from '../i18n/useUi';
import { usePreviewLocale } from '../state/previewLocale';

type Mode = 'segment' | 'km';
type Phase = 'form' | 'done';

const TOLERANCES = [3, 5, 10] as const;

type GarminApi = {
  createGarminWorkout: (plan: Plan, options?: GarminWorkoutOptions) => GarminWorkoutFile;
  GarminWorkoutError: new (code: GarminWorkoutErrorCode) => Error & { code: GarminWorkoutErrorCode };
};

const RANGE_NAMES = { first: 'BCM 10 km', last: 'BCM 11.2 km' } as const;

let garminLoader: Promise<GarminApi> | null = null;

function garminScriptUrl(): string {
  const flag = (window as Window & { __BCM_PUBLIC__?: string }).__BCM_PUBLIC__;
  return flag === '' ? './garmin.js' : './dist/garmin.js';
}

function saveFit(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadGarmin(): Promise<GarminApi> {
  if (import.meta.env.DEV) return import('../garmin-entry');
  if (garminLoader) return garminLoader;
  const pending = new Promise<GarminApi>((resolve, reject) => {
    if (window.BcmGarmin) {
      resolve(window.BcmGarmin);
      return;
    }
    const script = document.createElement('script');
    script.src = garminScriptUrl();
    script.async = true;
    script.onload = () => (window.BcmGarmin ? resolve(window.BcmGarmin) : reject(new Error('garmin')));
    script.onerror = () => reject(new Error('garmin'));
    document.body.appendChild(script);
  });
  pending.catch(() => {
    if (garminLoader === pending) garminLoader = null;
  });
  garminLoader = pending;
  return pending;
}

export function GarminExportButton({ plan, label }: { plan: Plan; label?: string }) {
  const g = useUi().garmin;
  const { locale } = usePreviewLocale();
  const titleId = useId();
  const gpsHelpId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guideRef = useRef<HTMLHeadingElement>(null);
  const [mode, setMode] = useState<Mode>('segment');
  const [tolerance, setTolerance] = useState<(typeof TOLERANCES)[number]>(5);
  const [gps, setGps] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [merged, setMerged] = useState(false);

  function openDialog() {
    setPhase('form');
    setError('');
    setMerged(false);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }

  async function download(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const mod = await loadGarmin();
      const file = mod.createGarminWorkout(plan, {
        mode,
        toleranceSec: tolerance,
        gpsFactor: gps ? 1.005 : 1,
        locale,
      });
      saveFit(file.bytes, file.filename);
      setMerged(file.merged);
      setPhase('done');
      window.setTimeout(() => guideRef.current?.focus(), 0);
    } catch (err) {
      const mod = await loadGarmin().catch(() => null);
      const code: GarminWorkoutErrorCode | 'unknown' =
        mod && err instanceof mod.GarminWorkoutError ? err.code : 'unknown';
      setError(g.errors[code] ?? g.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="no-print btn oppsummering-band-print"
        aria-haspopup="dialog"
        onClick={openDialog}
      >
        <Watch size={17} strokeWidth={2} aria-hidden="true" />
        {label ?? g.export}
      </button>
      <dialog
        ref={dialogRef}
        className="garmin-dialog no-print"
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
      >
        <h3 id={titleId}>{g.dialogTitle}</h3>
        {phase === 'form' ? (
          <form onSubmit={download}>
            <p className="help">{g.intro}</p>
            <p className="lbl" id={`${titleId}-mode`}>
              {g.modeLegend}
            </p>
            <div className="seg" role="group" aria-labelledby={`${titleId}-mode`}>
              <button type="button" aria-pressed={mode === 'segment'} onClick={() => setMode('segment')}>
                {g.modeSegment}
              </button>
              <button type="button" aria-pressed={mode === 'km'} onClick={() => setMode('km')}>
                {g.modeKm}
              </button>
            </div>
            <p className="lbl" id={`${titleId}-tol`}>
              {g.toleranceLegend}
            </p>
            <div className="seg" role="group" aria-labelledby={`${titleId}-tol`}>
              {TOLERANCES.map((sec) => (
                <button key={sec} type="button" aria-pressed={tolerance === sec} onClick={() => setTolerance(sec)}>
                  {g.toleranceOption.replace('{sec}', String(sec))}
                </button>
              ))}
            </div>
            <label className="garmin-check">
              <input type="checkbox" checked={gps} onChange={(event) => setGps(event.target.checked)} aria-describedby={gpsHelpId} />
              <span>{g.gpsLabel}</span>
            </label>
            <p className="help" id={gpsHelpId}>
              {g.gpsHelp}
            </p>
            {error && (
              <p className="garmin-alert" role="alert">
                {error}
              </p>
            )}
            <div className="garmin-actions">
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? g.working : g.download}
              </button>
              <button type="button" className="btn secondary" onClick={closeDialog}>
                {g.close}
              </button>
            </div>
          </form>
        ) : (
          <div>
            {merged && <p className="garmin-merged">{g.merged}</p>}
            <h4 ref={guideRef} tabIndex={-1}>
              {g.guideTitle}
            </h4>
            <ol>
              {g.guide.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="help">{g.gpsNote}</p>
            <div className="garmin-actions">
              <button type="button" className="btn primary" onClick={closeDialog}>
                {g.close}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

export function GarminExportSection({ plan }: { plan: Plan }) {
  const g = useUi().garmin;
  const { locale } = usePreviewLocale();
  const lastKm = locale === 'en' ? '11.2' : '11,2';
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guideRef = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState<'first' | 'last' | null>(null);
  const [error, setError] = useState('');

  function closeDialog() {
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }

  async function downloadRange(kind: 'first' | 'last', button: HTMLButtonElement) {
    triggerRef.current = button;
    setBusy(kind);
    setError('');
    try {
      const mod = await loadGarmin();
      const file = mod.createGarminWorkout(plan, {
        mode: 'segment',
        toleranceSec: 5,
        gpsFactor: 1,
        locale,
        ...garminSegmentRange(plan, kind),
        name: RANGE_NAMES[kind],
        filename: garminRangeFilename(plan, kind),
      });
      saveFit(file.bytes, file.filename);
      dialogRef.current?.showModal();
      window.setTimeout(() => guideRef.current?.focus(), 0);
    } catch {
      setError(g.errors.unknown);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="garmin-exports">
      <h3>{g.segmentsTitle}</h3>
      <p className="help">{g.segmentsIntro}</p>
      <div className="garmin-export-list">
        <article className="garmin-export">
          <p className="garmin-export-km">
            <strong>{kmL(plan.D)}</strong>
            <span>km</span>
          </p>
          <div className="garmin-export-copy">
            <h4>{g.raceTitle}</h4>
            <p>{g.raceText}</p>
          </div>
          <div className="garmin-export-action">
            <GarminExportButton plan={plan} label={g.download} />
          </div>
        </article>
        <article className="garmin-export">
          <p className="garmin-export-km">
            <strong>10</strong>
            <span>km</span>
          </p>
          <div className="garmin-export-copy">
            <h4>{g.firstTitle}</h4>
            <p>{g.firstText}</p>
          </div>
          <div className="garmin-export-action">
            <button
              type="button"
              className="no-print btn oppsummering-band-print"
              disabled={busy !== null}
              onClick={(event) => downloadRange('first', event.currentTarget)}
            >
              <Watch size={17} strokeWidth={2} aria-hidden="true" />
              {busy === 'first' ? g.working : g.download}
            </button>
          </div>
        </article>
        <article className="garmin-export">
          <p className="garmin-export-km">
            <strong>{lastKm}</strong>
            <span>km</span>
          </p>
          <div className="garmin-export-copy">
            <h4>{g.lastTitle}</h4>
            <p>{g.lastText}</p>
          </div>
          <div className="garmin-export-action">
            <button
              type="button"
              className="no-print btn oppsummering-band-print"
              disabled={busy !== null}
              onClick={(event) => downloadRange('last', event.currentTarget)}
            >
              <Watch size={17} strokeWidth={2} aria-hidden="true" />
              {busy === 'last' ? g.working : g.download}
            </button>
          </div>
        </article>
      </div>
      {error && (
        <p className="garmin-alert" role="alert">
          {error}
        </p>
      )}
      <dialog
        ref={dialogRef}
        className="garmin-dialog no-print"
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
      >
        <h3 id={titleId} ref={guideRef} tabIndex={-1}>
          {g.guideTitle}
        </h3>
        <ol>
          {g.guide.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="help">{g.gpsNote}</p>
        <div className="garmin-actions">
          <button type="button" className="btn primary" onClick={closeDialog}>
            {g.close}
          </button>
        </div>
      </dialog>
    </div>
  );
}
