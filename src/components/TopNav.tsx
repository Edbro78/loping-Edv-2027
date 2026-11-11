import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { OwnerDeviceSeg, OwnerLangSeg } from './OwnerToolbar';
import { useUi } from '../i18n/useUi';
import { showOwnerTools } from '../state/previewLocale';

const ROUTES: { to: string; key: 'home' | 'loypeguide' | 'hoydeprofil' | 'drikkestasjoner' | 'tempoplan' | 'tempostrategi' | 'praktisk' | 'trening' | 'om' | 'beste' }[] = [
  { to: '/', key: 'home' },
  { to: '/loypeguide', key: 'loypeguide' },
  { to: '/hoydeprofil', key: 'hoydeprofil' },
  { to: '/drikkestasjoner', key: 'drikkestasjoner' },
  { to: '/tempoplan', key: 'tempoplan' },
  { to: '/tempostrategi', key: 'tempostrategi' },
  { to: '/praktisk', key: 'praktisk' },
  { to: '/trening', key: 'trening' },
  { to: '/om', key: 'om' },
  { to: '/slik-lop-de-beste', key: 'beste' },
];

function NavRouteLinks({
  pathname,
  labels,
  className,
  onNavigate,
}: {
  pathname: string;
  labels: ReturnType<typeof useUi>['nav'];
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {ROUTES.map((l) => (
        <Link key={l.to} to={l.to} className={pathname === l.to ? 'is-on' : ''} onClick={onNavigate}>
          {labels[l.key]}
        </Link>
      ))}
    </>
  );
}

export function TopNav() {
  const navRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDetailsElement>(null);
  const { pathname } = useLocation();
  const m = useUi();
  const ownerTools = showOwnerTools();
  const activeKey = ROUTES.find((r) => r.to === pathname)?.key ?? 'home';

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`);
    apply();
    const watch = new ResizeObserver(apply);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    drawerRef.current?.removeAttribute('open');
  }, [pathname]);

  const closeDrawer = () => drawerRef.current?.removeAttribute('open');

  return (
    <header className="nav" ref={navRef}>
      <div className="nav-in">
        <Link className="brand" to="/">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C15.8 12 17.8 13 20 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"
            />
          </svg>
          <span>{m.brand}</span>
        </Link>
        <OwnerLangSeg />
        {ownerTools && <OwnerDeviceSeg />}
        <details className="nav-drawer" ref={drawerRef}>
          <summary className="nav-drawer-trigger">
            <span className="nav-drawer-label">{m.nav.menu}</span>
            <span className="nav-drawer-current">{m.nav[activeKey]}</span>
          </summary>
          <nav className="nav-drawer-panel nav-links" aria-label={m.nav.mainMenu}>
            <NavRouteLinks pathname={pathname} labels={m.nav} onNavigate={closeDrawer} />
          </nav>
        </details>
        <nav className="nav-links nav-links--bar" aria-label={m.nav.mainMenu}>
          <NavRouteLinks pathname={pathname} labels={m.nav} />
        </nav>
      </div>
    </header>
  );
}
