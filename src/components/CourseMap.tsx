import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Droplet, PersonStanding, ArrowLeftRight, ArrowUp, ArrowDown, ArrowRight, Grid2x2, Play, Pause } from 'lucide-react';
import * as L from 'leaflet';
import maplibregl from 'maplibre-gl';
import { GPX_URL, LAP, PACE_SCALE, POIS, TB, TERR, TW, paceColor, publicUrl, type Poi, type TerrKey } from '../config';
import { clockDot, fmtP, fmtT, kmL, nb } from '../lib/format';
import { elevAt, pointAt, type Pt } from '../lib/gpx';
import { gradeOf, paceOf, type Plan } from '../lib/model';
import { useActivePlan, useHover } from '../state/active';
import { useCourse } from '../state/course';
import { usePlan } from '../state/plan';
import type { UiCopy } from '../i18n/ui';
import { useUi } from '../i18n/useUi';
import { splitMarks, terrOf } from '../lib/marks';

const ATTR = 'Kart © Esri, HERE, Garmin, Intermap, © OpenStreetMap-bidragsytere';
const TERR_ICON: Record<TerrKey, typeof ArrowUp> = {
  climb: ArrowUp,
  flat: ArrowRight,
  down: ArrowDown,
  cobble: Grid2x2,
};

function paceTrend(pace: number, ref: number): 'up' | 'down' | 'flat' {
  if (pace <= 0 || ref <= 0) return 'flat';
  const d = (pace - ref) / ref;
  if (d > 0.02) return 'down';
  if (d < -0.02) return 'up';
  return 'flat';
}
const FLY_MOVE_MS = 75000;
const FLY_SPEED = { sakte: 0.35, normal: 0.7, rask: 1.4 } as const;
type FlySpeed = keyof typeof FLY_SPEED;
const FLY_PAUSE_MS = 1000;
function flyRows(full: boolean, marks: UiCopy['marks']): { km: number; name: string }[] {
  const rows = splitMarks(full, marks).filter((m) => m.km > 0.05);
  for (const [km, name] of full ? [[5, '5 km'], [42.194, '42,2 km']] as [number, string][] : [[5, '5 km']] as [number, string][]) {
    if (!rows.some((r) => Math.abs(r.km - km) <= 0.02)) rows.push({ km, name });
  }
  rows.sort((a, b) => a.km - b.km);
  return rows;
}

/** Km langs løypa etter animasjonstid, med ett sekunds stopp på hver drikkestasjon. */
export function flyProgress(elapsed: number, D: number, stations: number[]): { km: number; paused: boolean; done: boolean } {
  const move = (D / LAP) * FLY_MOVE_MS;
  const stops = stations.filter((s) => s > 0.05 && s < D - 0.05).sort((a, b) => a - b);
  let t = 0;
  let prev = 0;
  for (const st of stops) {
    const seg = ((st - prev) / D) * move;
    if (elapsed <= t + seg) {
      const f = seg <= 0 ? 1 : (elapsed - t) / seg;
      return { km: prev + (st - prev) * f, paused: false, done: false };
    }
    t += seg;
    if (elapsed <= t + FLY_PAUSE_MS) return { km: st, paused: true, done: false };
    t += FLY_PAUSE_MS;
    prev = st;
  }
  const seg = ((D - prev) / D) * move;
  if (elapsed >= t + seg) return { km: D, paused: false, done: true };
  const f = seg <= 0 ? 1 : (elapsed - t) / seg;
  return { km: prev + (D - prev) * f, paused: false, done: false };
}

function showPoi(p: Poi, layers: { drink: boolean; toilet: boolean; relay: boolean; terrain: boolean }, full: boolean) {
  if (p.fullOnly && !full) return false;
  if (p.t.every((t) => t === 'start' || t === 'info')) return true;
  return (
    (p.t.includes('drink') && layers.drink) ||
    (p.t.includes('toilet') && layers.toilet) ||
    (p.t.includes('relay') && layers.relay) ||
    ((p.t.includes('steep') || p.t.includes('cobble')) && layers.terrain)
  );
}

