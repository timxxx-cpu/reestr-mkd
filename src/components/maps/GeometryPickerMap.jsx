import React, { useMemo, useRef, useEffect } from 'react';
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
  googleSatellite: {
    id: 'googleSatellite',
    label: 'Google Satellite',
    style: {
      version: 8,
      sources: {
        googleSatellite: {
          type: 'raster',
          tiles: [
            'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          ],
          tileSize: 256,
          attribution: '© Google',
        },
      },
      layers: [{ id: 'google-satellite', type: 'raster', source: 'googleSatellite' }],
    },
  },
};

const safeGeometryConvert = (geom) => {
  if (!geom || !geom.coordinates) return geom;
  try {
    const firstCoordStr = JSON.stringify(geom.coordinates).match(/-?\d+\.?\d*/);
    if (firstCoordStr) {
      const val = Math.abs(parseFloat(firstCoordStr[0]));
      if (val > 180) {
        return geometry3857To4326(geom);
      }
    }
  } catch (e) {
    console.error('Coordinate check failed', e);
  }
  return geom;
};

const toFeatureCollection = (candidates = [], selectedId = null, activeId = null) => ({
  type: 'FeatureCollection',
  features: candidates
    .filter(item => item?.geometry)
    .map(item => ({
      type: 'Feature',
      geometry: safeGeometryConvert(item.geometry),
      properties: {
        candidateId: item.id,
        isSelected: item.id === selectedId,
        isActive: item.id === activeId,
        isAssigned: !!item.assignedBuildingId,
        isSavedGeometry: false,
      },
    })),
});

const toSingleFeatureCollection = (geometry, selectedId = null, activeId = null) => {
  if (!geometry) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: safeGeometryConvert(geometry),
        properties: {
          candidateId: selectedId || 'focused-geometry',
          isSelected: true,
          isActive: !!activeId,
          isAssigned: false,
          isSavedGeometry: false,
        },
      },
    ],
  };
};

// TS-Fix: Добавлены поля idx и kind ко всем объектам черновика
const toDraftFeatureCollection = (draftPoints = []) => {
  const points = Array.isArray(draftPoints) ? draftPoints : [];
  if (!points.length) return { type: 'FeatureCollection', features: [] };

  const features = points.map((point, idx) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: point },
    properties: { idx, kind: 'point' },
  }));

  if (points.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: points },
      properties: { idx: -1, kind: 'line' },
    });
  }

  if (points.length >= 3) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
      properties: { idx: -1, kind: 'polygon' },
    });
  }

  return { type: 'FeatureCollection', features };
};

function getBbox(featureCollection) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let hasData = false;

  const traverse = (coords) => {
    if (!Array.isArray(coords) || coords.length === 0) return;
    if (typeof coords[0] === 'number') {
      hasData = true;
      minLng = Math.min(minLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLng = Math.max(maxLng, coords[0]);
      maxLat = Math.max(maxLat, coords[1]);
    } else {
      coords.forEach(traverse);
    }
  };

  if (featureCollection?.features) {
    featureCollection.features.forEach(f => {
      if (f.geometry?.coordinates) traverse(f.geometry.coordinates);
    });
  }

  return hasData && minLng !== Infinity ? [[minLng, minLat], [maxLng, maxLat]] : null;
}

