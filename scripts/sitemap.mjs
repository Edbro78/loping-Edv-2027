import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://bergencitymarathon.com';
const paths = [
  '/',
  '/loypeguide',
  '/hoydeprofil',
  '/drikkestasjoner',
  '/tempoplan',
  '/tempostrategi',
  '/praktisk',
  '/trening',
  '/om',
  '/slik-lop-de-beste',
  '/kontakt',
  '/personvern',
];

const urls = paths
  .map(
    (p) =>
      `  <url><loc>${origin}${p === '/' ? '' : p}</loc><changefreq>monthly</changefreq><priority>${p === '/' ? '1.0' : '0.8'}</priority></url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync(path.join(root, 'dist', 'sitemap.xml'), xml, 'utf8');
console.log('Wrote dist/sitemap.xml');
