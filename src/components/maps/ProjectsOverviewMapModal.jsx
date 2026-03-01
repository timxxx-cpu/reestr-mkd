import React, { useMemo, useRef, useEffect, useState } from 'react';
import Map, { Layer, Source } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { X, ArrowLeft, MapPinned } from 'lucide-react';
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
      features.push({
        type: 'Feature',
        geometry: building.geometry,
        properties: {
          kind: 'building',
          projectId: project.id,
          projectName: project.name,
          buildingId: building.id,
          buildingLabel: building.label,
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

  const sourceData = useMemo(
    () => toFeatureCollection(projects, selectedProjectId),
    [projects, selectedProjectId]
  );

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
                  onClick={() => setSelectedProjectId(project.id)}
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
          <div className="absolute top-3 right-3 z-20">
            <select
              value={basemap}
              onChange={e => setBasemap(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"
            >
              {BASEMAP_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <Map
            ref={mapRef}
            mapLib={maplibregl}
            initialViewState={{ longitude: 69.2401, latitude: 41.2995, zoom: 10 }}
            mapStyle={getStyle(basemap)}
            style={{ width: '100%', height: '100%' }}
          >
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
            </Source>
          </Map>
        </div>
      </div>
    </div>
  );
}
