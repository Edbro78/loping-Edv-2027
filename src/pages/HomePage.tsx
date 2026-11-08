import { DistanceChoice } from '../components/DistanceChoice';
import { ElevationProfile } from '../components/ElevationProfile';
import { Hero } from '../components/Hero';
import { StepProgress } from '../components/StepProgress';
import { LazyCourseMap } from '../components/LazyCourseMap';
import { MilePage } from '../components/MilePage';
import { Splits, Wristband } from '../components/Splits';
import { TabBar } from '../components/TabBar';
import { OppsummeringPage } from '../components/OppsummeringPage';
import { TempoPlan } from '../components/TempoPlan';
import { useUi } from '../i18n/useUi';
import { useLayoutEffect } from 'react';
import { usePlan, timeIsSet, VIEW_SCROLL_ID, type PlanState } from '../state/plan';

const PLAN_VIEWS: PlanState['view'][] = ['splits', 'mile', 'band', 'oppsummering'];

function BlockedStep({ message }: { message: string }) {
  const { state } = usePlan();
  return (
    <section className="section">
      <p id={VIEW_SCROLL_ID[state.view]} className="distance-required" role="status">
        {message}
      </p>
    </section>
  );
}

function DashboardPanels() {
  const { state } = usePlan();
  const m = useUi();
  const laterStep = PLAN_VIEWS.includes(state.view);
  const needsDistance = !state.distSet && (state.view === 'plan' || laterStep);
  const needsTime = laterStep && state.distSet && !timeIsSet(state);
  const blocked = needsDistance || needsTime;
  return (
    <>
      {state.view !== 'oppsummering' && <TabBar />}
      <div className="wrap panels">
        {needsDistance && <BlockedStep message={m.distance.notChosen} />}
        {needsTime && <BlockedStep message={m.tempoPlan.notChosen} />}
        {!blocked && state.view === 'distanse' && <DistanceChoice />}
        {!blocked && state.view === 'plan' && <TempoPlan />}
        {state.view === 'profil' && <ElevationProfile />}
        {!blocked && state.view === 'splits' && <Splits />}
        {!blocked && state.view === 'mile' && <MilePage />}
        {!blocked && state.view === 'band' && <Wristband />}
        {!blocked && state.view === 'oppsummering' && <OppsummeringPage />}
      </div>
      {state.view === 'profil' && <LazyCourseMap />}
    </>
  );
}

export function HomePage() {
  const { patch } = usePlan();

  useLayoutEffect(() => {
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    patch({ view: 'distanse' });
    const scrollTop = () => {
      const frame = document.querySelector('.preview-phone-frame');
      if (frame instanceof HTMLElement) frame.scrollTop = 0;
      else window.scrollTo(0, 0);
    };
    scrollTop();
    requestAnimationFrame(() => requestAnimationFrame(scrollTop));
  }, []);

  return (
    <>
      <Hero />
      <div className="step-stage">
        <StepProgress />
        <DashboardPanels />
      </div>
    </>
  );
}
