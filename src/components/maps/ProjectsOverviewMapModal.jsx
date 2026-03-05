import React, { useMemo, useRef, useEffect, useState } from 'react';
import MapGL, { Layer, Source, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { X, ArrowLeft, MapPinned, RotateCcw, Play, Pause } from 'lucide-react';
import { BASEMAP_OPTIONS } from './GeometryPickerMap';

const OSM_STYLE = {
  version: 8,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const CARTO_STYLE = {
  version: 8,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

const SAT_STYLE = {
  version: 8,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    sat: {
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
  layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
};

/** @returns {any} */
const getStyle = basemap => {
  if (basemap === 'googleSatellite') return SAT_STYLE;
  if (basemap === 'cartoLight') return CARTO_STYLE;
  return OSM_STYLE;
};

const resolveBuildingHouseNumber = building => {
  const value = building?.houseNumber || building?.house_number || building?.address?.houseNumber || building?.address?.house_number;
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
};

const formatBuildingType = category => {
  const map = {
    residential: 'Жилой дом',
    residential_multiblock: 'Многоблочный жилой дом',
    parking_attached: 'Пристроенный паркинг',
    parking_separate: 'Отдельный паркинг',
    infrastructure: 'Инфраструктурный объект',
  };
  return map[String(category || '').trim()] || (category || '—');
};

const formatStatus = status => {
  const map = { IN_PROGRESS: 'В работе', COMPLETED: 'Завершено', DECLINED: 'Отказано' };
  return map[String(status || '').trim()] || (status || '—');
};

const parseGeometry = (geom) => {
  if (!geom) return null;
  let parsed = geom;
  if (parsed && typeof parsed === 'object' && parsed.type === 'jsonb' && parsed.value) {
    parsed = parsed.value;
  }
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) { return null; }
  }
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) { return null; }
  }
  if (parsed?.type === 'FeatureCollection') return parsed.features?.[0]?.geometry || null;
  if (parsed?.type === 'Feature') return parsed.geometry || null;
  if (parsed && typeof parsed === 'object' && parsed.type && parsed.coordinates) {
      return parsed;
  }
  return null;
};

const toProjectBuildingTypeStats = project => {
  if (Array.isArray(project?.buildingTypeStats) && project.buildingTypeStats.length) return project.buildingTypeStats;
  const buckets = new Map();
  (project?.buildings || []).forEach(b => {
    const key = b?.category || 'unknown';
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return Array.from(buckets.entries()).map(([category, count]) => ({ category, count }));
};

const toFeatureCollection = (projects, selectedProjectId) => {
  const features = [];
  (projects || []).forEach(project => {
    const projGeom = parseGeometry(project?.landPlotGeometry);
    if (projGeom) {
      features.push({
        type: 'Feature',
        geometry: projGeom,
        properties: { kind: 'project', projectId: project.id, projectName: project.name, isSelected: project.id === selectedProjectId },
      });
    }

    (project?.buildings || []).forEach(building => {
      const bGeom = parseGeometry(building.geometry || building.footprintGeojson || building.footprint_geojson);
      if (!bGeom) return;
      features.push({
        type: 'Feature',
        geometry: bGeom,
        properties: {
          kind: 'building', projectId: project.id, projectName: project.name, buildingId: building.id,
          buildingLabel: building.label, buildingHouseNumber: resolveBuildingHouseNumber(building), isSelectedProject: project.id === selectedProjectId,
        },
      });
    });
  });
  return { type: 'FeatureCollection', features };
};

const collectCoords = (coords, sink) => {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === 'number') { sink.push(coords); return; }
  coords.forEach(c => collectCoords(c, sink));
};

const computeBbox = geometry => {
  const geomObj = parseGeometry(geometry);
  if (!geomObj?.coordinates) return null;
  const points = [];
  collectCoords(geomObj.coordinates, points);
  if (!points.length) return null;

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
  });
  return [[minLng, minLat], [maxLng, maxLat]];
};

const mergeBounds = boundsList => {
  const valid = boundsList.filter(Boolean);
  if (!valid.length) return null;
  const minLng = Math.min(...valid.map(b => b[0][0]));
  const minLat = Math.min(...valid.map(b => b[0][1]));
  const maxLng = Math.max(...valid.map(b => b[1][0]));
  const maxLat = Math.max(...valid.map(b => b[1][1]));
  return [[minLng, minLat], [maxLng, maxLat]];
};

