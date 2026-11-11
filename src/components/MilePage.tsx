import { useEffect, useState } from 'react';
import {
  CircleCheck,
  CircleAlert,
  ChevronRight,
  Target,
  CloudLightning,
  Shirt,
  Wind,
  Timer,
  ShoppingBag,
  DoorOpen,
  Car,
} from 'lucide-react';
import { LAP, POIS, PROGRAM, STAGES, STATIONS, TERR } from '../config';
import { clockDot, dateDM, fmtP, fmtT, kmL, nb } from '../lib/format';
import { addDays, daysBetween, lookupMilestones, rngT, slowerThan, weekKms, WEEK1 } from '../lib/milestones';
import { useActivePlan } from '../state/active';
import { StepContinue } from './StepContinue';
import { useUi } from '../i18n/useUi';
import { guideAttention, scrollToView, usePlan } from '../state/plan';

const RACE = new Date(Date.UTC(2027, 3, 24));
const FORECAST_FROM = new Date('2027-04-15T00:00:00+02:00');

export function MilePage() {
  const { plan } = useActivePlan();
  const m = useUi();
  if (!plan) return <p className="intro">{m.mile.loading}</p>;
  return (
    <div className="mile">
      <MileFormkrav />
      <MileStages />
    </div>
  );
}

export function MileFormkrav() {
  const { plan } = useActivePlan();
  const { state, patch } = usePlan();
  const m = useUi();
  const mi = m.mile;
  if (!plan) return null;

  function goToOppsummering() {
    patch({ view: 'oppsummering' });
    scrollToView('oppsummering');
  }
  const hit = lookupMilestones(plan.input.full, plan.input.T);
  const distName = plan.input.full ? mi.distFull : mi.distHalf;
  const weeks = weekKms(hit.vol);
  const peak = (hit.vol[0] + hit.vol[1]) / 2 || 1;
  const tests: { week: number; title: string; key: 'k3' | 'k5' | 'k10'; dist: number; margin: number }[] = [
    { week: 4, title: mi.milestoneTitles[0], key: 'k3', dist: 3, margin: 15 },
    { week: 8, title: mi.milestoneTitles[1], key: 'k5', dist: 5, margin: 30 },
    { week: 10, title: mi.milestoneTitles[2], key: 'k10', dist: 10, margin: 60 },
  ];
  const phases = [
    { a: 1, b: 4, c: '#D5DFE7', l: mi.phaseLabels[0] },
    { a: 5, b: 8, c: '#8AA3B8', l: mi.phaseLabels[1] },
    { a: 9, b: 11, c: '#12304A', l: mi.phaseLabels[2] },
    { a: 12, b: 13, c: '#E9EEF0', l: mi.phaseLabels[3] },
  ];
  const phaseColor = (w: number) => phases.find((p) => w >= p.a && w <= p.b)?.c ?? '#D5DFE7';
  const marks: Record<number, string> = { 4: '3 km', 8: '5 km', 10: '10 km' };

  return (
    <section className="section" aria-labelledby="mile-tittel">
      <p className="kicker ink">{mi.kicker}</p>
      <h2 id="mile-tittel">
        {mi.title.replace('{dist}', distName).replace('{time}', fmtT(plan.input.T))}
      </h2>
      {mi.intro.map((line) => (
        <p className="intro" key={line}>
          {line}
        </p>
      ))}
      <div className="kpis four">
        <div className="kpi card">
          <span>{mi.volKpi}</span>
          <b>{hit.vol[0]}–{hit.vol[1]}</b>
          <em>{mi.volEm}</em>
        </div>
        {([
          [mi.min3, hit.k3, 3],
          [mi.min5, hit.k5, 5],
          [mi.min10, hit.k10, 10],
        ] as const).map(([label, rng, dist]) => (
          <div key={label} className="kpi card">
            <span>{label}</span>
            <b>{rngT(rng[0], rng[1])}</b>
            <em>{mi.paceOrFaster.replace('{pace}', fmtP(rng[1] / dist))}</em>
          </div>
        ))}
      </div>

      <h3>{mi.weeksH3}</h3>
      <div className="weeks" role="img" aria-label={mi.weeksAria}>
        {weeks.map((km, i) => {
          const week = i + 1;
          return (
            <div key={week} className="week">
              {marks[week] && (
                <span className="test-pill">
                  <Timer size={12} /> {marks[week]}
                </span>
              )}
              <span className="wk-km">{km}</span>
              <div className="bar" style={{ height: `${Math.max(8, (km / peak) * 140)}px`, background: phaseColor(week) }} />
              <span className="wk-n">U{week}</span>
              <span className="wk-d">{dateDM(addDays(WEEK1, i * 7))}</span>
            </div>
          );
        })}
      </div>
      <div className="chips">
        {phases.map((p) => (
          <span key={p.l} className="chip">
            <i style={{ background: p.c }} /> {p.l}
          </span>
        ))}
      </div>
      <StepContinue
        id="mile-step-continue"
        step={5}
        phrase={m.stepContinue.goTo.replace('{n}', '5')}
        attention={guideAttention(state) === 5}
        onClick={goToOppsummering}
      />

      <div className="test-grid">
        {tests.map((t) => {
          const rng = hit[t.key];
          const day = addDays(WEEK1, (t.week - 1) * 7 + 5);
          const slower = slowerThan(hit.rows, t.key, rng[1] + t.margin);
          return (
            <article key={t.title} className="card">
              <p className="lbl">{t.title}</p>
              <p className="help">
                {dateDM(day)} · {mi.daysBefore.replace('{days}', String(daysBetween(day, RACE)))}
              </p>
              <p className="test-time">
                {mi.testDist.replace('{dist}', String(t.dist)).replace('{range}', rngT(rng[0], rng[1]))}
              </p>
              <p className="help">({fmtP(rng[1] / t.dist)}/km)</p>
              <p className="check">
                <CircleCheck size={16} color="#3D6A4E" />{' '}
                {mi.checkOk.replace('{max}', fmtT(rng[1])).replace('{goal}', fmtT(plan.input.T))}
              </p>
              <p className="check warn-line">
                <CircleAlert size={16} color="#9A6A12" />{' '}
                {mi.checkWarn
                  .replace('{over}', fmtT(rng[1] + t.margin))
                  .replace('{slower}', slower ?? '')}
              </p>
            </article>
          );
        })}
      </div>

      <div className="section-head">
        <h3>{mi.matrixH3.replace('{dist}', distName)}</h3>
        <p className="help">{mi.vdot.replace('{v}', nb(hit.vdot, 1))}</p>
      </div>
      <div className="table-wrap">
        <table className="data matrix">
          <thead>
            <tr>
              <th scope="col" />
              {mi.matrixHeaders.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hit.rows.map((r, i) => {
              const near = i === hit.nearest;
              const neighbor = !hit.exact && !hit.outside && (i === hit.ri || i === hit.ri + 1);
              return (
                <tr key={r.label} className={near ? 'is-near' : neighbor ? 'is-neighbor' : ''}>
                  <td>{near && <ChevronRight size={16} color="#B3322A" />}</td>
                  <th scope="row">{r.label}</th>
                  <td>{nb(r.vdot, 1)}</td>
                  <td>{rngT(r.k3[0], r.k3[1])}</td>
                  <td>{rngT(r.k5[0], r.k5[1])}</td>
                  <td>{rngT(r.k10[0], r.k10[1])}</td>
                  <td>
                    {r.vol[0]}–{r.vol[1]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="help">{mi.matrixFooter}</p>
    </section>
  );
}

export function MileStages() {
  const { plan } = useActivePlan();
  if (!plan) return null;
  return (
    <section className="section">
      <h2>Etapper og terreng</h2>
      <div className="card-grid">
        {STAGES.map((s) => {
          const meta = TERR[s.terr];
          const t1 = `${fmtT(plan.tAt(s.from))}–${fmtT(plan.tAt(s.to))}`;
          return (
            <article key={s.km} className="card stage">
              <div className="stage-top">
                <span>km {s.km}</span>
                <span className="chip" style={{ background: meta.chipBg, color: meta.chipFg }}>
                  {meta.l}
                </span>
              </div>
              <h3>{s.name}</h3>
              <p className="help">
                {s.profile} · {s.surface}
              </p>
              <p className="tactic">
                <Target size={16} /> {s.tactic}
              </p>
              <p className="plan-line">Plan: {t1}</p>
              {plan.input.full && (
                <p className="help">
                  R1 {t1}
                  <br />
                  R2 {fmtT(plan.tAt(s.from + LAP))}–{fmtT(plan.tAt(Math.min(plan.D, s.to + LAP)))}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="help">
        Høydemeter: ca. 200–235 m per runde og 400–470 m for maraton (anslag fra erfarne løpere, ikke offisielt). Ingen grusstrekninger.
      </p>
    </section>
  );
}

const DRINKS: { km: number; name: string; note?: string; fullOnly?: boolean }[] = [
  { km: 3.5, name: 'Sandviken sykehus' },
  { km: 7.2, name: 'Fjellveien v/ Tippetue' },
  { km: 10, name: 'Haraldsplass sykehus' },
  { km: 14, name: 'AdO arena', note: 'Neste stasjon om 5 km' },
  { km: 19, name: 'Nordnes skole' },
];

export function MileAid() {
  const { plan } = useActivePlan();
  if (!plan) return null;
  const full = plan.input.full;
  const rows = full
    ? [
        ...DRINKS.map((d) => ({ ...d, when: d.km })),
        { km: 21.5, name: 'Bryggen', note: 'Kun for maraton', when: 21.5 },
        ...DRINKS.map((d) => ({ ...d, when: d.km + LAP, note: undefined })),
      ]
    : DRINKS.map((d) => ({ ...d, when: d.km }));
  const toilets = POIS.filter((p) => p.t.includes('toilet') && p.km != null);
  return (
    <section className="section">
      <h2>Drikkestasjoner og toaletter</h2>
      <p className="intro">
        {full
          ? '11 stasjoner på hel: fem per runde, pluss Bryggen ved 21,5 km.'
          : '5 stasjoner på halv. Merk hullet på 5 km mellom AdO arena og Nordnes skole.'}{' '}
        Alle stasjoner serverer vann først, deretter sportsdrikk, bananer og mørk sjokolade.
      </p>
      <div className="timeline" aria-hidden="true">
        <div className="gap-zone">5 km uten drikke</div>
        {STATIONS.map((km) => (
          <div key={km} className="drop-dot" style={{ left: `${(km / LAP) * 100}%` }}>
            <span />
            <small>{kmL(km)}</small>
          </div>
        ))}
      </div>
      <div className="split-2">
        <article className="card">
          <h3>Drikkestasjoner ({full ? 11 : 5})</h3>
          <ul className="plain">
            {rows.map((d) => (
              <li key={`${d.when}-${d.name}`}>
                <strong>km {kmL(d.when)}</strong> {d.name}
                {d.note && <em className={d.note.includes('5 km') ? 'hot' : ''}> {d.note}</em>}
                <span className="help">
                  {' '}
                  {fmtT(plan.tAt(d.when))} kl. {clockDot(plan.input.start, plan.tAt(d.when))}
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <h3>Toaletter</h3>
          <ul className="plain">
            {toilets.map((p) => (
              <li key={p.n}>
                <strong>km {kmL(p.km as number)}</strong> {p.n} <a href="#kart">Kart →</a>
              </li>
            ))}
          </ul>
          <p className="help">Utenfor løypa: Vikinghallen · Sandbrogaten · Bryggen v/ Nikolaikirkealmenningen</p>
        </article>
      </div>
    </section>
  );
}

type Hour = { h: string; temp: number; mm: number; wind: number; dir: number };

export function MileWeather() {
  const [hours, setHours] = useState<Hour[] | null>(null);
  const [fromForecast, setFromForecast] = useState(false);
  const daysToWindow = Math.max(0, Math.ceil((FORECAST_FROM.getTime() - Date.now()) / 86400000));

  useEffect(() => {
    const days = (new Date('2027-04-24T09:00:00+02:00').getTime() - Date.now()) / 86400000;
    if (days > 9) return;
    let dead = false;
    (async () => {
      const met = await loadMet();
      if (!dead && met.length) {
        setHours(met);
        setFromForecast(true);
        return;
      }
      const om = await loadOm();
      if (!dead && om.length) {
        setHours(om);
        setFromForecast(true);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const low = hours?.length ? Math.min(...hours.map((h) => h.temp)) : 5;
  const wet = (hours?.reduce((s, h) => s + h.mm, 0) ?? 0) > 1;
  const advice =
    low <= 3
      ? 'Kaldt: lange tights, langermet trøye, tynn vindjakke, lue og hansker.'
      : low <= 7
        ? 'Kjølig: shorts eller 3/4-tights, t-skjorte med armvarmere eller tynn langermet, pannebånd og tynne hansker.'
        : low <= 12
          ? 'Mildt: shorts og t-skjorte, tynne hansker til start som du kan ta av.'
          : 'Varmt for april: singlet og shorts. Drikk ved alle stasjoner.';
  const rain = wet ? ' Det er ventet mer enn 1 mm nedbør. Ta med et tynt lag du kan kaste hvis det blir vått.' : '';
  const basis = fromForecast ? 'prognosen' : 'klimanormalen og erfaringer fra tidligere år';

  return (
    <section className="section">
      <h2>Vær og bekledning</h2>
      <div className="card-grid">
        <article className="card">
          <h3>Klimanormal for april (Bergen-Florida 1991–2020)</h3>
          <p>Snitt maks 11,1°, døgnmiddel 7,2°, snitt min 3,9°.</p>
          <p className="help">Nedbør 140,6 mm, dager med minst 1 mm 14 av 30, luftfuktighet 72 %, soltimer 222.</p>
        </article>
        <article className="card bad-card">
          <h3>
            <CloudLightning size={18} /> Verste tilfelle: løpsdagen 2023
          </h3>
          <p className="test-time">2° ved start</p>
          <p>Regn, hagl, sludd og korte solglimt. Temperaturen kom aldri over 4–5 °C. Ha med et ekstra lag du kan kaste, og tørre klær i tøyposen.</p>
        </article>
        <article className={`card ${hours ? '' : 'empty'}`}>
          <h3>Prognose kl. 07–14</h3>
          {hours ? (
            <table className="data slim">
              <tbody>
                {hours.map((h) => (
                  <tr key={h.h}>
                    <th scope="row">{h.h}</th>
                    <td>{nb(h.temp, 0)}°</td>
                    <td>{nb(h.mm, 1)} mm</td>
                    <td>
                      <span className="wind-arrow" style={{ transform: `rotate(${h.dir}deg)` }}>
                        ↑
                      </span>{' '}
                      {nb(h.wind, 0)} m/s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              Prognosen er ikke tilgjengelig ennå – Prognosevinduet er ca. 9 dager. Den dukker opp her fra ca. 15. april 2027 (om {daysToWindow} dager). Til da vises klimanormalen.
            </p>
          )}
        </article>
      </div>
      <article className="card navy-card">
        <h3>
          <Shirt size={18} /> Bekledning
        </h3>
        <p>
          Basert på {basis}. {advice}
          {rain}
        </p>
      </article>
      <article className="card">
        <h3>
          <Wind size={18} /> Vind
        </h3>
        <p>
          Km 12–16 (og 33–37) går langs åpent vann ved Store Lungegårdsvann. Vinden får tak her. Søk ly i en gruppe, og spar kreftene til Fjellveien er unnagjort.
        </p>
      </article>
    </section>
  );
}

async function loadMet(): Promise<Hour[]> {
  try {
    const res = await fetch('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=60.398&lon=5.325', {
      headers: { 'User-Agent': 'BCM2027-lopeguide/1.0 (lokal planleggingsguide)' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = (json.properties?.timeseries ?? []) as {
      time: string;
      data: {
        instant?: { details?: { air_temperature?: number; wind_speed?: number; wind_from_direction?: number } };
        next_1_hours?: { details?: { precipitation_amount?: number } };
      };
    }[];
    const out: Hour[] = [];
    for (const row of rows) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.time));
      if (date !== '2027-04-24') continue;
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(row.time)));
      if (hour < 7 || hour > 14) continue;
      const d = row.data.instant?.details ?? {};
      out.push({
        h: String(hour).padStart(2, '0'),
        temp: d.air_temperature ?? 0,
        mm: row.data.next_1_hours?.details?.precipitation_amount ?? 0,
        wind: d.wind_speed ?? 0,
        dir: d.wind_from_direction ?? 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function loadOm(): Promise<Hour[]> {
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=60.398&longitude=5.325&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe/Oslo&start_date=2027-04-24&end_date=2027-04-24';
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const h = json.hourly as {
      time?: string[];
      temperature_2m?: number[];
      precipitation?: number[];
      wind_speed_10m?: number[];
      wind_direction_10m?: number[];
    };
    if (!h?.time) return [];
    const out: Hour[] = [];
    h.time.forEach((t, i) => {
      const hour = Number(t.slice(11, 13));
      if (hour < 7 || hour > 14) return;
      out.push({
        h: String(hour).padStart(2, '0'),
        temp: h.temperature_2m?.[i] ?? 0,
        mm: h.precipitation?.[i] ?? 0,
        wind: h.wind_speed_10m?.[i] ?? 0,
        dir: h.wind_direction_10m?.[i] ?? 0,
      });
    });
    return out;
  } catch {
    return [];
  }
}

export function MilePractical() {
  const { state } = usePlan();
  return (
    <section className="section">
      <h2>Praktisk</h2>
      <p className="intro">Basert på 2026-programmet. Programmet for 2027 er ikke publisert ennå.</p>
      <div className="table-wrap">
        <table className="data program">
          <thead>
            <tr>
              <th scope="col">Tid</th>
              <th scope="col">Hendelse</th>
            </tr>
          </thead>
          <tbody>
            {PROGRAM.map((row) => (
              <tr key={row.t + row.ev} className={row.hl === 'bad' ? 'is-bad' : row.hl === state.dist ? 'is-you' : ''}>
                <th scope="row">{row.t}</th>
                <td>{row.ev}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-grid">
        <article className="card">
          <h3>
            <Timer size={18} /> Makstid og cut-off
          </h3>
          <p>Halvmaraton 4 timer, maraton 6 timer. Maraton må passere Bryggen (21,1 km) innen kl. 10.45. Ellers blir du stoppet og registrert for halvmaraton.</p>
        </article>
        <article className="card">
          <h3>
            <ShoppingBag size={18} /> Tøyoppbevaring
          </h3>
          <p>Festningskaien, åpner kl. 07.00 og stenger kl. 15.00. 60.39990, 5.31646.</p>
        </article>
        <article className="card">
          <h3>
            <DoorOpen size={18} /> Garderobe og expo
          </h3>
          <p>Vikinghallen åpner kl. 06.30. Expo samme sted. 60.39932, 5.32192.</p>
        </article>
        <article className="card">
          <h3>
            <Car size={18} /> Trafikk
          </h3>
          <p>Gater langs løypa stenges mens feltet passerer. Sjekk bergencitymarathon.no nærmere løpsdagen for omkjøring.</p>
        </article>
      </div>
    </section>
  );
}
