import { Outlet, useLocation } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Footer } from './Footer';
import { PageMeta } from './PageMeta';
import { AdHead } from './AdHead';
import { metaForPath } from '../i18n/meta';
import { usePreviewLocale } from '../state/previewLocale';
import { useUi } from '../i18n/useUi';

function LayoutBody({ fullBleed }: { fullBleed: boolean }) {
  return (
    <>
      <TopNav />
      <main id="innhold" className={fullBleed ? 'is-fullbleed' : undefined}>
        <Outlet />
        {!fullBleed && <Footer />}
      </main>
    </>
  );
}

export function SiteLayout() {
  const { pathname } = useLocation();
  const { device, locale } = usePreviewLocale();
  const m = useUi();
  const meta = metaForPath(pathname, locale);
  return (
    <>
      <PageMeta meta={meta} />
      {!meta.noAdScript && <AdHead />}
      <a className="skip" href="#innhold">
        {m.skipLink}
      </a>
      {device === 'mobile' ? (
        <div className="preview-phone-chrome">
          <div className="preview-phone-frame" style={{ width: 'min(100%, 404px)' }}>
            <LayoutBody fullBleed={pathname === '/slik-lop-de-beste'} />
          </div>
        </div>
      ) : (
        <LayoutBody fullBleed={pathname === '/slik-lop-de-beste'} />
      )}
    </>
  );
}