const resolveFloorsCount = (block, building) => {
  const parseFloors = val => {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    return !isNaN(num) && num > 0 ? Math.trunc(num) : null;
  };
  
  let f = parseFloors(block?.floorsTo) 
       ?? parseFloors(block?.floors_to) 
       ?? parseFloors(block?.floorsCount) 
       ?? parseFloors(block?.floors_count) 
       ?? parseFloors(block?.floors);
  if (f) return f;
  
  f = parseFloors(building?.floorsTo) 
   ?? parseFloors(building?.floors_to) 
   ?? parseFloors(building?.floorsMax) 
   ?? parseFloors(building?.floors_max) 
   ?? parseFloors(building?.floorsCount) 
   ?? parseFloors(building?.floors_count);
  if (f) return f;
  
  return 5; 
};

// Функция расчета цвета вынесена в чистый JS
const getFloorColor = (category, floorIndex) => {
  const isEven = Math.abs(floorIndex) % 2 === 0;
  switch(String(category || 'unknown')) {
    case 'residential': return isEven ? '#10b981' : '#059669'; // Зеленый
    case 'residential_multiblock': return isEven ? '#3b82f6' : '#2563eb'; // Синий
    case 'parking_attached': return isEven ? '#94a3b8' : '#64748b'; // Светло-серый
    case 'parking_separate': return isEven ? '#64748b' : '#475569'; // Темно-серый
    case 'commercial': return isEven ? '#f59e0b' : '#d97706'; // Оранжевый
    case 'infrastructure': return isEven ? '#f43f5e' : '#e11d48'; // Красный
    default: return isEven ? '#8b5cf6' : '#7c3aed'; // Фиолетовый
  }
};

