import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Circle,
  Layers,
  MapPin,
  Minus,
  MousePointer2,
  Pentagon,
  Plus,
  Save,
  Share2,
  Download,
  Sparkles,
  Square,
  Play,
  X,
  ChevronDown,
  Flame,
  Group,
  Compass,
  Box,
} from 'lucide-react';

import {
  analyticsButtonClass,
  analyticsGhostButtonClass,
  analyticsInputClass,
  analyticsLabelClass,
} from './ui';

type MetricMode = 'percentage' | 'count' | 'locations' | 'density';
type GroupBy = 'area' | 'store' | 'team' | 'none';
type MapMode = 'choropleth' | 'heatmap' | 'clusters' | 'points';
type ResultsTab = 'results' | 'charts' | 'insights';
type BuilderTab = 'builder' | 'saved' | 'recent';

type AreaFeature = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Approximate polygon ring [lng, lat][] around the centroid */
  ring: [number, number][];
  percentage: number;
  respondents: number;
  stores: number;
  fieldHours: number;
};

type ExampleQuery = {
  id: string;
  label: string;
  showMe: MetricMode;
  question: string;
  questionDetail?: string;
  where: string;
  groupBy: GroupBy;
  timeFilter: string;
  mapMode: MapMode;
  insight: string;
};

const ACCRA_CENTER: L.LatLngExpression = [5.6037, -0.187];

function ringAround(lat: number, lng: number, radiusDeg = 0.018): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const jitter = 0.7 + ((i * 13) % 5) * 0.06;
    pts.push([lng + Math.cos(a) * radiusDeg * jitter, lat + Math.sin(a) * radiusDeg * jitter * 0.85]);
  }
  pts.push(pts[0]);
  return pts;
}

const DEMO_AREAS: AreaFeature[] = [
  { id: 'east-legon', name: 'East Legon', lat: 5.64, lng: -0.148, percentage: 65, respondents: 320, stores: 14, fieldHours: 42, ring: ringAround(5.64, -0.148, 0.02) },
  { id: 'airport', name: 'Airport Residential', lat: 5.605, lng: -0.175, percentage: 82, respondents: 210, stores: 9, fieldHours: 28, ring: ringAround(5.605, -0.175, 0.016) },
  { id: 'osu', name: 'Osu', lat: 5.555, lng: -0.175, percentage: 48, respondents: 410, stores: 22, fieldHours: 61, ring: ringAround(5.555, -0.175, 0.015) },
  { id: 'cantonments', name: 'Cantonments', lat: 5.575, lng: -0.168, percentage: 71, respondents: 185, stores: 11, fieldHours: 33, ring: ringAround(5.575, -0.168, 0.014) },
  { id: 'madina', name: 'Madina', lat: 5.683, lng: -0.167, percentage: 38, respondents: 520, stores: 31, fieldHours: 88, ring: ringAround(5.683, -0.167, 0.022) },
  { id: 'adenta', name: 'Adenta', lat: 5.708, lng: -0.155, percentage: 29, respondents: 290, stores: 18, fieldHours: 54, ring: ringAround(5.708, -0.155, 0.02) },
  { id: 'tema', name: 'Tema Community 1', lat: 5.67, lng: -0.02, percentage: 55, respondents: 340, stores: 16, fieldHours: 47, ring: ringAround(5.67, -0.02, 0.018) },
  { id: 'spintex', name: 'Spintex', lat: 5.635, lng: -0.1, percentage: 44, respondents: 380, stores: 24, fieldHours: 72, ring: ringAround(5.635, -0.1, 0.02) },
  { id: 'labone', name: 'Labone', lat: 5.565, lng: -0.16, percentage: 76, respondents: 150, stores: 8, fieldHours: 22, ring: ringAround(5.565, -0.16, 0.012) },
  { id: 'dansoman', name: 'Dansoman', lat: 5.545, lng: -0.265, percentage: 22, respondents: 460, stores: 27, fieldHours: 95, ring: ringAround(5.545, -0.265, 0.022) },
  { id: 'achimota', name: 'Achimota', lat: 5.62, lng: -0.22, percentage: 41, respondents: 275, stores: 15, fieldHours: 58, ring: ringAround(5.62, -0.22, 0.018) },
  { id: 'kaneshie', name: 'Kaneshie', lat: 5.57, lng: -0.235, percentage: 33, respondents: 390, stores: 29, fieldHours: 81, ring: ringAround(5.57, -0.235, 0.016) },
];

