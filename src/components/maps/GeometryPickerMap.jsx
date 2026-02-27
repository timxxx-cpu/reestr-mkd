import React, { useMemo, useRef, useEffect } from 'react';
import Map, { Layer, Source } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { geometry3857To4326 } from '@lib/geometry-utils';
import { useQueryClient } from '@tanstack/react-query';

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

// Функция-помощник: проверяет, не в метрах ли координаты (EPSG:3857)
const safeGeometryConvert = (geom) => {
  if (!geom || !geom.coordinates) return geom;
  try {
    // Достаем первое попавшееся число из массива координат
    const firstCoordStr = JSON.stringify(geom.coordinates).match(/-?\d+\.?\d*/);
    if (firstCoordStr) {
      const val = Math.abs(parseFloat(firstCoordStr[0]));
      // Если значение больше 180 (градусов не бывает > 180), значит это огромные числа в метрах
      if (val > 180) {
        return geometry3857To4326(geom);
      }
    }
  } catch (e) {
    console.error("Coordinate check failed", e);
  }
  return geom; // Возвращаем как есть (значит уже градусы EPSG:4326)
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

// Утилита для расчета границ охвата (Bounding Box)
function getBbox(featureCollection) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
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
  savedGeometry, // <--- НОВЫЙ ПРОП
  onSelect,
  height = 400,
  basemap = 'osm',
}) => {
  const mapRef = useRef(null);
  
  const sourceData = useMemo(() => {
    const collection = toFeatureCollection(candidates, selectedId, activeId);
    
    // Если у проекта ЕСТЬ геометрия в БД, но среди текущих кандидатов 
    // нет выбранного (например, мы удалили SHP), мы принудительно рисуем её
    if (savedGeometry && !selectedId) {
      collection.features.push({
        type: 'Feature',
        geometry: safeGeometryConvert(savedGeometry),
        properties: {
          candidateId: 'saved-geometry',
          isSelected: false,   // <--- ДОБАВИТЬ
          isActive: false,     // <--- ДОБАВИТЬ
          isAssigned: false,   // <--- ДОБАВИТЬ
          isSavedGeometry: true, // Флаг для зеленого цвета
        }
      });
    }
    
    return collection;
  }, [candidates, selectedId, activeId, savedGeometry]);

  const initialView = useMemo(() => ({
    longitude: 69.2401,
    latitude: 41.2995,
    zoom: 11,
  }), []);

  useEffect(() => {
    if (!mapRef.current || sourceData.features.length === 0) return;
    
    const bounds = getBbox(sourceData);
    if (bounds) {
      try {
        if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
          mapRef.current.flyTo({ center: bounds[0], zoom: 17, duration: 1500 });
        } else {
          mapRef.current.fitBounds(bounds, { padding: 50, duration: 1500, maxZoom: 18 });
        }
      } catch (err) {
        console.warn("Не удалось изменить рамки карты", err);
      }
    }
  }, [candidates, sourceData]);

  return (
    <div className="w-full rounded-xl border border-slate-200 overflow-hidden relative">
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={initialView}
        mapStyle={BASEMAPS[basemap]?.style || BASEMAPS.osm.style}
        style={{ width: '100%', height }}
        interactiveLayerIds={['candidates-fill']}
        onClick={evt => {
          const feature = evt.features?.[0];
          const candidateId = feature?.properties?.candidateId;
          // Игнорируем клик по уже сохраненной статичной геометрии
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
                ['==', ['get', 'isSavedGeometry'], true], '#10b981', // Зеленый для геометрии из БД
                ['==', ['get', 'isSelected'], true], '#10b981', 
                ['==', ['get', 'isActive'], true], '#3b82f6',   
                ['==', ['get', 'isAssigned'], true], '#f59e0b', 
                '#94a3b8' 
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
                ['==', ['get', 'isSavedGeometry'], true], '#059669', // Темно-зеленый
                ['==', ['get', 'isSelected'], true], '#059669', 
                ['==', ['get', 'isActive'], true], '#2563eb',   
                '#334155'
              ],
              'line-width': ['case', ['==', ['get', 'isActive'], true], 3, 2],
            }}
          />
        </Source>
      </Map>
    </div>
  );
};

export const BASEMAP_OPTIONS = Object.values(BASEMAPS).map(item => ({ value: item.id, label: item.label }));