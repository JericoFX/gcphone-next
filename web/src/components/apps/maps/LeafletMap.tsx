import { createEffect, onCleanup } from 'solid-js';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './MapsApp.module.scss';

export interface LeafletPin {
  id: string;
  label: string;
  x: number;
  y: number;
  kind?: 'shared' | 'manual';
}

export interface LeafletLine {
  id: string;
  points: { x: number; y: number }[];
  color?: string;
}

interface Props {
  pins: LeafletPin[];
  lines?: LeafletLine[];
  onPickCoords?: (x: number, y: number) => void;
  onPinClick?: (pin: LeafletPin) => void;
}

const GTACRS: L.CRS = L.extend({}, L.CRS.Simple, {
  projection: L.Projection.LonLat,
  scale(zoom: number) {
    return Math.pow(2, zoom);
  },
  zoom(sc: number) {
    return Math.log(sc) / 0.6931471805599453;
  },
  distance(pos1: L.LatLng, pos2: L.LatLng) {
    const xDifference = pos2.lng - pos1.lng;
    const yDifference = pos2.lat - pos1.lat;
    return Math.sqrt(xDifference * xDifference + yDifference * yDifference);
  },
  transformation: new L.Transformation(0.02072, 117.3, -0.0205, 172.8),
  infinite: false,
});

const GTA_MAP_BOUNDS: L.LatLngBoundsExpression = [
  [-4000, -4000],
  [4000, 4000],
]

const gtaToLatLng = (x: number, y: number): [number, number] => [y, x];
const latLngToGta = (latLng: L.LatLng): [number, number] => [latLng.lng, latLng.lat];

export function LeafletMap(props: Props) {
  let mapElement: HTMLDivElement | undefined;
  let map: L.Map | null = null;
  const markers = new Map<string, L.Marker>();

  const makeIcon = (kind: 'shared' | 'manual' = 'shared') =>
    L.divIcon({
      className: styles.mapMarker,
      html: `<span class="${kind === 'manual' ? styles.mapMarkerManual : styles.mapMarkerShared}"></span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })

  createEffect(() => {
    if (!mapElement || map) return;

    map = L.map(mapElement, {
      crs: GTACRS,
      minZoom: 2,
      maxZoom: 6,
      zoom: 4,
      center: [0, -1024],
      maxBoundsViscosity: 1,
      attributionControl: false,
      zoomControl: true,
    })

    L.imageOverlay('./gta-map.jpeg', GTA_MAP_BOUNDS).addTo(map)

    map.on('click', (event: L.LeafletMouseEvent) => {
      const [x, y] = latLngToGta(event.latlng)
      props.onPickCoords?.(x, y)
    })
  })

  createEffect(() => {
    if (!map) return

    for (const pin of props.pins) {
      if (markers.has(pin.id)) continue
      const marker = L.marker(gtaToLatLng(pin.x, pin.y), { icon: makeIcon(pin.kind) })
      marker.bindTooltip(pin.label, { direction: 'top' })
      marker.on('click', () => props.onPinClick?.(pin))
      marker.addTo(map)
      markers.set(pin.id, marker)
    }

    const validIds = new Set(props.pins.map((pin) => pin.id))
    markers.forEach((marker, id) => {
      if (validIds.has(id)) return
      marker.removeFrom(map!)
      markers.delete(id)
    })
  })

  createEffect(() => {
    if (!map || props.pins.length === 0) return
    const first = props.pins[0]
    map.setView(gtaToLatLng(first.x, first.y), 4)
  })

  const polylines = new Map<string, L.Polyline>();

  createEffect(() => {
    if (!map) return;
    const lines = props.lines || [];

    for (const line of lines) {
      if (polylines.has(line.id)) continue;
      const latLngs = line.points.map((p) => gtaToLatLng(p.x, p.y) as [number, number]);
      if (latLngs.length < 2) continue;
      const poly = L.polyline(latLngs, { color: line.color || '#007aff', weight: 3, opacity: 0.7 });
      poly.addTo(map);
      polylines.set(line.id, poly);
    }

    const validIds = new Set(lines.map((l) => l.id));
    polylines.forEach((poly, id) => {
      if (validIds.has(id)) return;
      poly.removeFrom(map!);
      polylines.delete(id);
    });
  });

  onCleanup(() => {
    markers.forEach((marker) => marker.remove())
    markers.clear()
    polylines.forEach((poly) => poly.remove())
    polylines.clear()
    if (map) map.remove()
    map = null
  })

  return <div ref={mapElement} class={styles.mapCanvas} />
}
