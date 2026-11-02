import { Fragment } from 'react';
import { useUi } from '../i18n/useUi';
import { scrollToStepRail, usePlan, type PlanState } from '../state/plan';

const STEP_VIEWS: PlanState['view'][] = ['distanse', 'plan', 'splits', 'mile', 'oppsummering'];

function stepIndex(view: PlanState['view']): number {
  if (view === 'profil' || view === 'band') return 2;
  const i = STEP_VIEWS.indexOf(view);
  return i === -1 ? 0 : i;
}

export function StepProgress() {
  const { state, patch } = usePlan();
  const m = useUi();
  const current = stepIndex(state.view);

  return (
    <div className="wrap step-rail-wrap" id="step-rail">
      <div className="step-rail" role="group" aria-label={m.hero.stepsAria}>
        {STEP_VIEWS.map((view, i) => {
          const on = i === current;
          const n = String(i + 1);
          const text = m.hero.steps[i] ?? '';
          return (
            <Fragment key={view}>
              {i === current + 1 && (
                <span className="step-rail-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path
                      d="M4 12h14M13 6l6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              <button
                type="button"
                className={`step-rail-btn${on ? ' is-on' : ''}`}
                aria-current={on ? 'step' : undefined}
                aria-label={m.hero.stepAria.replace('{n}', n).replace('{text}', text)}
                onClick={() => {
                  patch({ view });
                  scrollToStepRail();
                }}
              >
                {n}
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
