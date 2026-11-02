/** Kanonisk domene for canonical, sitemap og Open Graph. */
export const SITE_ORIGIN = 'https://bergencitymarathon.com';

export const ADSENSE_CLIENT =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADSENSE_CLIENT) || 'ca-pub-7828159998054709';

export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  /** Sider uten annonser i innholdet og uten ekstra annonseblokker. */
  noAds?: boolean;
  /** Ikke last AdSense-script i head (kontakt/personvern). */
  noAdScript?: boolean;
  /** WebSite kun på forsiden; ellers Article der det passer. */
  schema?: 'website' | 'article' | 'none';
};

export const ROUTES: RouteMeta[] = [
  {
    path: '/',
    title: 'Bergen City Marathon 2027 – uavhengig løypeguide',
    description:
      'Uavhengig guide til løypa i Bergen: tempoplan, etapper, trening og praktisk info for halvmaraton og maraton. Ikke tilknyttet arrangøren.',
    schema: 'website',
  },
  {
    path: '/loypeguide',
    title: 'Løypeguide Bergen City Marathon 2027',
    description:
      'Løypa del for del: Bryggen, Gamle Bergen, Fjellveien, Store Lungegårdsvann, Nygårdsparken og Nordnes – med taktikk og underlag.',
    schema: 'article',
  },
  {
    path: '/hoydeprofil',
    title: 'Høydeprofil og kart – Bergen City Marathon 2027',
    description:
      'Interaktiv høydeprofil og kart over BCM-løypa: stigning mot Fjellveien, etapper og drikkestasjoner.',
    schema: 'article',
  },
  {
    path: '/tempoplan',
    title: 'Tempoplan og kalkulator – Bergen City Marathon',
    description:
      'Regn ut jevn innsats på kupert bylløype: måltid, split-strategi, bakker og drikkestopp tilpasset BCM-løypa.',
    schema: 'article',
  },
  {
    path: '/tempostrategi',
    title: 'Tempostrategi på kupert maraton og halvmaraton',
    description:
      'Hvordan fordele krefter i motbakke og nedoverbakke på Bergen City Marathon – uten å jage klokka opp Fjellveien.',
    schema: 'article',
  },
  {
    path: '/praktisk',
    title: 'Praktisk før løpsdagen – Bergen City Marathon',
    description:
      'Start og mål, garderobe, transport til Bryggen, overnatting og det du bør ha med i sekken.',
    schema: 'article',
  },
  {
    path: '/trening',
    title: 'Trening mot Bergen City Marathon 2027',
    description:
      'Oppkjøring de siste tolv ukene, bakketrening mot Fjellveien og formkrav knyttet til måltiden din.',
    schema: 'article',
  },
  {
    path: '/om',
    title: 'Om denne løpeguiden',
    description:
      'Hvem som står bak siden, hvorfor den finnes, og at den er uavhengig av TIF Viking og Bergen City Marathon.',
    schema: 'article',
  },
  {
    path: '/slik-lop-de-beste',
    title: 'Slik løp de beste – Bergen City Marathon',
    description:
      'Tolv seire og ni vinnere fra 2024 til 2026: tempo, dueller og hvor løpene ble avgjort.',
    schema: 'article',
  },
  {
    path: '/kontakt',
    title: 'Kontakt',
    description: 'Send spørsmål om løypa, tempoplanen eller nettstedet.',
    noAds: true,
    noAdScript: true,
  },
  {
    path: '/personvern',
    title: 'Personvernerklæring',
    description: 'Informasjonskapsler, Google AdSense, lokal lagring og dine rettigheter.',
    noAds: true,
    noAdScript: true,
  },
];

export function metaForPath(pathname: string): RouteMeta {
  const hit = ROUTES.find((r) => r.path === pathname);
  if (hit) return hit;
  return {
    path: pathname,
    title: 'Siden finnes ikke',
    description: 'Fant ikke siden du leter etter.',
    noAds: true,
    noAdScript: true,
    schema: 'none',
  };
}

export function canonicalUrl(path: string): string {
  const p = path === '/' ? '' : path.replace(/\/$/, '');
  return `${SITE_ORIGIN}${p || '/'}`;
}