export const GeometryPickerMap = ({
  candidates = [],
  selectedId,
  activeId,
  savedGeometry,
  fitToSavedOnOpen = false,
  fitScopeKey = null,
  onSelect,
  height,
  basemap = 'osm',
  isDrawing = false,
  draftPoints = [],
  onDraftPointAdd,
}) => {
  const mapRef = useRef(null);
  const didInitialSavedFitRef = useRef(false);

  const sourceData = useMemo(() => {
    const collection = toFeatureCollection(candidates, selectedId, activeId);

    if (savedGeometry) {
      collection.features.push({
        type: 'Feature',
        geometry: safeGeometryConvert(savedGeometry),
        properties: {
          candidateId: 'saved-geometry',
          isSelected: false,
          isActive: false,
          isAssigned: false,
          isSavedGeometry: true,
        },
      });
    }

    return collection;
  }, [candidates, selectedId, activeId, savedGeometry]);

  const draftData = useMemo(() => toDraftFeatureCollection(draftPoints), [draftPoints]);

  const initialView = useMemo(() => ({
    longitude: 69.2401,
    latitude: 41.2995,
    zoom: 11,
  }), []);

  useEffect(() => {
    didInitialSavedFitRef.current = false;
  }, [fitScopeKey]);

  useEffect(() => {
    if (!mapRef.current || sourceData.features.length === 0) return;

    // 1. Ищем кандидата, на которого кликнули в списке (activeId)
    const activeCandidate = activeId
      ? candidates.find(item => item?.id === activeId && item?.geometry)
      : null;

    // 2. Ищем кандидата, который уже прикреплен к зданию (selectedId)
    const selectedCandidate = selectedId
      ? candidates.find(item => item?.id === selectedId && item?.geometry)
      : null;

    const shouldFitSavedNow = fitToSavedOnOpen && savedGeometry && !didInitialSavedFitRef.current;
    
    // 3. Выбираем, на чем сфокусировать карту. ПРИОРИТЕТ:
    // - Сохраненная геометрия (при открытии)
    // - Активный кандидат (кликнули в списке)
    // - Выбранный кандидат (прикреплен)
    // - Все полигоны (по умолчанию)
    const focusedCollection = shouldFitSavedNow
      ? toSingleFeatureCollection(savedGeometry, 'saved-geometry', null)
      : activeCandidate?.geometry
        ? toSingleFeatureCollection(activeCandidate.geometry, null, activeId)
        : selectedCandidate?.geometry
          ? toSingleFeatureCollection(selectedCandidate.geometry, selectedId, activeId)
          : sourceData;

    const bounds = getBbox(focusedCollection);
    if (bounds) {
      try {
        if (shouldFitSavedNow) didInitialSavedFitRef.current = true;
        
        if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
          mapRef.current.flyTo({ center: bounds[0], zoom: 17, duration: 1500 });
        } else {
          // Вызываем fitBounds - карта полетит к выбранному объекту
          mapRef.current.fitBounds(bounds, { padding: 80, duration: 1200, maxZoom: 18 });
        }
      } catch (err) {
        console.warn('Не удалось изменить рамки карты', err);
      }
    }
  }, [candidates, sourceData, selectedId, activeId, fitToSavedOnOpen, savedGeometry]);

  return (
    // TS-Fix: Высота обрабатывается здесь, позволяя прокидывать и 100% и 400
    <div className="w-full rounded-xl border border-slate-200 overflow-hidden relative" style={{ height: height || 400 }}>
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={initialView}
        mapStyle={BASEMAPS[basemap]?.style || BASEMAPS.osm.style}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={isDrawing ? [] : ['candidates-fill']}
        onClick={evt => {
          if (isDrawing) {
            onDraftPointAdd?.([evt.lngLat.lng, evt.lngLat.lat]);
            return;
          }
          const feature = evt.features?.[0];
          const candidateId = feature?.properties?.candidateId;
          if (candidateId && candidateId !== 'saved-geometry' && onSelect) {
            onSelect(candidateId);
          }
        }}
      >
        <Source id="geometry-candidates" type="geojson" data={sourceData}>
          <Layer
            id="candidates-fill"
            type="fill"
            paint={{
              'fill-color': [
                'case',
                ['==', ['get', 'isSavedGeometry'], true], '#10b981',
                ['==', ['get', 'isSelected'], true], '#10b981',
                ['==', ['get', 'isActive'], true], '#3b82f6',
                ['==', ['get', 'isAssigned'], true], '#f59e0b',
                '#94a3b8',
              ],
              'fill-opacity': ['case', ['==', ['get', 'isActive'], true], 0.6, 0.4],
            }}
          />
          <Layer
            id="candidates-line"
            type="line"
            paint={{
              'line-color': [
                'case',
                ['==', ['get', 'isSavedGeometry'], true], '#059669',
                ['==', ['get', 'isSelected'], true], '#059669',
                ['==', ['get', 'isActive'], true], '#2563eb',
                '#334155',
              ],
              'line-width': ['case', ['==', ['get', 'isActive'], true], 3, 2],
            }}
          />
        </Source>

        {!!draftData.features.length && (
          <Source id="geometry-draft" type="geojson" data={draftData}>
            <Layer
              id="geometry-draft-fill"
              type="fill"
              filter={['==', ['geometry-type'], 'Polygon']}
              paint={{ 'fill-color': '#0ea5e9', 'fill-opacity': 0.25 }}
            />
            <Layer
              id="geometry-draft-line"
              type="line"
              filter={['==', ['geometry-type'], 'LineString']}
              paint={{ 'line-color': '#0284c7', 'line-width': 2.5, 'line-dasharray': [2, 2] }}
            />
            <Layer
              id="geometry-draft-points"
              type="circle"
              filter={['==', ['geometry-type'], 'Point']}
              paint={{
                'circle-color': '#0369a1',
                'circle-stroke-color': '#e0f2fe',
                'circle-stroke-width': 2,
                'circle-radius': 5,
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
};

export const BASEMAP_OPTIONS = Object.values(BASEMAPS).map(item => ({ value: item.id, label: item.label }));