# Explorer: maps, sharing, navigation IA

Source: how-explorer maps/sharing slice. Read-only. 2026-08-19.

## Verdict

Map Analysis is a Leaflet demo on fake Accra data. No live survey GPS, no save/share, no in-app nav to it. Real artifacts are Saved Questions and Dashboards plus Hub pins. Reports are a separate stakeholder board, mostly localStorage. Create/list exists. Search, duplicate, public share, and PDF export do not.

## Nav facts

- `StudioLayout` defines lab/prep/dashboard/spatial submenu. No caller passes `onSelectAnalyticsTool`.
- Only `Dashboard.tsx` mounts `AnalyticsHub`, with `projectId={undefined}`. Org sidebar has no Data item.
- Project Data → Analysis is a dashed stub. Project Hub: “Maps stay hidden until a later phase.”
- Datasets “Analyze” URL `/dashboard?tab=data&tool=lab` is rewritten to datasets (drops tool).
- `toolCards` in AnalyticsHub are header labels, not a Looker-style Create / Recent / Shared home.

## Map capabilities

Implemented as demo: Leaflet basemap, fake choropleth/heat/clusters/points on `DEMO_AREAS` / `DEMO_STORES`.
Stubs: drawing, geofence, layer picker, query builder, saved/recent, 3D coming soon.
Absent: live GPS, admin GeoJSON join, save, share, export, map viz_type, Kepler/Mapbox/deck.gl.
GPS exists in capture and Prep (Google Maps link) and Walker (flattened `"lat,lng"` string). Spatial never reads it.

## Create and share

- Lab save question: implemented.
- Dashboard create: implemented. New Question composer is a stub.
- Map artifact: absent.
- Org report board: localStorage.
- Search / Recents / Shared with me / duplicate / public link / PDF: absent.
- Delete APIs exist; Canvas never calls them.
- Pin Hub: max 4, no walker/markdown/map.
- Permissions: org membership only. `created_by` unused for ACL.

## Nouns that are UI modes, not objects

Analysis Lab, Data Prep, Map Analysis, Charts/Explore. Saving always creates a Question (or a derived dataset from Prep). Dashboards and Reports are the shareable nouns, and they are not the same thing.