const EXAMPLE_QUERIES: ExampleQuery[] = [
  {
    id: 'ideal-only',
    label: '% buy only Ideal Milk 400g',
    showMe: 'percentage',
    question: 'Which milk brand / size do you usually buy?',
    questionDetail: 'only Ideal Milk 400g',
    where: 'All Locations',
    groupBy: 'area',
    timeFilter: 'Last 3 Months',
    mapMode: 'choropleth',
    insight: 'Ideal Milk 400g exclusive buyers cluster in Airport Residential and Labone. Dansoman and Adenta lag below 30%.',
  },
  {
    id: 'stores-sku',
    label: 'Stores selling Ideal 400g / 250g',
    showMe: 'locations',
    question: 'Which Ideal Milk SKUs are stocked at this store?',
    questionDetail: '400g or 250g',
    where: 'Greater Accra',
    groupBy: 'store',
    timeFilter: 'Last 30 Days',
    mapMode: 'points',
    insight: '146 stores stock Ideal 400g or 250g. Density is highest along Spintex Road and Osu.',
  },
  {
    id: 'field-time',
    label: 'Where sales teams spend most time',
    showMe: 'density',
    question: 'Field visit duration (check-in → check-out)',
    questionDetail: undefined,
    where: 'All Locations',
    groupBy: 'area',
    timeFilter: 'This Week',
    mapMode: 'heatmap',
    insight: 'Teams spend the most hours in Dansoman, Madina, and Kaneshie — strong coverage, but Airport Residential is under-visited relative to opportunity.',
  },
];

function pctColor(pct: number): string {
  if (pct >= 80) return '#15803d';
  if (pct >= 60) return '#4ade80';
  if (pct >= 40) return '#facc15';
  if (pct >= 20) return '#fb923c';
  return '#ef4444';
}

function densityColor(hours: number, maxHours: number): string {
  const t = hours / maxHours;
  if (t >= 0.8) return '#7c2d12';
  if (t >= 0.6) return '#ea580c';
  if (t >= 0.4) return '#fb923c';
  if (t >= 0.2) return '#fdba74';
  return '#ffedd5';
}

function metricLabel(mode: MetricMode): string {
  switch (mode) {
    case 'percentage':
      return '% Percentage';
    case 'count':
      return 'Count';
    case 'locations':
      return 'Locations';
    case 'density':
      return 'Time density';
  }
}

type ClusterTier = 'high' | 'mid' | 'low';

function clusterCountFor(area: AreaFeature, showMe: MetricMode): number {
  if (showMe === 'density') return area.fieldHours;
  if (showMe === 'locations') return area.stores * 8;
  return area.respondents;
}

function clusterTier(count: number): ClusterTier {
  if (count >= 100) return 'high';
  if (count >= 50) return 'mid';
  return 'low';
}

function formatClusterLabel(count: number): string {
  if (count >= 100) return '100+';
  if (count >= 50) return '50+';
  if (count >= 20) return '20+';
  return String(count);
}

const CLUSTER_COLORS: Record<ClusterTier, { core: string; glow: string; ring: string }> = {
  high: { core: '#e11d48', glow: 'rgba(225, 29, 72, 0.55)', ring: 'rgba(225, 29, 72, 0.4)' },
  mid: { core: '#f59e0b', glow: 'rgba(245, 158, 11, 0.5)', ring: 'rgba(245, 158, 11, 0.38)' },
  low: { core: '#38bdf8', glow: 'rgba(56, 189, 248, 0.5)', ring: 'rgba(56, 189, 248, 0.36)' },
};

const PIN_PALETTE = ['#7c3aed', '#06b6d4', '#84cc16', '#1d4ed8', '#f97316', '#db2777', '#14b8a6', '#eab308'] as const;

type StorePoint = {
  id: string;
  areaId: string;
  areaName: string;
  storeName: string;
  lat: number;
  lng: number;
  color: string;
  manager: string;
  nearestWarehouseKm: number;
  annualSalesMil: number;
  primaryWarehouse: string;
  percentage: number;
  respondents: number;
};

const DEMO_MANAGERS = [
  'Phillip I. Lindsay',
  'Ama Boateng',
  'Kwesi Mensah',
  'Sarah Okai',
  'Daniel Quaye',
  'Efua Asante',
  'Joseph Tetteh',
  'Nana Adjei',
];

const DEMO_WAREHOUSES = ['Tema Hub', 'Spintex DC', 'Achimota Depot', 'Kaneshie Yard', 'Airport Cold Store'];

function buildDemoStores(): StorePoint[] {
  const stores: StorePoint[] = [];
  DEMO_AREAS.forEach((area, areaIndex) => {
    const n = Math.min(Math.max(3, Math.round(area.stores / 3)), 6);
    for (let i = 0; i < n; i += 1) {
      const offsetLat = Math.sin(i * 2.1 + area.lat * 10) * 0.011;
      const offsetLng = Math.cos(i * 1.7 + area.lng * 10) * 0.011;
      const color = PIN_PALETTE[(areaIndex + i) % PIN_PALETTE.length];
      stores.push({
        id: `${area.id}-store-${i + 1}`,
        areaId: area.id,
        areaName: area.name,
        storeName: `${area.name.split(' ')[0].toUpperCase()} ${i + 1}`,
        lat: area.lat + offsetLat,
        lng: area.lng + offsetLng,
        color,
        manager: DEMO_MANAGERS[(areaIndex + i) % DEMO_MANAGERS.length],
        nearestWarehouseKm: Number((12 + ((areaIndex * 17 + i * 9) % 220) + (i * 3.4)).toFixed(2)),
        annualSalesMil: Number((8 + ((area.percentage / 10) + i * 4.2 + areaIndex) % 55).toFixed(2)),
        primaryWarehouse: DEMO_WAREHOUSES[(areaIndex + i) % DEMO_WAREHOUSES.length],
        percentage: Math.max(12, Math.min(95, area.percentage + (i - 2) * 4)),
        respondents: Math.max(8, Math.round(area.respondents / n) + i * 3),
      });
    }
  });
  return stores;
}

