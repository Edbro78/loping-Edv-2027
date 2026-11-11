import { MileAid, MilePractical, MileWeather } from '../components/MilePage';
import { useUi } from '../i18n/useUi';
import { useActivePlan } from '../state/active';

export function DrikkestasjonerPage() {
  const { plan } = useActivePlan();
  const m = useUi();
  if (!plan) {
    return (
      <div className="wrap">
        <p className="intro">{m.common.loading}</p>
      </div>
    );
  }
  return (
    <div className="wrap panels mile">
      <MileAid />
      <MileWeather />
      <MilePractical />
    </div>
  );
}