function popupNode(poi: Poi, lat: number, lng: number, plan: Plan, mapUi: UiCopy['map']): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pop';
  const km = poi.showKm ?? poi.km;
  const head = document.createElement('p');
  head.className = 'pop-km';
  head.textContent =
    km == null ? mapUi.offCourse : `Km ${kmL(km)}${poi.approx ? mapUi.approxPlacement : ''}`;
  const title = document.createElement('p');
  title.className = 'pop-title';
  title.textContent = poi.n;
  const types = document.createElement('p');
  types.className = 'pop-types';
  types.textContent = poi.t
    .map((t) =>
      t === 'relay' && poi.relay != null
        ? mapUi.relayFmt.replace('{n}', String(poi.relay))
        : mapUi.poiType[t],
    )
    .join(' · ');
  el.append(head, title, types);
  if (poi.d) {
    const d = document.createElement('p');
    d.className = 'pop-d';
    d.textContent = poi.d;
    el.append(d);
  }
  const planLine = (timeSec: number) =>
    mapUi.planAt.replace('{time}', fmtT(timeSec)).replace('{clock}', clockDot(plan.input.start, timeSec));
  if (poi.fullOnly) {
    el.append(timeLine(planLine(plan.tAt(21.5))));
  } else if (poi.km != null && !plan.input.full) {
    el.append(timeLine(planLine(plan.tAt(poi.km))));
  } else if (poi.km != null) {
    const t1 = plan.tAt(poi.km);
    const t2 = plan.tAt(poi.km + LAP);
    el.append(
      timeLine(
        mapUi.round1At
          .replace('{km}', kmL(poi.km))
          .replace('{time}', fmtT(t1))
          .replace('{clock}', clockDot(plan.input.start, t1)),
      ),
    );
    el.append(
      timeLine(
        mapUi.round2At
          .replace('{km}', kmL(poi.km + LAP))
          .replace('{time}', fmtT(t2))
          .replace('{clock}', clockDot(plan.input.start, t2)),
      ),
    );
  }
  const a = document.createElement('a');
  a.className = 'btn primary pop-btn';
  a.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = mapUi.openGoogleMaps;
  el.append(a);
  return el;
}

function timeLine(text: string) {
  const p = document.createElement('p');
  p.className = 'pop-time';
  p.textContent = text;
  return p;
}

function markerHtml(poi: Poi): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'mk-wrap';
  const el = document.createElement('div');
  if (poi.t.includes('start')) el.className = 'mk mk-start';
  else if (poi.t.includes('relay')) {
    el.className = 'mk mk-relay';
    el.textContent = String(poi.relay ?? '');
  } else if (poi.t.includes('drink')) el.className = 'mk mk-drink';
  else if (poi.t.includes('cobble')) el.className = 'mk mk-cobble';
  else if (poi.t.includes('steep')) el.className = 'mk mk-steep';
  else if (poi.t.includes('toilet')) {
    el.className = 'mk mk-toilet';
    el.textContent = 'WC';
  } else el.className = 'mk mk-info';
  if (poi.t.includes('cobble')) for (let i = 0; i < 5; i++) el.append(document.createElement('i'));
  wrap.append(el);
  if (poi.t.includes('relay') && poi.t.includes('toilet')) {
    const tag = document.createElement('span');
    tag.className = 'wc-tag';
    tag.textContent = 'WC';
    wrap.append(tag);
  }
  return wrap;
}

function chunks(plan: Plan, pts: Pt[]) {
  const pieces: { a: number; b: number; color: string }[] = [];
  for (const s of plan.segs) {
    if (s.lap !== 0) continue;
    const color = paceColor(plan.p0 !== 0 ? s.t / (s.d * plan.p0) : 1);
    const last = pieces[pieces.length - 1];
    if (last && last.color === color) last.b = s.x0 + s.d;
    else pieces.push({ a: s.x0, b: s.x0 + s.d, color });
  }
  return pieces.map((pc) => {
    const latlngs: [number, number][] = [];
    const a = pointAt(pts, pc.a);
    latlngs.push([a.lat, a.lng]);
    for (const p of pts) if (p.km > pc.a + 1e-6 && p.km < pc.b - 1e-6) latlngs.push([p.lat, p.lng]);
    const b = pointAt(pts, pc.b);
    latlngs.push([b.lat, b.lng]);
    return { color: pc.color, latlngs };
  });
}

