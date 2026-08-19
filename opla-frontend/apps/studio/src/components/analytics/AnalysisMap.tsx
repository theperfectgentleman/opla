import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { analyticsAPI } from '../../lib/api';
import type { AnalyticsSource, AnalyticsToolProps } from './types';
import { analyticsPanelClass } from './ui';

function isGeoField(fieldType: string | null | undefined): boolean {
  const t = (fieldType || '').toLowerCase();
  return t.includes('gps') || t.includes('geo') || t === 'location';
}

function numberFrom(record: object, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in record)) continue;
    const n = Number(Reflect.get(record, key));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pointFromCell(value: unknown): { lat: number; lng: number } | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return pointFromCell(JSON.parse(value));
    } catch {
      const parts = value.split(',').map((part) => Number(part.trim()));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
      }
      return null;
    }
  }
  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const lat = numberFrom(value, ['lat', 'latitude']);
    const lng = numberFrom(value, ['lng', 'longitude', 'lon']);
    if (lat != null && lng != null) return { lat, lng };
  }
  return null;
}

export default function AnalysisMap({ orgId, sources }: AnalyticsToolProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [datasetId, setDatasetId] = useState(sources[0]?.dataset_id ?? '');
  const [fieldKey, setFieldKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const source = useMemo(
    () => sources.find((row) => row.dataset_id === datasetId) ?? sources[0] ?? null,
    [datasetId, sources],
  );

  const geoFields = useMemo(() => {
    if (!source) return [];
    return (source.fields || []).filter((field) => isGeoField(field.field_type));
  }, [source]);

  useEffect(() => {
    if (!fieldKey && geoFields[0]?.field_key) setFieldKey(geoFields[0].field_key);
  }, [fieldKey, geoFields]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current).setView([5.6, -0.2], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!source || !fieldKey || !orgId) return;
    let cancelled = false;
    const run = async () => {
      setError(null);
      try {
        const result = await analyticsAPI.runQuery(orgId, {
          dataset_id: source.dataset_id,
          select_fields: [fieldKey],
          limit: 2000,
          offset: 0,
        });
        if (cancelled) return;
        const points: Array<{ lat: number; lng: number }> = [];
        const rows = Array.isArray(result?.rows) ? result.rows : [];
        for (const row of rows) {
          const point = pointFromCell(row[fieldKey]);
          if (point) points.push(point);
        }
        setCount(points.length);
        const layer = layerRef.current;
        const map = mapRef.current;
        if (!layer || !map) return;
        layer.clearLayers();
        points.forEach((point) => {
          L.circleMarker([point.lat, point.lng], { radius: 6, color: '#047857', fillOpacity: 0.85 }).addTo(layer);
        });
        if (points.length > 0) {
          map.fitBounds(L.latLngBounds(points.map((point) => L.latLng(point.lat, point.lng))), {
            padding: [24, 24],
          });
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          const err = loadError as { response?: { data?: { detail?: string } }; message?: string };
          setError(err.response?.data?.detail || err.message || 'Could not load map points.');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [fieldKey, orgId, source]);

  if (sources.length === 0) {
    return <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">No datasets yet.</div>;
  }

  return (
    <div className={`${analyticsPanelClass} space-y-3 p-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-md border border-slate-200 px-2 text-sm"
          value={source?.dataset_id || ''}
          onChange={(event) => setDatasetId(event.target.value)}
        >
          {sources.map((row: AnalyticsSource) => (
            <option key={row.dataset_id} value={row.dataset_id}>
              {row.dataset_name || row.form_title}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border border-slate-200 px-2 text-sm"
          value={fieldKey}
          onChange={(event) => setFieldKey(event.target.value)}
        >
          {geoFields.length === 0 ? <option value="">No GPS field on this table</option> : null}
          {geoFields.map((field) => (
            <option key={field.field_key} value={field.field_key}>
              {field.label || field.field_key}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{count} points</span>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div ref={mapEl} className="h-[min(70vh,640px)] w-full rounded-md border border-slate-200" />
    </div>
  );
}
