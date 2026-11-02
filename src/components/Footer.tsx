import { Link } from 'react-router-dom';
import { useUi } from '../i18n/useUi';
import { usePreviewLocale } from '../state/previewLocale';

function ExternalLinks({ text }: { text: string }) {
  const re = /(bergencitymarathon\.no|yr\.no \/ met\.no)/g;
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) => {
        if (part === 'bergencitymarathon.no') {
          return (
            <a key={i} href="https://www.bergencitymarathon.no" target="_blank" rel="noopener">
              bergencitymarathon.no
            </a>
          );
        }
        if (part === 'yr.no / met.no') {
          return (
            <a key={i} href="https://www.yr.no" target="_blank" rel="noopener">
              yr.no / met.no
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function Footer() {
  const m = useUi();
  usePreviewLocale();
  return (
    <footer className="site">
      <div className="wrap">
        <p className="independence">{m.footer.independence}</p>
        <p>
          <ExternalLinks text={m.footer.sources} />
        </p>
        <p className="footer-links">
          <Link to="/om">{m.footer.about}</Link>
          <Link to="/kontakt">{m.footer.contact}</Link>
          <Link to="/personvern">{m.footer.privacy}</Link>
        </p>
      </div>
    </footer>
  );
}
