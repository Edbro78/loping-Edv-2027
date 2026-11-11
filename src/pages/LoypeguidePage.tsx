import { Link } from 'react-router-dom';
import { AdSlot } from '../components/AdSlot';
import { ArticleView } from '../i18n/ArticleView';
import { articles } from '../i18n/articles';
import { useUi } from '../i18n/useUi';
import { usePreviewLocale } from '../state/previewLocale';

function GuideIntro() {
  const m = useUi();
  const hi = m.homeIntro;
  const bl = hi.linkBlurbs;
  const p4 = hi.paragraphs[3]!;
  const p4Parts = p4.split('bergencitymarathon.no');
  return (
    <article className="about wrap home-intro">
      <div className="about-in">
        <h2>{hi.h2s[0]}</h2>
        <p>{hi.paragraphs[0]}</p>
        <p>{hi.paragraphs[1]}</p>
        <p>{hi.paragraphs[2]}</p>
        <p>
          {p4Parts[0]}
          <a href="https://www.bergencitymarathon.no" target="_blank" rel="noopener">
            bergencitymarathon.no
          </a>
          {p4Parts[1] ?? ''}
        </p>
        <h2>{hi.h2s[1]}</h2>
        <ul className="home-links" style={{ color: 'inherit' }}>
          <li>
            <Link to="/loypeguide">{m.nav.loypeguide}</Link> – {bl.loypeguide}
          </li>
          <li>
            <Link to="/hoydeprofil">{m.nav.hoydeprofil}</Link> – {bl.hoydeprofil}
          </li>
          <li>
            <Link to="/drikkestasjoner">{m.nav.drikkestasjoner}</Link> – {bl.drikkestasjoner}
          </li>
          <li>
            <Link to="/tempoplan">{m.nav.tempoplan}</Link> – {bl.tempoplan}
          </li>
          <li>
            <Link to="/tempostrategi">{m.nav.tempostrategi}</Link> – {bl.tempostrategi}
          </li>
          <li>
            <Link to="/praktisk">{m.nav.praktisk}</Link> – {bl.praktisk}
          </li>
          <li>
            <Link to="/trening">{m.nav.trening}</Link> – {bl.trening}
          </li>
        </ul>
        <p className="pull">{hi.pull}</p>
        <p>{hi.closing}</p>
        <AdSlot slot="0000000001" />
      </div>
    </article>
  );
}

export function LoypeguidePage() {
  const { locale } = usePreviewLocale();
  return (
    <>
      <ArticleView doc={articles.loypeguide[locale]} />
      <GuideIntro />
    </>
  );
}
