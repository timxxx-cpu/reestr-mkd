import React, { useMemo } from 'react';
import Map, { Layer, Source } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { geometry3857To4326 } from '@lib/geometry-utils';

const BASEMAPS = {
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
  },
  cartoLight: {
    id: 'cartoLight',
    label: 'Carto Light',
    style: {
      version: 8,
      sources: {
        carto: {
          type: 'raster',
          tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors © CARTO',
        },
      },
      layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
    },
  },
};

const layerFill = {
  id: 'candidates-fill',
  type: 'fill',
  paint: {
    'fill-color': [
      'case',
      ['==', ['get', 'candidateId'], ['get', 'selectedId']],
      '#0284c7',
      ['==', ['get', 'assigned'], true],
      '#f59e0b',
      '#94a3b8',
    ],
    'fill-opacity': 0.35,
  },
};

const layerOutline = {
  id: 'candidates-line',
  type: 'line',
  paint: {
    'line-color': [
      'case',
      ['==', ['get', 'candidateId'], ['get', 'selectedId']],
      '#0369a1',
      '#334155',
    ],
    'line-width': 2,
  },
};

const toFeatureCollection = (candidates = [], selectedId = null) => ({
  type: 'FeatureCollection',
  features: candidates
    .filter(item => item?.geometry)
    .map(item => ({
      type: 'Feature',
      geometry: geometry3857To4326(item.geometry),
      properties: {
        candidateId: item.id,
        selectedId,
        assigned: !!item.assignedBuildingId,
      },
    })),
});

export const GeometryPickerMap = ({
  candidates = [],
  selectedId,
  onSelect,
  height = 400,
  basemap = 'osm',
}) => {
  const sourceData = useMemo(() => toFeatureCollection(candidates, selectedId), [candidates, selectedId]);

  const first = candidates.find(x => x?.geometry);
  const initialView = useMemo(() => {
    const firstCoord = geometry3857To4326(first?.geometry)?.coordinates?.[0]?.[0]?.[0];
    return {
      longitude: firstCoord?.[0] || 69.2401,
      latitude: firstCoord?.[1] || 41.2995,
      zoom: firstCoord ? 15 : 10,
    };
  }, [first]);

  return (
    <div className="w-full rounded-xl border border-slate-200 overflow-hidden">
      <Map
        mapLib={maplibregl}
        initialViewState={initialView}
        mapStyle={BASEMAPS[basemap]?.style || BASEMAPS.osm.style}
        style={{ width: '100%', height }}
        interactiveLayerIds={[layerFill.id]}
        onClick={evt => {
          const feature = evt.features?.[0];
          const candidateId = feature?.properties?.candidateId;
          if (candidateId && onSelect) onSelect(candidateId);
        }}
      >
        <Source id="geometry-candidates" type="geojson" data={sourceData}>
          <Layer {...layerFill} />
          <Layer {...layerOutline} />
        </Source>
      </Map>
    </div>
  );
};

export const BASEMAP_OPTIONS = Object.values(BASEMAPS).map(item => ({ value: item.id, label: item.label }));