const DEMO_STORES = buildDemoStores();

function ensureSpatialOverlayStyles() {
  if (typeof document === 'undefined') return;
  const STYLE_VERSION = 'cluster-glow-3';
  let style = document.getElementById('opla-spatial-overlay-styles') as HTMLStyleElement | null;
  if (style?.dataset.version === STYLE_VERSION) return;
  if (!style) {
    style = document.createElement('style');
    style.id = 'opla-spatial-overlay-styles';
    document.head.appendChild(style);
  }
  style.dataset.version = STYLE_VERSION;
  style.textContent = `
    .leaflet-div-icon.opla-cluster-icon,
    .leaflet-div-icon.opla-pin-icon {
      background: transparent;
      border: none;
    }
    .opla-cluster-wrap {
      position: relative;
      width: 84px;
      height: 84px;
      pointer-events: auto;
    }
    .opla-cluster-aura {
      position: absolute;
      inset: 8px;
      border-radius: 9999px;
      background: radial-gradient(
        circle at center,
        var(--opla-cluster-glow) 0%,
        var(--opla-cluster-ring) 42%,
        transparent 72%
      );
      opacity: 0.85;
      pointer-events: none;
    }
    .opla-cluster-ring {
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      border: none;
      background: radial-gradient(
        circle at center,
        var(--opla-cluster-glow) 0%,
        var(--opla-cluster-ring) 38%,
        transparent 70%
      );
      opacity: 0;
      transform: scale(0.28);
      transform-origin: center;
      animation: opla-cluster-ripple 2.6s cubic-bezier(0.15, 0.65, 0.3, 1) infinite;
      pointer-events: none;
    }
    .opla-cluster-ring:nth-child(2) { animation-delay: 0s; }
    .opla-cluster-ring:nth-child(3) { animation-delay: 0.85s; }
    .opla-cluster-ring:nth-child(4) { animation-delay: 1.7s; }
    .opla-cluster-core {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 42px;
      height: 42px;
      border-radius: 9999px;
      background: radial-gradient(
        circle at 50% 42%,
        color-mix(in srgb, var(--opla-cluster-core) 92%, white) 0%,
        var(--opla-cluster-core) 48%,
        color-mix(in srgb, var(--opla-cluster-core) 55%, transparent) 100%
      );
      color: #fff;
      font: 700 12px/42px ui-sans-serif, system-ui, sans-serif;
      text-align: center;
      text-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
      box-shadow: 0 0 16px var(--opla-cluster-glow);
      border: none;
      outline: none;
      z-index: 2;
      opacity: 0.92;
    }
    .opla-cluster-wrap.is-selected .opla-cluster-core {
      opacity: 1;
      box-shadow: 0 0 22px var(--opla-cluster-glow);
    }
    @keyframes opla-cluster-ripple {
      0% {
        transform: scale(0.22);
        opacity: 0.7;
      }
      55% {
        opacity: 0.22;
      }
      100% {
        transform: scale(1.12);
        opacity: 0;
      }
    }
    .opla-pin {
      width: 28px;
      height: 36px;
      filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.28));
      transition: transform 0.15s ease;
      transform-origin: 50% 100%;
    }
    .opla-pin.is-selected {
      transform: scale(1.18);
      filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.35));
    }
    .opla-pin svg { display: block; width: 28px; height: 36px; }
    .leaflet-popup.opla-pin-popup .leaflet-popup-content-wrapper {
      padding: 0;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.22);
      border: none;
    }
    .leaflet-popup.opla-pin-popup .leaflet-popup-content {
      margin: 0;
      width: 260px !important;
      line-height: 1.35;
    }
    .leaflet-popup.opla-pin-popup .leaflet-popup-tip {
      background: #fff;
      box-shadow: none;
    }
    .leaflet-popup.opla-pin-popup a.leaflet-popup-close-button {
      display: none;
    }
    .opla-pin-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: #2563eb;
      color: #fff;
      padding: 10px 12px;
      font: 700 13px/1.2 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .opla-pin-card-close {
      appearance: none;
      border: 0;
      background: transparent;
      color: rgba(255,255,255,0.9);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0 2px;
    }
    .opla-pin-card-body {
      background: #fff;
      padding: 12px 14px 10px;
    }
    .opla-pin-card-row {
      margin-bottom: 10px;
    }
    .opla-pin-card-row:last-child { margin-bottom: 0; }
    .opla-pin-card-label {
      display: block;
      font: 700 10px/1.2 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 2px;
    }
    .opla-pin-card-value {
      font: 600 13px/1.3 ui-sans-serif, system-ui, sans-serif;
      color: #334155;
    }
    .opla-pin-card-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 0 12px 12px;
      background: #fff;
    }
    .opla-pin-card-action {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: 0;
      background: #2563eb;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
  `;
}

