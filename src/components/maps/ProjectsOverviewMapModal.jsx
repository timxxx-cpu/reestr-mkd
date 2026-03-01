import React, { useMemo, useRef, useEffect, useState } from 'react';
import Map, { Layer, Source, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { X, ArrowLeft, MapPinned, RotateCcw } from 'lucide-react';
import { BASEMAP_OPTIONS } from './GeometryPickerMap';

const OSM_STYLE = {
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
};

const CARTO_STYLE = {
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
};

const SAT_STYLE = {
  version: 8,
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

const getStyle = basemap => {
  if (basemap === 'googleSatellite') return SAT_STYLE;
  if (basemap === 'cartoLight') return CARTO_STYLE;
  return OSM_STYLE;
};

const resolveBuildingHouseNumber = building => {
  const value = building?.houseNumber
    || building?.house_number
    || building?.address?.houseNumber
    || building?.address?.house_number;

  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
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
  const map = {
    IN_PROGRESS: 'В работе',
    COMPLETED: 'Завершено',
    DECLINED: 'Отказано',
  };
  return map[String(status || '').trim()] || (status || '—');
};

const toProjectBuildingTypeStats = project => {
  if (Array.isArray(project?.buildingTypeStats) && project.buildingTypeStats.length) {
    return project.buildingTypeStats;
  }

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
    if (project?.landPlotGeometry) {
      features.push({
        type: 'Feature',
        geometry: project.landPlotGeometry,
        properties: {
          kind: 'project',
          projectId: project.id,
          projectName: project.name,
          isSelected: project.id === selectedProjectId,
        },
      });
    }

    (project?.buildings || []).forEach(building => {
      if (!building?.geometry) return;
      const buildingHouseNumber = resolveBuildingHouseNumber(building);
      features.push({
        type: 'Feature',
        geometry: building.geometry,
        properties: {
          kind: 'building',
          projectId: project.id,
          projectName: project.name,
          buildingId: building.id,
          buildingLabel: building.label,
          buildingHouseNumber,
          isSelectedProject: project.id === selectedProjectId,
        },
      });
    });
  });

  return { type: 'FeatureCollection', features };
};

const collectCoords = (coords, sink) => {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === 'number') {
    sink.push(coords);
    return;
  }
  coords.forEach(c => collectCoords(c, sink));
};

