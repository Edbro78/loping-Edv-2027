import { useState } from 'react';
import { StepContinue } from './StepContinue';
import { useUi } from '../i18n/useUi';
import { scrollToView, usePlan } from '../state/plan';

export function DistanceChoice() {
  const { state, patch } = usePlan();
  const m = useUi();
  const [step1Error, setStep1Error] = useState(false);

  function chooseDist(dist: 'half' | 'full') {
    setStep1Error(false);
    patch({ dist, distSet: true });
  }

  function goToSluttid() {
    if (!state.distSet) {
      setStep1Error(true);
      return;
    }
    setStep1Error(false);
    patch({ view: 'plan' });
    scrollToView('plan');
  }

  return (
    <section className="section" aria-labelledby="distanse-tittel">
      <h2 id="distanse-tittel">{m.distance.title}</h2>
      <div className="card distanse-card">
        {!state.distSet && <p className="distanse-unset">{m.distance.unset}</p>}
        <div className={`seg${state.distSet ? '' : ' is-attention'}`} role="group" aria-label={m.distance.aria}>
          <button
            type="button"
            aria-pressed={state.distSet && state.dist === 'half'}
            onClick={() => chooseDist('half')}
          >
            {m.distance.half}
          </button>
          <button
            type="button"
            aria-pressed={state.distSet && state.dist === 'full'}
            onClick={() => chooseDist('full')}
          >
            {m.distance.full}
          </button>
        </div>
      </div>
      <StepContinue
        id="distanse-step-continue"
        step={2}
        phrase={m.stepContinue.goTo.replace('{n}', '2')}
        muted={!state.distSet}
        attention={state.distSet}
        error={step1Error ? m.distance.needStep1 : undefined}
        onClick={goToSluttid}
      />
    </section>
  );
}