function buildClusterIcon(count: number, selected: boolean): L.DivIcon {
  ensureSpatialOverlayStyles();
  const tier = clusterTier(count);
  const colors = CLUSTER_COLORS[tier];
  const label = formatClusterLabel(count);
  const html = `
    <div class="opla-cluster-wrap${selected ? ' is-selected' : ''}"
         style="--opla-cluster-core:${colors.core};--opla-cluster-glow:${colors.glow};--opla-cluster-ring:${colors.ring}">
      <span class="opla-cluster-aura"></span>
      <span class="opla-cluster-ring"></span>
      <span class="opla-cluster-ring"></span>
      <span class="opla-cluster-ring"></span>
      <span class="opla-cluster-core">${label}</span>
    </div>
  `;
  return L.divIcon({
    className: 'opla-cluster-icon',
    html,
    iconSize: [84, 84],
    iconAnchor: [42, 42],
  });
}

function buildPinIcon(color: string, selected: boolean): L.DivIcon {
  ensureSpatialOverlayStyles();
  const html = `
    <div class="opla-pin${selected ? ' is-selected' : ''}">
      <svg viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill="${color}" d="M14 0C6.82 0 1 5.82 1 13c0 9.75 11.2 21.6 11.68 22.1a1.5 1.5 0 0 0 2.14 0C15.3 34.6 27 22.75 27 13 27 5.82 21.18 0 14 0z"/>
        <circle cx="14" cy="13" r="5.2" fill="#fff"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    className: 'opla-pin-icon',
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -34],
  });
}

function buildPinPopupHtml(store: StorePoint): string {
  return `
    <div class="opla-pin-card">
      <div class="opla-pin-card-header">
        <span>${store.storeName}</span>
        <button type="button" class="opla-pin-card-close" data-opla-close-pin aria-label="Close">×</button>
      </div>
      <div class="opla-pin-card-body">
        <div class="opla-pin-card-row">
          <span class="opla-pin-card-label">Store manager</span>
          <span class="opla-pin-card-value">${store.manager}</span>
        </div>
        <div class="opla-pin-card-row">
          <span class="opla-pin-card-label">Nearest warehouse</span>
          <span class="opla-pin-card-value">${store.nearestWarehouseKm.toFixed(2)} km</span>
        </div>
        <div class="opla-pin-card-row">
          <span class="opla-pin-card-label">Annual sales ($mil)</span>
          <span class="opla-pin-card-value">$${store.annualSalesMil.toFixed(2)}</span>
        </div>
        <div class="opla-pin-card-row">
          <span class="opla-pin-card-label">Primary warehouse</span>
          <span class="opla-pin-card-value">${store.primaryWarehouse}</span>
        </div>
        <div class="opla-pin-card-row">
          <span class="opla-pin-card-label">Ideal Milk 400g only</span>
          <span class="opla-pin-card-value">${store.percentage}% · ${store.respondents} respondents</span>
        </div>
      </div>
      <div class="opla-pin-card-footer">
        <button type="button" class="opla-pin-card-action" title="Share" aria-label="Share">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
        <button type="button" class="opla-pin-card-action" title="Navigate" aria-label="Navigate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        </button>
      </div>
    </div>
  `;
}

export default function SpatialAnalysisLab() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const [activeExample, setActiveExample] = useState<string>(EXAMPLE_QUERIES[0].id);
  const [showMe, setShowMe] = useState<MetricMode>('percentage');
  const [question, setQuestion] = useState(EXAMPLE_QUERIES[0].question);
  const [questionDetail, setQuestionDetail] = useState(EXAMPLE_QUERIES[0].questionDetail ?? '');
  const [where, setWhere] = useState('All Locations');
  const [groupBy, setGroupBy] = useState<GroupBy>('area');
  const [timeFilter, setTimeFilter] = useState('Last 3 Months');
  const [mapMode, setMapMode] = useState<MapMode>('choropleth');
  const [showPoints, setShowPoints] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>('east-legon');
  const [resultsTab, setResultsTab] = useState<ResultsTab>('results');
  const [builderTab, setBuilderTab] = useState<BuilderTab>('builder');
  const [builderOpen, setBuilderOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [insight, setInsight] = useState(EXAMPLE_QUERIES[0].insight);
  const [queryTitle, setQueryTitle] = useState('% Buying Only Ideal Milk 400g By Area');

  const selectedArea = DEMO_AREAS.find(a => a.id === selectedAreaId) ?? null;

  const stats = useMemo(() => {
    const totalRespondents = DEMO_AREAS.reduce((s, a) => s + a.respondents, 0);
    const avgPct = DEMO_AREAS.reduce((s, a) => s + a.percentage, 0) / DEMO_AREAS.length;
    const totalStores = DEMO_AREAS.reduce((s, a) => s + a.stores, 0);
    const totalHours = DEMO_AREAS.reduce((s, a) => s + a.fieldHours, 0);
    const ranked = [...DEMO_AREAS].sort((a, b) => {
      if (showMe === 'density') return b.fieldHours - a.fieldHours;
      if (showMe === 'locations') return b.stores - a.stores;
      return b.percentage - a.percentage;
    });
    return {
      totalRespondents,
      avgPct,
      totalStores,
      totalHours,
      top: ranked.slice(0, 5),
      bottom: [...ranked].reverse().slice(0, 5),
      maxHours: Math.max(...DEMO_AREAS.map(a => a.fieldHours)),
    };
  }, [showMe]);

  const applyExample = (example: ExampleQuery) => {
    setActiveExample(example.id);
    setShowMe(example.showMe);
    setQuestion(example.question);
    setQuestionDetail(example.questionDetail ?? '');
    setWhere(example.where);
    setGroupBy(example.groupBy);
    setTimeFilter(example.timeFilter);
    setMapMode(example.mapMode);
    setInsight(example.insight);
    setQueryTitle(
      example.showMe === 'density'
        ? 'Field Hours By Area'
        : example.showMe === 'locations'
          ? 'Stores Stocking Ideal Milk 400g / 250g'
          : '% Buying Only Ideal Milk 400g By Area',
    );
    setShowPoints(example.mapMode === 'points');
  };

  const runQuery = () => {
    setRunning(true);
    window.setTimeout(() => {
      const match = EXAMPLE_QUERIES.find(q => q.id === activeExample);
      if (match) setInsight(match.insight);
      setRunning(false);
    }, 450);
  };

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: ACCRA_CENTER,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    // Flex layouts often report 0 height on first paint — fix after mount.
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 80);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Draw overlays when query / mode changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const valueFor = (area: AreaFeature) => {
      if (showMe === 'density') return area.fieldHours;
      if (showMe === 'locations') return area.stores;
      return area.percentage;
    };

    const colorFor = (area: AreaFeature) => {
      if (showMe === 'density') return densityColor(area.fieldHours, stats.maxHours);
      if (showMe === 'locations') return '#2563eb';
      return pctColor(area.percentage);
    };

    if (mapMode === 'choropleth' || mapMode === 'heatmap') {
      DEMO_AREAS.forEach(area => {
        const poly = L.polygon(
          area.ring.map(([lng, lat]) => [lat, lng] as L.LatLngExpression),
          {
            color: selectedAreaId === area.id ? '#0f766e' : '#ffffff',
            weight: selectedAreaId === area.id ? 2.5 : 1.25,
            fillColor: colorFor(area),
            fillOpacity: mapMode === 'heatmap' ? 0.55 + (area.fieldHours / stats.maxHours) * 0.35 : 0.72,
          },
        );
        poly.bindTooltip(
          `<div style="font-family:inherit;min-width:140px">
            <strong>${area.name}</strong><br/>
            ${showMe === 'density' ? `${area.fieldHours}h field time` : showMe === 'locations' ? `${area.stores} stores` : `${area.percentage}%`}
            <br/><span style="opacity:.7">${area.respondents} respondents</span>
          </div>`,
          { sticky: true, opacity: 0.95 },
        );
        poly.on('click', () => setSelectedAreaId(area.id));
        poly.addTo(layer);
      });
    }

    if (mapMode === 'clusters') {
      DEMO_AREAS.forEach(area => {
        const count = clusterCountFor(area, showMe);
        const marker = L.marker([area.lat, area.lng], {
          icon: buildClusterIcon(count, selectedAreaId === area.id),
          riseOnHover: true,
        });
        marker.bindTooltip(
          `<div style="font-family:inherit;min-width:140px">
            <strong>${area.name}</strong><br/>
            ${formatClusterLabel(count)} responses in cluster
            <br/><span style="opacity:.7">${area.respondents} respondents · ${area.stores} stores</span>
          </div>`,
          { direction: 'top', offset: [0, -18], opacity: 0.95 },
        );
        marker.on('click', () => setSelectedAreaId(area.id));
        marker.addTo(layer);
      });
    }

    if ((mapMode === 'points' || showPoints) && mapMode !== 'clusters') {
      DEMO_STORES.forEach(store => {
        const marker = L.marker([store.lat, store.lng], {
          icon: buildPinIcon(store.color, false),
          riseOnHover: true,
        });
        marker.bindPopup(buildPinPopupHtml(store), {
          className: 'opla-pin-popup',
          closeButton: false,
          offset: [0, -4],
          maxWidth: 280,
          autoPan: true,
        });
        marker.on('click', () => {
          setSelectedAreaId(store.areaId);
        });
        marker.on('popupopen', event => {
          const popupEl = (event as L.PopupEvent).popup.getElement();
          const closeBtn = popupEl?.querySelector('[data-opla-close-pin]');
          if (!closeBtn) return;
          const onClose = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            marker.closePopup();
          };
          closeBtn.addEventListener('click', onClose, { once: true });
        });
        marker.addTo(layer);
      });
    }

    // Soft glow for heatmap feel
    if (mapMode === 'heatmap') {
      DEMO_AREAS.forEach(area => {
        L.circle([area.lat, area.lng], {
          radius: 600 + area.fieldHours * 18,
          color: 'transparent',
          fillColor: densityColor(area.fieldHours, stats.maxHours),
          fillOpacity: 0.25,
        }).addTo(layer);
      });
    }

    void valueFor;
  }, [mapMode, showMe, showPoints, selectedAreaId, stats.maxHours]);

  const zoomBy = (delta: number) => {
    mapRef.current?.setZoom((mapRef.current.getZoom() ?? 12) + delta);
  };

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Geospatial Analysis</h1>
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Demo
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500">Retail Survey · Greater Accra · sample data</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={analyticsGhostButtonClass}>
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
          <button type="button" className={analyticsGhostButtonClass}>
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button type="button" className={analyticsGhostButtonClass}>
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Demo data
          </span>
        </div>
      </header>

      {/* Example question chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Try</span>
        {EXAMPLE_QUERIES.map(ex => {
          const active = activeExample === ex.id;
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => applyExample(ex)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/60'
              }`}
            >
              {ex.label}
            </button>
          );
        })}
      </div>

      {/* Quick query bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className={analyticsLabelClass}>Show me</label>
              <select
                value={showMe}
                onChange={e => setShowMe(e.target.value as MetricMode)}
                className={analyticsInputClass}
              >
                <option value="percentage">% Percentage</option>
                <option value="count">Count</option>
                <option value="locations">Locations</option>
                <option value="density">Time density</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={analyticsLabelClass}>Question</label>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                className={analyticsInputClass}
                placeholder="Ask a geographic question…"
              />
            </div>
            <div>
              <label className={analyticsLabelClass}>Where</label>
              <select value={where} onChange={e => setWhere(e.target.value)} className={analyticsInputClass}>
                <option>All Locations</option>
                <option>Greater Accra</option>
                <option>Selected map area</option>
              </select>
            </div>
            <div>
              <label className={analyticsLabelClass}>Group by</label>
              <select
                value={groupBy}
                onChange={e => setGroupBy(e.target.value as GroupBy)}
                className={analyticsInputClass}
              >
                <option value="area">Area</option>
                <option value="store">Store</option>
                <option value="team">Sales team</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden min-w-[140px] lg:block">
              <label className={analyticsLabelClass}>Filters</label>
              <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                Time: {timeFilter}
              </div>
            </div>
            <button type="button" onClick={runQuery} disabled={running} className={`${analyticsButtonClass} shrink-0 px-4`}>
              <Play className="h-3.5 w-3.5" />
              {running ? 'Running…' : 'Run Query'}
            </button>
          </div>
        </div>
      </div>

      {/* Map + results */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[420px] flex-1 lg:min-h-0">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />

          {/* Drawing tools */}
          <div className="pointer-events-auto absolute left-3 top-3 z-[500] flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur">
            {[
              { icon: Layers, label: 'Layers' },
              { icon: MousePointer2, label: 'Select' },
              { icon: Square, label: 'Rectangle' },
              { icon: Circle, label: 'Circle' },
              { icon: Pentagon, label: 'Polygon' },
              { icon: MapPin, label: 'Point' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                title={label}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="pointer-events-none absolute left-14 top-3 z-[500] max-w-[220px] rounded-lg border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Legend</p>
            <p className="mt-1 text-xs font-semibold leading-snug text-slate-800">{queryTitle}</p>
            <div className="mt-3 space-y-1.5">
              {mapMode === 'clusters' ? (
                [
                  { label: '100+ responses', color: '#e11d48' },
                  { label: '50+ responses', color: '#f59e0b' },
                  { label: 'Under 50', color: '#38bdf8' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute inset-0 rounded-full opacity-30" style={{ background: row.color }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
                    </span>
                    {row.label}
                  </div>
                ))
              ) : mapMode === 'points' || showPoints ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {PIN_PALETTE.map(color => (
                      <span
                        key={color}
                        className="h-3 w-3 rounded-full border border-white shadow-sm"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] leading-snug text-slate-500">
                    Store pins · click for manager, warehouse & sales
                  </p>
                </div>
              ) : showMe === 'density' ? (
                [
                  { label: 'High field time', color: '#7c2d12' },
                  { label: 'Medium', color: '#fb923c' },
                  { label: 'Low', color: '#ffedd5' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="h-2.5 w-5 rounded-sm" style={{ background: row.color }} />
                    {row.label}
                  </div>
                ))
              ) : showMe === 'locations' ? (
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Store with Ideal 400g / 250g
                </div>
              ) : (
                [
                  { label: '80%+', color: '#15803d' },
                  { label: '60–79%', color: '#4ade80' },
                  { label: '40–59%', color: '#facc15' },
                  { label: '20–39%', color: '#fb923c' },
                  { label: 'Below 20%', color: '#ef4444' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="h-2.5 w-5 rounded-sm" style={{ background: row.color }} />
                    {row.label}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Viz toggles */}
          <div className="absolute right-3 top-3 z-[500] flex gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur">
            {(
              [
                { key: 'choropleth' as const, label: 'Areas', icon: Layers },
                { key: 'heatmap' as const, label: 'Heatmap', icon: Flame },
                { key: 'clusters' as const, label: 'Clusters', icon: Group },
                { key: 'points' as const, label: 'Points', icon: MapPin },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMapMode(key)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${
                  mapMode === key
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Zoom / 3D */}
          <div className="absolute bottom-16 right-3 z-[500] flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur">
            <button type="button" onClick={() => zoomBy(1)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50">
              <Plus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => zoomBy(-1)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50">
              <Minus className="h-4 w-4" />
            </button>
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50" title="Compass">
              <Compass className="h-4 w-4" />
            </button>
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400" title="3D (coming soon)" disabled>
              <Box className="h-4 w-4" />
            </button>
          </div>

          {/* Show data points */}
          <div className="absolute bottom-4 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={showPoints}
                onChange={e => setShowPoints(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              Show data points
            </label>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Area tooltip card — pin popups handle Points mode */}
          {selectedArea && mapMode !== 'points' && !showPoints ? (
            <div className="absolute bottom-16 left-3 z-[500] w-[220px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedArea.name}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                    {showMe === 'density'
                      ? `${selectedArea.fieldHours}h`
                      : showMe === 'locations'
                        ? selectedArea.stores
                        : `${selectedArea.percentage}%`}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Respondents: {selectedArea.respondents.toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAreaId(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" className="mt-3 text-xs font-semibold text-emerald-700 hover:underline">
                View details
              </button>
            </div>
          ) : null}
        </div>

        {/* Results sidebar */}
        <aside className="flex w-full shrink-0 flex-col border-t border-slate-200 bg-white lg:w-[320px] lg:border-l lg:border-t-0">
          <div className="flex border-b border-slate-200">
            {(['results', 'charts', 'insights'] as ResultsTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setResultsTab(tab)}
                className={`flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                  resultsTab === tab
                    ? 'border-b-2 border-emerald-700 text-emerald-800'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {resultsTab === 'results' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Overall</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {showMe === 'density' ? 'Total hours' : showMe === 'locations' ? 'Stores' : 'Avg %'}
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                        {showMe === 'density'
                          ? stats.totalHours
                          : showMe === 'locations'
                            ? stats.totalStores
                            : `${stats.avgPct.toFixed(1)}%`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Respondents</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                        {stats.totalRespondents.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <RankingList
                  title={showMe === 'density' ? 'Top areas (hours)' : 'Top areas'}
                  items={stats.top}
                  showMe={showMe}
                  onSelect={setSelectedAreaId}
                  selectedId={selectedAreaId}
                />
                <RankingList
                  title={showMe === 'density' ? 'Lowest coverage' : 'Bottom areas'}
                  items={stats.bottom}
                  showMe={showMe}
                  onSelect={setSelectedAreaId}
                  selectedId={selectedAreaId}
                />
              </div>
            ) : null}

            {resultsTab === 'charts' ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Horizontal ranking of the current metric by area.</p>
                <div className="space-y-2">
                  {[...DEMO_AREAS]
                    .sort((a, b) => (showMe === 'density' ? b.fieldHours - a.fieldHours : b.percentage - a.percentage))
                    .map(area => {
                      const value = showMe === 'density' ? area.fieldHours : showMe === 'locations' ? area.stores : area.percentage;
                      const max = showMe === 'density' ? stats.maxHours : showMe === 'locations' ? 31 : 100;
                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => setSelectedAreaId(area.id)}
                          className="w-full text-left"
                        >
                          <div className="mb-1 flex justify-between text-[11px]">
                            <span className="font-medium text-slate-700">{area.name}</span>
                            <span className="tabular-nums text-slate-500">
                              {showMe === 'density' ? `${value}h` : showMe === 'locations' ? value : `${value}%`}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all"
                              style={{ width: `${Math.max(6, (value / max) * 100)}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : null}

            {resultsTab === 'insights' ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Insight</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{insight}</p>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  Demo only — insights will be generated from live survey GPS, store catalogs, and attendance once wired.
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Detailed query builder */}
      <div className="border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4">
          <div className="flex">
            {(
              [
                { key: 'builder' as const, label: 'Query Builder' },
                { key: 'saved' as const, label: 'Saved Queries' },
                { key: 'recent' as const, label: 'Recent Queries' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setBuilderTab(tab.key);
                  setBuilderOpen(true);
                }}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                  builderTab === tab.key && builderOpen
                    ? 'border-b-2 border-emerald-700 text-emerald-800'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBuilderOpen(o => !o)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            {builderOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {builderOpen ? (
          <div className="px-4 py-4">
            {builderTab === 'builder' ? (
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <FieldBlock label="Show me">
                  <div className="flex gap-2">
                    <select
                      value={showMe}
                      onChange={e => setShowMe(e.target.value as MetricMode)}
                      className={analyticsInputClass}
                    >
                      <option value="percentage">% Percentage</option>
                      <option value="count">Count</option>
                      <option value="locations">Locations</option>
                      <option value="density">Time density</option>
                    </select>
                    <select className={analyticsInputClass} defaultValue="responses">
                      <option value="responses">Responses</option>
                      <option value="stores">Store visits</option>
                      <option value="attendance">Attendance</option>
                    </select>
                  </div>
                </FieldBlock>

                <FieldBlock label="Question">
                  <select
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    className={analyticsInputClass}
                  >
                    {EXAMPLE_QUERIES.map(q => (
                      <option key={q.id} value={q.question}>
                        {q.question}
                      </option>
                    ))}
                  </select>
                  {questionDetail ? (
                    <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Where answer</span>
                      <span className="font-medium">{questionDetail}</span>
                    </div>
                  ) : null}
                </FieldBlock>

                <FieldBlock label="Where">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                      {where}
                    </span>
                    <button type="button" className={analyticsGhostButtonClass}>
                      <MapPin className="h-3.5 w-3.5" />
                      Add location filter
                    </button>
                  </div>
                </FieldBlock>

                <FieldBlock label="Group by">
                  <select
                    value={groupBy}
                    onChange={e => setGroupBy(e.target.value as GroupBy)}
                    className={analyticsInputClass}
                  >
                    <option value="area">Area</option>
                    <option value="store">Store</option>
                    <option value="team">Sales team</option>
                    <option value="none">None</option>
                  </select>
                </FieldBlock>

                <FieldBlock label="Filters">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700">Time</span>
                    <span className="text-xs text-slate-400">is in</span>
                    <select
                      value={timeFilter}
                      onChange={e => setTimeFilter(e.target.value)}
                      className={`${analyticsInputClass} w-auto min-w-[140px]`}
                    >
                      <option>Last 3 Months</option>
                      <option>Last 30 Days</option>
                      <option>This Week</option>
                      <option>Custom range…</option>
                    </select>
                    <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline">
                      + Add filter
                    </button>
                  </div>
                </FieldBlock>

                <div className="flex items-end justify-end gap-2 lg:col-span-2 xl:col-span-1">
                  <button
                    type="button"
                    className={analyticsGhostButtonClass}
                    onClick={() => applyExample(EXAMPLE_QUERIES[0])}
                  >
                    Clear
                  </button>
                  <button type="button" className={analyticsGhostButtonClass}>
                    <Save className="h-3.5 w-3.5" />
                    Save Query
                  </button>
                  <button type="button" onClick={runQuery} className={analyticsButtonClass}>
                    <Play className="h-3.5 w-3.5" />
                    Run
                  </button>
                </div>
              </div>
            ) : null}

            {builderTab === 'saved' ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {EXAMPLE_QUERIES.map(q => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => applyExample(q)}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    <p className="text-sm font-semibold text-slate-800">{q.label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {metricLabel(q.showMe)} · {q.groupBy} · {q.timeFilter}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}

            {builderTab === 'recent' ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {EXAMPLE_QUERIES.map((q, i) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => applyExample(q)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-700">{q.label}</span>
                      <span className="text-[11px] text-slate-400">{i === 0 ? 'Just now' : `${i + 1}h ago`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={analyticsLabelClass}>{label}</label>
      {children}
    </div>
  );
}

function RankingList({
  title,
  items,
  showMe,
  onSelect,
  selectedId,
}: {
  title: string;
  items: AreaFeature[];
  showMe: MetricMode;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map(area => {
          const value =
            showMe === 'density' ? `${area.fieldHours}h` : showMe === 'locations' ? String(area.stores) : `${area.percentage}%`;
          const active = selectedId === area.id;
          return (
            <li key={area.id}>
              <button
                type="button"
                onClick={() => onSelect(area.id)}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition ${
                  active ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="font-medium">{area.name}</span>
                <span className="tabular-nums text-slate-500">{value}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">
        View full ranking
      </button>
    </div>
  );
}