const computeBbox = geometry => {
  if (!geometry?.coordinates) return null;
  const points = [];
  collectCoords(geometry.coordinates, points);
  if (!points.length) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
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

export default function ProjectsOverviewMapModal({
  isOpen,
  projects = [],
  onClose,
  onBackToWorkdesk,
}) {
  const mapRef = useRef(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [search, setSearch] = useState('');
  const [basemap, setBasemap] = useState('osm');
  const [is3D, setIs3D] = useState(false);
  const [activeProjectCardId, setActiveProjectCardId] = useState(null);
  const [activeBuildingCardId, setActiveBuildingCardId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedProjectId && projects.length) {
      setSelectedProjectId(projects[0].id);
    }
  }, [isOpen, projects, selectedProjectId]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return (projects || []).filter(p =>
      String(p?.ujCode || '').toLowerCase().includes(q) ||
      String(p?.name || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const selectedProject = useMemo(
    () => (projects || []).find(p => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const activeProjectCard = useMemo(
    () => (projects || []).find(p => p.id === activeProjectCardId) || null,
    [projects, activeProjectCardId]
  );

  const activeBuildingCard = useMemo(() => {
    if (!activeProjectCard || !activeBuildingCardId) return null;
    return (activeProjectCard.buildings || []).find(b => b.id === activeBuildingCardId) || null;
  }, [activeProjectCard, activeBuildingCardId]);


  const sourceData = useMemo(() => {
    const mapProjects = is3D
      ? (selectedProject ? [selectedProject] : [])
      : projects;
    return toFeatureCollection(mapProjects, selectedProjectId);
  }, [projects, selectedProject, selectedProjectId, is3D]);

  const blocks3DSourceData = useMemo(() => {
    if (!is3D || !selectedProject) return { type: 'FeatureCollection', features: [] };

    const features = (selectedProject.buildings || []).flatMap(building => {
      const blocks = Array.isArray(building?.blocks) ? building.blocks : [];
      return blocks
        .filter(block => !!block?.geometry)
        .map(block => ({
          type: 'Feature',
          geometry: block.geometry,
          properties: {
            kind: 'block3d',
            projectId: selectedProject.id,
            buildingId: building.id,
            buildingLabel: building.label,
            blockId: block.id,
            blockLabel: block.label,
            floorsCount: Number(block.floorsCount || 0),
            heightM: Math.max(1, Number(block.floorsCount || building.floorsMax || 1)) * 3,
          },
        }));
    });

    return { type: 'FeatureCollection', features };
  }, [is3D, selectedProject]);

  const fitToProject = project => {
    if (!project || !mapRef.current) return;
    const projectBounds = computeBbox(project.landPlotGeometry);
    const buildingBounds = (project.buildings || []).map(b => computeBbox(b.geometry));
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="w-full h-full bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-2xl flex">
        <aside className="w-[360px] border-r border-slate-200 bg-slate-50/70 flex flex-col">
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
                  onClick={() => { setSelectedProjectId(project.id); setActiveProjectCardId(null); setActiveBuildingCardId(null); }}
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

        <div className="flex-1 relative">
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            <select
              value={basemap}
              onChange={e => setBasemap(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              {BASEMAP_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <button
              onClick={() => setIs3D(v => !v)}
              className={`h-9 px-3 rounded-lg border text-xs font-semibold ${is3D ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
              title="Переключить 2D/3D"
            >
              {is3D ? '3D' : '2D'}
            </button>
            <button
              onClick={() => {
                const map = mapRef.current?.getMap?.();
                if (!map) return;
                map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
              }}
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center"
              title="Сбросить вращение"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <Map
            ref={mapRef}
            mapLib={maplibregl}
            initialViewState={{ longitude: 69.2401, latitude: 41.2995, zoom: 10 }}
            mapStyle={getStyle(basemap)}
            style={{ width: '100%', height: '100%', cursor: 'pointer' }}
            dragRotate={is3D}
            touchPitch={is3D}
            maxPitch={70}
            onClick={event => {
              const map = mapRef.current?.getMap?.();
              if (!map) return;
              const hits = map.queryRenderedFeatures(event.point, {
                layers: ['blocks-3d', 'buildings-fill', 'buildings-line', 'projects-fill', 'projects-line'],
              });
              if (!hits.length) {
                setActiveProjectCardId(null);
                setActiveBuildingCardId(null);
                return;
              }

              const buildingHit = hits.find(item => item?.properties?.kind === 'building');
              if (buildingHit?.properties?.projectId && buildingHit?.properties?.buildingId) {
                setSelectedProjectId(buildingHit.properties.projectId);
                setActiveProjectCardId(buildingHit.properties.projectId);
                setActiveBuildingCardId(buildingHit.properties.buildingId);
                return;
              }

              const projectHit = hits.find(item => item?.properties?.kind === 'project');
              if (projectHit?.properties?.projectId) {
                setSelectedProjectId(projectHit.properties.projectId);
                setActiveProjectCardId(projectHit.properties.projectId);
                setActiveBuildingCardId(null);
              }
            }}
          >
            <NavigationControl position="top-right" showCompass showZoom />

            {is3D && (
              <Source id="blocks-3d" type="geojson" data={blocks3DSourceData}>
                <Layer
                  id="blocks-3d"
                  type="fill-extrusion"
                  filter={['==', ['get', 'kind'], 'block3d']}
                  paint={{
                    'fill-extrusion-color': '#4f46e5',
                    'fill-extrusion-opacity': 0.82,
                    'fill-extrusion-base': 0,
                    'fill-extrusion-height': ['get', 'heightM'],
                  }}
                />
              </Source>
            )}

            <Source id="projects-overview" type="geojson" data={sourceData}>
              <Layer
                id="projects-fill"
                type="fill"
                filter={['==', ['get', 'kind'], 'project']}
                paint={{
                  'fill-color': ['case', ['==', ['get', 'isSelected'], true], '#2563eb', '#94a3b8'],
                  'fill-opacity': ['case', ['==', ['get', 'isSelected'], true], 0.22, 0.1],
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
                  'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
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
                  'fill-opacity': ['case', ['==', ['get', 'isSelectedProject'], true], 0.28, 0.14],
                }}
              />
              <Layer
                id="buildings-line"
                type="line"
                filter={['==', ['get', 'kind'], 'building']}
                paint={{
                  'line-color': ['case', ['==', ['get', 'isSelectedProject'], true], '#059669', '#b45309'],
                  'line-width': ['case', ['==', ['get', 'isSelectedProject'], true], 2.5, 1.2],
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
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
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
          </Map>

          {(activeProjectCard || activeBuildingCard) && (
            <div className="absolute left-3 bottom-3 z-20 w-[420px] max-w-[calc(100%-24px)] rounded-xl border border-slate-200 bg-white/95 backdrop-blur shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {activeBuildingCard ? 'Информация по зданию' : 'Информация по ЖК'}
                </div>
                <button
                  onClick={() => {
                    setActiveProjectCardId(null);
                    setActiveBuildingCardId(null);
                  }}
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
                  <div><span className="text-slate-500">Адрес:</span> {activeBuildingCard.address || activeProjectCard.address || '—'}</div>
                  <div><span className="text-slate-500">Количество блоков:</span> {activeBuildingCard.blocksCount ?? '—'}</div>
                  <div><span className="text-slate-500">Этажность:</span> {activeBuildingCard.floorsMax ?? '—'}</div>
                  <div><span className="text-slate-500">Количество квартир:</span> {activeBuildingCard.apartmentsCount ?? '—'}</div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