export function CourseMap() {
  const { state, patch, setLayer } = usePlan();
  const course = useCourse();
  const { plan } = useActivePlan();
  const uiCopy = useUi();
  const { km, setKm } = useHover();
  const el2 = useRef<HTMLDivElement>(null);
  const el3 = useRef<HTMLDivElement>(null);
  const map2 = useRef<L.Map | null>(null);
  const group = useRef<L.LayerGroup | null>(null);
  const hover2 = useRef<L.CircleMarker | null>(null);
  const map3 = useRef<maplibregl.Map | null>(null);
  const markers3 = useRef<maplibregl.Marker[]>([]);
  const hover3 = useRef<maplibregl.Marker | null>(null);
  const fitted2 = useRef('');
  const fitted3 = useRef('');
  const [playing, setPlaying] = useState(false);
  const [held, setHeld] = useState(false);
  const [flySpeed, setFlySpeed] = useState<FlySpeed>('normal');
  const [flyPause, setFlyPause] = useState(false);
  const heldRef = useRef(false);
  const speedRef = useRef(1);
  heldRef.current = held;
  speedRef.current = FLY_SPEED[flySpeed];
  const view3dRef = useRef(state.view3d);
  view3dRef.current = state.view3d;

  useEffect(() => {
    if (!el2.current || map2.current) return;
    const map = L.map(el2.current, {
      scrollWheelZoom: false,
      minZoom: 11,
      maxZoom: 18,
      maxBounds: L.latLngBounds([TW.s + 0.03, TW.w + 0.08], [TW.n - 0.03, TW.e - 0.08]),
      maxBoundsViscosity: 1,
    });
    const wide = L.latLngBounds([TW.s, TW.w], [TW.n, TW.e]);
    const tight = L.latLngBounds([TB.s, TB.w], [TB.n, TB.e]);
    const tiles = publicUrl('tiles/');
    L.tileLayer(`${tiles}topo/{z}/{x}/{y}.jpg`, {
      minZoom: 11, maxZoom: 18, minNativeZoom: 11, maxNativeZoom: 13, bounds: wide, attribution: ATTR,
    }).addTo(map);
    L.tileLayer(`${tiles}topo/{z}/{x}/{y}.jpg`, {
      minZoom: 14, maxZoom: 18, minNativeZoom: 14, maxNativeZoom: 16, bounds: tight,
    }).addTo(map);
    map.setView([60.395, 5.335], 13);
    group.current = L.layerGroup().addTo(map);
    map2.current = map;
    return () => {
      map.remove();
      map2.current = null;
    };
  }, []);

  useEffect(() => {
    const map = map2.current;
    const g = group.current;
    if (!map || !g || !plan || course.points.length < 2) return;
    g.clearLayers();
    const pts = course.points;
    L.polyline(pts.map((p) => [p.lat, p.lng] as [number, number]), { color: '#fff', weight: 9, opacity: 0.95 }).addTo(g);
    for (const c of chunks(plan, pts)) {
      L.polyline(c.latlngs, { color: c.color, weight: 5, lineCap: 'round', lineJoin: 'round' }).addTo(g);
    }
    for (const poi of POIS) {
      if (!showPoi(poi, state.layers, plan.input.full)) continue;
      const pos = poi.km != null && course.status === 'ok' ? pointAt(pts, poi.km) : { lat: poi.lat, lng: poi.lng };
      const icon = L.divIcon({ className: 'mk-icon', html: markerHtml(poi), iconSize: [28, 28], iconAnchor: [14, 14] });
      L.marker([pos.lat, pos.lng], { icon })
        .bindPopup(() => popupNode(poi, pos.lat, pos.lng, plan, uiCopy.map), { maxWidth: 260, className: 'poi-pop' })
        .addTo(g);
    }
    const id = `${course.name}:${pts.length}`;
    if (fitted2.current !== id) {
      map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [24, 24] });
      fitted2.current = id;
    }
  }, [plan, course.points, course.status, course.name, state.layers, uiCopy.map]);

  useEffect(() => {
    if (!state.view3d || map3.current || !el3.current) return;
    const base = publicUrl('tiles/');
    const map = new maplibregl.Map({
      container: el3.current,
      style: {
        version: 8,
        sources: {
          satW: { type: 'raster', tiles: [`${base}sat/{z}/{x}/{y}.jpg`], tileSize: 256, minzoom: 11, maxzoom: 13, bounds: [TW.w, TW.s, TW.e, TW.n], attribution: 'Flyfoto © Esri, Maxar, Earthstar Geographics' },
          sat: { type: 'raster', tiles: [`${base}sat/{z}/{x}/{y}.jpg`], tileSize: 256, minzoom: 14, maxzoom: 16, bounds: [TB.w, TB.s, TB.e, TB.n] },
          dem: { type: 'raster-dem', tiles: [`${base}dem/{z}/{x}/{y}.png`], encoding: 'terrarium', tileSize: 256, minzoom: 10, maxzoom: 14, bounds: [TW.w, TW.s, TW.e, TW.n], attribution: 'Terreng: Mapzen / AWS Open Data' },
          dem2: { type: 'raster-dem', tiles: [`${base}dem/{z}/{x}/{y}.png`], encoding: 'terrarium', tileSize: 256, minzoom: 10, maxzoom: 14, bounds: [TW.w, TW.s, TW.e, TW.n] },
        },
        layers: [
          { id: 'satW', type: 'raster', source: 'satW', paint: { 'raster-saturation': -0.25 } },
          { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.25 } },
          { id: 'hs', type: 'hillshade', source: 'dem2', paint: { 'hillshade-exaggeration': 0.25, 'hillshade-shadow-color': '#12304A' } },
        ],
        terrain: { source: 'dem', exaggeration: 1.6 },
        sky: {},
      },
      center: [5.335, 60.395],
      zoom: 13.3,
      pitch: 62,
      bearing: -25,
      maxPitch: 80,
      minZoom: 11.5,
      maxZoom: 18,
      maxBounds: [[TW.w + 0.06, TW.s + 0.025], [TW.e - 0.06, TW.n - 0.025]],
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
    map3.current = map;
    return () => {
      markers3.current.forEach((m) => m.remove());
      hover3.current?.remove();
      map.remove();
      map3.current = null;
    };
  }, [state.view3d]);

  useEffect(() => {
    const map = map3.current;
    if (!map || !state.view3d || !plan || course.points.length < 2) return;
    const draw = () => {
      const pts = course.points;
      const casing = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: pts.map((p) => [p.lng, p.lat]) } };
      const colored = {
        type: 'FeatureCollection' as const,
        features: chunks(plan, pts).map((c) => ({
          type: 'Feature' as const,
          properties: { c: c.color },
          geometry: { type: 'LineString' as const, coordinates: c.latlngs.map(([lat, lng]) => [lng, lat]) },
        })),
      };
      const put = (id: string, data: object) => {
        const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(data as GeoJSON.GeoJSON);
        else map.addSource(id, { type: 'geojson', data: data as GeoJSON.GeoJSON });
      };
      put('casing', casing);
      put('colored', colored);
      if (!map.getLayer('casing')) {
        map.addLayer({ id: 'casing', type: 'line', source: 'casing', paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      }
      if (!map.getLayer('colored')) {
        map.addLayer({ id: 'colored', type: 'line', source: 'colored', paint: { 'line-color': ['get', 'c'], 'line-width': 5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      }
      markers3.current.forEach((m) => m.remove());
      markers3.current = POIS.filter((poi) => showPoi(poi, state.layers, plan.input.full)).map((poi) => {
        const pos = poi.km != null && course.status === 'ok' ? pointAt(pts, poi.km) : { lat: poi.lat, lng: poi.lng };
        return new maplibregl.Marker({ element: markerHtml(poi), anchor: 'center', subpixelPositioning: true })
          .setLngLat([pos.lng, pos.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16, maxWidth: '260px' }).setDOMContent(
              popupNode(poi, pos.lat, pos.lng, plan, uiCopy.map),
            ),
          )
          .addTo(map);
      });
      const id = `${course.name}:${pts.length}`;
      if (fitted3.current !== id) {
        const b = new maplibregl.LngLatBounds();
        pts.forEach((p) => b.extend([p.lng, p.lat]));
        map.fitBounds(b, { padding: 40, pitch: 62, bearing: -25, duration: 0 });
        fitted3.current = id;
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
  }, [plan, course.points, course.status, course.name, state.layers, state.view3d, uiCopy.map]);

  useEffect(() => {
    const map = map2.current;
    if (!map || course.points.length < 2) return;
    if (km == null) {
      hover2.current?.remove();
      hover2.current = null;
      return;
    }
    const p = pointAt(course.points, km);
    if (!hover2.current) {
      hover2.current = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#12304A', fillOpacity: 1 }).addTo(map);
    } else hover2.current.setLatLng([p.lat, p.lng]);
  }, [km, course.points]);

  useEffect(() => {
    const map = map3.current;
    if (!map || !state.view3d) return;
    if (km == null) {
      hover3.current?.remove();
      hover3.current = null;
      return;
    }
    const p = pointAt(course.points, km);
    if (!hover3.current) {
      const dot = document.createElement('div');
      dot.className = 'mk-hover';
      hover3.current = new maplibregl.Marker({ element: dot, anchor: 'center', subpixelPositioning: true }).setLngLat([p.lng, p.lat]).addTo(map);
    } else hover3.current.setLngLat([p.lng, p.lat]);
  }, [km, course.points, state.view3d]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (state.view3d) map3.current?.resize();
      else map2.current?.invalidateSize();
    });
  }, [state.view3d]);

  useEffect(() => {
    if (!playing || !plan) return;
    const pts = course.points;
    if (pts.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPlaying(false);
      return;
    }
    let frame = 0;
    let dead = false;
    let elapsed = 0;
    let last = performance.now();
    let br = map3.current?.getBearing() ?? -25;
    let zoomed2 = false;
    let lastPaint = 0;
    const pauseRef = { current: false };
    const D = plan.D;
    const stations = plan.stations;
    const loop = (now: number) => {
      if (dead) return;
      const dt = now - last;
      last = now;
      if (!heldRef.current) elapsed += dt * speedRef.current;
      const step = flyProgress(elapsed, D, stations);
      const k = step.km;
      const p = pointAt(pts, k);
      const q = pointAt(pts, Math.min(D, k + 0.35));
      if (view3dRef.current && map3.current) {
        const map = map3.current;
        const lat = (p.lat * Math.PI) / 180;
        let delta = (Math.atan2((q.lng - p.lng) * Math.cos(lat), q.lat - p.lat) * 180) / Math.PI - br;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        br += delta * 0.04;
        map.jumpTo({ center: [p.lng, p.lat], bearing: br, pitch: 66, zoom: 15.4 });
      } else if (map2.current) {
        const map = map2.current;
        if (!zoomed2) {
          map.setView([p.lat, p.lng], 15.6, { animate: false });
          zoomed2 = true;
        } else map.panTo([p.lat, p.lng], { animate: false });
      }
      if (now - lastPaint > 80 || step.paused !== pauseRef.current || step.done) {
        lastPaint = now;
        if (step.paused !== pauseRef.current) {
          pauseRef.current = step.paused;
          setFlyPause(step.paused);
        }
        setKm(k);
      }
      if (!step.done) frame = requestAnimationFrame(loop);
      else {
        setPlaying(false);
        setHeld(false);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => {
      dead = true;
      cancelAnimationFrame(frame);
    };
  }, [playing, course.points, setKm, plan]);

  return (
    <section className="section map-section" id="kart">
      <div className="wrap">
        <div className="section-head">
          <div>
            <h2>{uiCopy.map.h2}</h2>
            <p className="intro">{uiCopy.map.intro.replace('{name}', course.name)}</p>
          </div>
          <div className="pills" role="group" aria-label={uiCopy.map.layers}>
            <Layer on={state.layers.drink} label={uiCopy.map.drink} icon={<Droplet size={16} />} onClick={() => setLayer('drink', !state.layers.drink)} />
            <Layer on={state.layers.toilet} label={uiCopy.map.toilet} icon={<PersonStanding size={16} />} onClick={() => setLayer('toilet', !state.layers.toilet)} />
            <Layer on={state.layers.relay} label={uiCopy.map.relay} icon={<ArrowLeftRight size={16} />} onClick={() => setLayer('relay', !state.layers.relay)} />
            <Layer on={state.layers.terrain} label={uiCopy.map.terrain} icon={<ArrowUp size={16} />} onClick={() => setLayer('terrain', !state.layers.terrain)} />
          </div>
        </div>
        <div className="map-shell">
          <div className="map-switch" role="group" aria-label={uiCopy.map.mapView}>
            <button type="button" aria-pressed={!state.view3d} onClick={() => patch({ view3d: false })}>
              {uiCopy.map.view2d}
            </button>
            <button type="button" aria-pressed={state.view3d} onClick={() => patch({ view3d: true })}>
              {uiCopy.map.view3d}
            </button>
          </div>
          <div ref={el2} className="map-2d" hidden={state.view3d} />
          <div ref={el3} className="map-3d" hidden={!state.view3d} />
          {course.status === 'estimated' && <p className="map-overlay">{uiCopy.map.estimated}</p>}
          <div className="fly-bar">
          {playing && plan && (
            <div className="fly-hud" aria-live="polite">
              <p className="fly-label">{uiCopy.map.time}</p>
              <p className="fly-time">{fmtT(plan.tAt(km ?? 0))}</p>
              <p className="fly-km">{nb(km ?? 0, 1)} km</p>
              {flyPause && <p className="fly-stop">{uiCopy.map.drinkPause}</p>}
              <ul>
                {(() => {
                  const here = km ?? 0;
                  const rows = flyRows(plan.input.full, uiCopy.marks).filter((m) => m.km <= plan.D + 0.02);
                  let hit = -1;
                  for (let i = 0; i < rows.length; i++) if (here + 0.02 >= rows[i].km) hit = i;
                  if (hit < 0) return null;
                  const m = rows[hit];
                  const a = hit === 0 ? 0 : rows[hit - 1].km;
                  const g = plan.agg(a, m.km);
                  const terr = terrOf(a, m.km, gradeOf(g));
                  const meta = TERR[terr];
                  const Icon = TERR_ICON[terr];
                  const pace = paceOf(g);
                  const ref = hit === 0 ? plan.p0 : paceOf(plan.agg(hit < 2 ? 0 : rows[hit - 2].km, a));
                  const trend = paceTrend(pace, ref);
                  const PaceIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : ArrowRight;
                  const paceLabel =
                    trend === 'up' ? uiCopy.map.faster : trend === 'down' ? uiCopy.map.slower : uiCopy.map.even;
                  return (
                    <li key={`${m.km}-${m.name}`} className="is-on">
                      <span className="fly-name">
                        {m.name}
                        <small>{kmL(m.km)} km</small>
                      </span>
                      <span className="fly-tags">
                        <span className="chip" style={{ background: meta.chipBg, color: meta.chipFg }}>
                          <Icon size={12} strokeWidth={2} /> {uiCopy.terrain[terr]}
                        </span>
                        <span className={`chip pace-${trend}`}>
                          <PaceIcon size={12} strokeWidth={2} /> {paceLabel} {fmtP(pace)}
                        </span>
                      </span>
                      <b>{fmtT(plan.tAt(m.km))}</b>
                    </li>
                  );
                })()}
              </ul>
            </div>
          )}
            <div className="fly-actions">
            <button
              type="button"
              className="btn fly"
              onClick={() => {
                if (!playing) {
                  setHeld(false);
                  setPlaying(true);
                } else setHeld((v) => !v);
              }}
            >
              {!playing || held ? <Play size={16} /> : <Pause size={16} />}{' '}
              {!playing ? uiCopy.map.flyPlay : held ? uiCopy.map.flyResume : uiCopy.map.flyPause}
            </button>
            <div className="seg fly-speed" role="group" aria-label={uiCopy.map.flySpeed}>
              {(
                [
                  ['sakte', uiCopy.map.flySlow],
                  ['normal', uiCopy.map.flyNormal],
                  ['rask', uiCopy.map.flyFast],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={flySpeed === id} onClick={() => setFlySpeed(id)}>
                  {label}
                </button>
              ))}
            </div>
            </div>
          </div>
          <div className="map-legend">
            <p>{uiCopy.map.paceLegend}</p>
            {PACE_SCALE.map((s, i) => (
              <div key={s.max}>
                <i style={{ background: s.c }} /> {uiCopy.map.paceScale[i]}
              </div>
            ))}
          </div>
        </div>
        <p className="map-actions">
          <a className="btn secondary" href={GPX_URL} download>
            {uiCopy.map.downloadGpx}
          </a>
        </p>
        <p className="help">{uiCopy.map.helpLocal}</p>
        {plan && (
          <details className="explain">
            <summary>{uiCopy.map.tableSummary}</summary>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">{uiCopy.map.tableKm}</th>
                    <th scope="col">{uiCopy.map.tableNear}</th>
                    <th scope="col">{uiCopy.map.tableElev}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 23 }, (_, i) => Math.min(LAP, i)).map((k) => {
                    const near = [...POIS].filter((p) => p.km != null).sort((a, b) => Math.abs((a.km as number) - k) - Math.abs((b.km as number) - k))[0];
                    return (
                      <tr key={k}>
                        <th scope="row">{kmL(k)}</th>
                        <td>{near?.n}</td>
                        <td>
                          {Math.round(elevAt(course.points, k))} {uiCopy.elevationPanel.moh}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function Layer({ on, label, icon, onClick }: { on: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={`pill toggle-pill ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {icon} {label}
    </button>
  );
}
