import { useUi } from '../i18n/useUi';

type StepContinueProps = {
  id: string;
  /** Next step number shown in the badge (2–5). */
  step: number;
  /** Defaults to hero.steps[step - 1] for the current locale. */
  label?: string;
  /** Replaces the “Neste steg / label” pair with one sentence. */
  phrase?: string;
  /** Grey, still clickable. Used before the previous step is filled in. */
  muted?: boolean;
  attention?: boolean;
  disabled?: boolean;
  error?: string;
  onClick: () => void;
};

export function StepContinue({ id, step, label, phrase, muted, attention, disabled, error, onClick }: StepContinueProps) {
  const m = useUi();
  const stepLabel = label ?? m.hero.steps[step - 1] ?? '';
  const errorId = `${id}-error`;
  const live = Boolean(attention && !disabled && !muted);
  return (
    <div className="step-continue-wrap" id={id}>
      <button
        type="button"
        className={`step-continue-btn${live ? ' is-attention' : ''}${muted ? ' is-muted' : ''}`}
        disabled={disabled}
        onClick={onClick}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-label={phrase ?? m.stepContinue.aria.replace('{n}', String(step)).replace('{label}', stepLabel)}
      >
        <span className="step-continue-step" aria-hidden="true">
          {step}
        </span>
        <span className="step-continue-text">
          {phrase ? (
            <span className="step-continue-label">{phrase}</span>
          ) : (
            <>
              <span className="step-continue-kicker">{m.stepContinue.nextStep}</span>
              <span className="step-continue-label">{stepLabel}</span>
            </>
          )}
        </span>
        <span className="step-continue-arrow" aria-hidden="true" />
      </button>
      {error && (
        <p id={errorId} className="step-continue-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
