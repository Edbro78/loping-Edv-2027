import { Routes, Route } from 'react-router-dom';
import { PreviewLocaleProvider } from './state/previewLocale';
import { PlanProvider } from './state/plan';
import { CourseProvider } from './state/course';
import { HoverProvider } from './state/active';
import { SiteLayout } from './components/SiteLayout';
import { NotFoundPage } from './components/NotFoundPage';
import { HomePage } from './pages/HomePage';
import { HoydeprofilPage } from './pages/HoydeprofilPage';
import { LoypeguidePage } from './pages/LoypeguidePage';
import { TempoplanPage } from './pages/TempoplanPage';
import { TempostrategiPage } from './pages/TempostrategiPage';
import { DrikkestasjonerPage } from './pages/DrikkestasjonerPage';
import { PraktiskPage } from './pages/PraktiskPage';
import { TreningPage } from './pages/TreningPage';
import { OmPage } from './pages/OmPage';
import { VinnerePage } from './pages/VinnerePage';
import { KontaktPage } from './pages/KontaktPage';
import { PersonvernPage } from './pages/PersonvernPage';

export function App() {
  return (
    <PreviewLocaleProvider>
    <PlanProvider>
      <CourseProvider>
        <HoverProvider>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="loypeguide" element={<LoypeguidePage />} />
              <Route path="hoydeprofil" element={<HoydeprofilPage />} />
              <Route path="drikkestasjoner" element={<DrikkestasjonerPage />} />
              <Route path="tempoplan" element={<TempoplanPage />} />
              <Route path="tempostrategi" element={<TempostrategiPage />} />
              <Route path="praktisk" element={<PraktiskPage />} />
              <Route path="trening" element={<TreningPage />} />
              <Route path="om" element={<OmPage />} />
              <Route path="slik-lop-de-beste" element={<VinnerePage />} />
              <Route path="kontakt" element={<KontaktPage />} />
              <Route path="personvern" element={<PersonvernPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </HoverProvider>
      </CourseProvider>
    </PlanProvider>
    </PreviewLocaleProvider>
  );
}