export default function ProjectsOverviewMapModal({ isOpen, projects = [], onClose, onBackToWorkdesk }) {
  const mapRef = useRef(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [search, setSearch] = useState('');
  const [basemap, setBasemap] = useState('osm');
  const [is3D, setIs3D] = useState(false);
  const [isOrbiting, setIsOrbiting] = useState(false);
  
  const [activeProjectCardId, setActiveProjectCardId] = useState(null);
  const [activeBuildingCardId, setActiveBuildingCardId] = useState(null);
  const [activeFloorIndex, setActiveFloorIndex] = useState(null); 

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedProjectId && projects.length) setSelectedProjectId(projects[0].id);
  }, [isOpen, projects, selectedProjectId]);

  useEffect(() => {
    setIsOrbiting(false);
    setActiveFloorIndex(null);
  }, [selectedProjectId, activeBuildingCardId]);

  useEffect(() => {
    let animationId;
    if (is3D && isOrbiting) {
      const rotateCamera = () => {
        const map = mapRef.current?.getMap();
        if (map) {
          const currentBearing = map.getBearing();
          map.rotateTo(currentBearing + 0.1, { duration: 0, animate: false });
        }
        animationId = requestAnimationFrame(rotateCamera);
      };
      rotateCamera();
    }
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [is3D, isOrbiting]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return (projects || []).filter(p => String(p?.ujCode || '').toLowerCase().includes(q) || String(p?.name || '').toLowerCase().includes(q));
  }, [projects, search]);

  const selectedProject = useMemo(() => (projects || []).find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId]);
  const activeProjectCard = useMemo(() => (projects || []).find(p => p.id === activeProjectCardId) || null, [projects, activeProjectCardId]);

  const activeBuildingCard = useMemo(() => {
    if (!activeProjectCard || !activeBuildingCardId) return null;
    return (activeProjectCard.buildings || []).find(b => b.id === activeBuildingCardId) || null;
  }, [activeProjectCard, activeBuildingCardId]);

  const sourceData = useMemo(() => {
    return toFeatureCollection(projects, selectedProjectId);
  }, [projects, selectedProjectId]);

  const blocks3DSourceData = useMemo(() => {
    const features = (projects || []).flatMap(project => {
      return (project.buildings || []).flatMap(building => {
        const blocks = Array.isArray(building?.blocks) && building.blocks.length > 0 ? building.blocks : [building];

        return blocks.flatMap(block => {
          const geom = parseGeometry(
            block.geometry || block.footprintGeojson || block.footprint_geojson 
            || building.geometry || building.footprintGeojson || building.footprint_geojson
          );
            
          if (!geom) return []; 
          
          const floorsCount = resolveFloorsCount(block, building);
          const undergroundCount = block.undergroundFloors ?? building.undergroundFloors ?? 0;
          const category = building.category || 'unknown';
          const floorFeatures = [];

          // Подземные уровни
          for (let i = -undergroundCount; i < 0; i++) {
            floorFeatures.push({
              type: 'Feature',
              geometry: geom,
              properties: {
                kind: 'block3d',
                projectId: project.id,
                buildingId: building.id,
                blockId: block.id || building.id,
                floorIndex: i, 
                baseM: i * 3, 
                heightM: (i + 1) * 3 - 0.2,
                baseColor: getFloorColor(category, i)
              },
            });
          }

          // Надземные уровни
          for (let i = 0; i < floorsCount; i++) {
            floorFeatures.push({
              type: 'Feature',
              geometry: geom,
              properties: {
                kind: 'block3d',
                projectId: project.id,
                buildingId: building.id,
                blockId: block.id || building.id,
                floorIndex: i + 1, 
                baseM: i * 3,
                heightM: (i + 1) * 3 - 0.2,
                baseColor: getFloorColor(category, i + 1)
              },
            });
          }
          return floorFeatures;
        });
      });
    });

    return { type: 'FeatureCollection', features };
  }, [projects]);

  const fitToProject = project => {
    if (!project || !mapRef.current) return;
    const projectBounds = computeBbox(project.landPlotGeometry);
    const buildingBounds = (project.buildings || []).map(b => computeBbox(b.geometry || b.footprintGeojson || b.footprint_geojson));
    const bounds = mergeBounds([projectBounds, ...buildingBounds]);
    if (!bounds) return;
    mapRef.current.fitBounds(bounds, { padding: 70, duration: 900, maxZoom: 18 });
  };

  useEffect(() => {
    if (!selectedProject) return;
    fitToProject(selectedProject);
  }, [selectedProject]);

  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    map.easeTo({
      pitch: is3D ? 60 : 0,
      bearing: is3D ? 25 : 0,
      duration: 700,
    });
  }, [is3D]);

  // Защита от Null
  const safeSelectedProjectId = selectedProjectId || '';
  const safeActiveBuildingId = activeBuildingCardId || '';
  const safeActiveFloorIndex = activeFloorIndex !== null ? activeFloorIndex : -999;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="w-full h-full bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-2xl flex">
        <aside className="w-[360px] border-r border-slate-200 bg-slate-50/70 flex flex-col z-10">
          <div className="p-4 border-b border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPinned size={18} className="text-blue-600" />
                <h2 className="font-bold text-slate-800">Карта всех ЖК</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <button
              onClick={onBackToWorkdesk}
              className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold"
            >
              <ArrowLeft size={14} />
              Возврат на рабочий стол
            </button>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по UJ коду или названию"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="overflow-y-auto p-2 space-y-1">
            {filteredProjects.map(project => {
              const isSelected = project.id === selectedProjectId;
              return (
                <button
                  key={project.id}
                  onClick={() => { 
                    setSelectedProjectId(project.id); 
                    setActiveProjectCardId(null); 
                    setActiveBuildingCardId(null); 
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    isSelected ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:bg-white'
                  }`}
                >
                  <div className="text-xs font-mono text-slate-500">{project.ujCode || '—'}</div>
                  <div className="text-sm font-semibold text-slate-800 line-clamp-2">{project.name || 'Без названия'}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Зданий: {(project.buildings || []).length}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 relative bg-slate-100">
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            <select
              value={basemap}
              onChange={e => setBasemap(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm"
            >
              {BASEMAP_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            
            {is3D && (
              <button
                onClick={() => setIsOrbiting(v => !v)}
                className={`h-9 px-3 rounded-lg border text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 ${isOrbiting ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                title="Облет камеры"
              >
                {isOrbiting ? <Pause size={14}/> : <Play size={14}/>}
                Облет
              </button>
            )}

            <button
              onClick={() => setIs3D(v => !v)}
              className={`h-9 px-3 rounded-lg border text-xs font-semibold shadow-sm transition-colors ${is3D ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              title="Переключить 2D/3D"
            >
              {is3D ? '3D' : '2D'}
            </button>
            
            <button
              onClick={() => {
                const map = mapRef.current?.getMap?.();
                if (!map) return;
                map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
                setIsOrbiting(false);
              }}
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center hover:bg-slate-50 shadow-sm transition-colors"
              title="Сбросить вращение"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <MapGL
            ref={mapRef}
            mapLib={maplibregl}
            initialViewState={{ longitude: 69.2401, latitude: 41.2995, zoom: 10, pitch: 0 }}
            mapStyle={getStyle(basemap)}
            style={{ width: '100%', height: '100%', cursor: 'pointer' }}
            dragRotate={is3D}
            touchPitch={is3D}
            maxPitch={75}
            onDragStart={() => setIsOrbiting(false)}
            onClick={event => {
              const map = mapRef.current?.getMap?.();
              if (!map) return;
              const hits = map.queryRenderedFeatures(event.point, {
                // ОБНОВЛЕННЫЙ СПИСОК СЛОЕВ
                layers: ['blocks-3d-extrusion-selected', 'blocks-3d-extrusion-ghost', 'buildings-fill', 'buildings-line', 'projects-fill', 'projects-line'],
              });
              
              if (!hits.length) {
                setActiveProjectCardId(null);
                setActiveBuildingCardId(null);
                setActiveFloorIndex(null);
                return;
              }

              const blockHit = hits.find(item => item?.properties?.kind === 'block3d');
              if (blockHit?.properties?.projectId && blockHit?.properties?.buildingId) {
                setSelectedProjectId(blockHit.properties.projectId);
                setActiveProjectCardId(blockHit.properties.projectId);
                setActiveBuildingCardId(blockHit.properties.buildingId);
                setActiveFloorIndex(blockHit.properties.floorIndex); 
                return;
              }

              const buildingHit = hits.find(item => item?.properties?.kind === 'building');
              if (buildingHit?.properties?.projectId && buildingHit?.properties?.buildingId) {
                setSelectedProjectId(buildingHit.properties.projectId);
                setActiveProjectCardId(buildingHit.properties.projectId);
                setActiveBuildingCardId(buildingHit.properties.buildingId);
                setActiveFloorIndex(null);
                return;
              }

              const projectHit = hits.find(item => item?.properties?.kind === 'project');
              if (projectHit?.properties?.projectId) {
                setSelectedProjectId(projectHit.properties.projectId);
                setActiveProjectCardId(projectHit.properties.projectId);
                setActiveBuildingCardId(null);
                setActiveFloorIndex(null);
              }
            }}
          >
            <NavigationControl position="bottom-right" showCompass showZoom visualizePitch={true} />

            <Source id="projects-overview" type="geojson" data={sourceData}>
              <Layer
                id="projects-fill"
                type="fill"
                filter={['==', ['get', 'kind'], 'project']}
                paint={{
                  'fill-color': ['case', ['==', ['get', 'isSelected'], true], '#2563eb', '#94a3b8'],
                  'fill-opacity': is3D ? 0 : ['case', ['==', ['get', 'isSelected'], true], 0.22, 0.1],
                }}
              />
              <Layer
                id="projects-line"
                type="line"
                filter={['==', ['get', 'kind'], 'project']}
                paint={{
                  'line-color': ['case', ['==', ['get', 'isSelected'], true], '#1d4ed8', '#475569'],
                  'line-width': ['case', ['==', ['get', 'isSelected'], true], 3, 1.5],
                }}
              />
              <Layer
                id="projects-labels"
                type="symbol"
                filter={['all', ['==', ['get', 'kind'], 'project'], ['!=', ['coalesce', ['get', 'projectName'], ''], '']]}
                layout={{
                  'symbol-placement': 'point',
                  'text-field': ['get', 'projectName'],
                  'text-size': 13,
                  'text-font': ['Open Sans Bold'],
                  'text-allow-overlap': false,
                  'text-ignore-placement': false,
                  'text-max-width': 12,
                }}
                paint={{
                  'text-color': '#1e293b',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 1.2,
                }}
              />
              <Layer
                id="buildings-fill"
                type="fill"
                filter={['==', ['get', 'kind'], 'building']}
                paint={{
                  'fill-color': ['case', ['==', ['get', 'isSelectedProject'], true], '#10b981', '#f59e0b'],
                  'fill-opacity': is3D ? 0 : ['case', ['==', ['get', 'isSelectedProject'], true], 0.28, 0.14],
                }}
              />
              <Layer
                id="buildings-line"
                type="line"
                filter={['==', ['get', 'kind'], 'building']}
                paint={{
                  'line-color': ['case', ['==', ['get', 'isSelectedProject'], true], '#059669', '#b45309'],
                  'line-width': is3D ? 0 : ['case', ['==', ['get', 'isSelectedProject'], true], 2.5, 1.2],
                }}
              />
              <Layer
                id="buildings-labels"
                type="symbol"
                filter={['all', ['==', ['get', 'kind'], 'building'], ['!=', ['coalesce', ['get', 'buildingHouseNumber'], ''], '']]}
                layout={{
                  'symbol-placement': 'point',
                  'text-field': ['concat', '№', ['get', 'buildingHouseNumber']],
                  'text-size': 12,
                  'text-font': ['Open Sans Bold'],
                  'text-allow-overlap': false,
                  'text-ignore-placement': false,
                }}
                paint={{
                  'text-color': '#0f172a',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 1.1,
                }}
              />
            </Source>

            <Source id="blocks-3d" type="geojson" data={blocks3DSourceData}>
              {/* Слой 1: НЕВЫБРАННЫЕ ПРОЕКТЫ (режим призрака) */}
              <Layer
                id="blocks-3d-extrusion-ghost"
                type="fill-extrusion"
                filter={['all', ['==', ['get', 'kind'], 'block3d'], ['!=', ['get', 'projectId'], safeSelectedProjectId]]}
                paint={{
                  'fill-extrusion-color': [
                    'case',
                    ['all', 
                      ['==', ['get', 'buildingId'], safeActiveBuildingId],
                      ['==', ['get', 'floorIndex'], safeActiveFloorIndex]
                    ], '#fbbf24', 
                    ['get', 'baseColor']
                  ],
                  'fill-extrusion-opacity': is3D ? 0.25 : 0, 
                  'fill-extrusion-base': ['get', 'baseM'],
                  'fill-extrusion-height': ['get', 'heightM']
                }}
              />

              {/* Слой 2: ВЫБРАННЫЙ ПРОЕКТ (яркий) */}
              <Layer
                id="blocks-3d-extrusion-selected"
                type="fill-extrusion"
                filter={['all', ['==', ['get', 'kind'], 'block3d'], ['==', ['get', 'projectId'], safeSelectedProjectId]]}
                paint={{
                  'fill-extrusion-color': [
                    'case',
                    ['all', 
                      ['==', ['get', 'buildingId'], safeActiveBuildingId],
                      ['==', ['get', 'floorIndex'], safeActiveFloorIndex]
                    ], '#fbbf24', 
                    ['get', 'baseColor']
                  ],
                  'fill-extrusion-opacity': is3D ? 0.95 : 0, 
                  'fill-extrusion-base': ['get', 'baseM'],
                  'fill-extrusion-height': ['get', 'heightM']
                }}
              />
            </Source>
            
          </MapGL>

          {(activeProjectCard || activeBuildingCard) && (
            <div className="absolute left-3 bottom-3 z-20 w-[420px] max-w-[calc(100%-24px)] rounded-xl border border-slate-200 bg-white/95 backdrop-blur shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {activeBuildingCard ? 'Информация по зданию' : 'Информация по ЖК'}
                </div>
                <button
                  onClick={() => { setActiveProjectCardId(null); setActiveBuildingCardId(null); setActiveFloorIndex(null); }}
                  className="p-1 rounded hover:bg-slate-100 text-slate-500"
                >
                  <X size={14} />
                </button>
              </div>

              {!activeBuildingCard && activeProjectCard && (
                <div className="p-4 space-y-2 text-sm text-slate-700">
                  <div className="text-base font-bold text-slate-900">{activeProjectCard.name || 'Без названия'}</div>
                  <div><span className="text-slate-500">UJ:</span> {activeProjectCard.ujCode || '—'}</div>
                  <div><span className="text-slate-500">Адрес:</span> {activeProjectCard.address || '—'}</div>
                  <div><span className="text-slate-500">Статус:</span> {formatStatus(activeProjectCard.status || activeProjectCard.workflowStatus)}</div>
                  <div><span className="text-slate-500">Количество зданий:</span> {activeProjectCard.totalBuildings ?? (activeProjectCard.buildings || []).length}</div>
                  <div>
                    <div className="text-slate-500 mb-1">Типы зданий:</div>
                    <div className="flex flex-wrap gap-1">
                      {toProjectBuildingTypeStats(activeProjectCard).map(item => (
                        <span key={`${item.category}-${item.count}`} className="px-2 py-0.5 rounded-full bg-slate-100 text-xs">
                          {formatBuildingType(item.category)}: {item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeBuildingCard && activeProjectCard && (
                <div className="p-4 space-y-2 text-sm text-slate-700">
                  <div className="text-base font-bold text-slate-900">{activeBuildingCard.label || 'Здание'}</div>
                  <div><span className="text-slate-500">ЖК:</span> {activeProjectCard.name || '—'}</div>
                  <div><span className="text-slate-500">Тип здания:</span> {formatBuildingType(activeBuildingCard.category)}</div>
                  <div><span className="text-slate-500">Номер дома:</span> {resolveBuildingHouseNumber(activeBuildingCard) || '—'}</div>
                  <div><span className="text-slate-500">Количество блоков:</span> {activeBuildingCard.blocksCount ?? '—'}</div>
                  <div><span className="text-slate-500">Этажность:</span> {activeBuildingCard.floorsMax ?? '—'}</div>
                  
                  {activeFloorIndex !== null && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Выбранный уровень: </span> 
                      <span className="font-bold text-amber-600">
                        {activeFloorIndex < 0 ? `Подземный этаж ${activeFloorIndex}` : `Этаж ${activeFloorIndex}`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}