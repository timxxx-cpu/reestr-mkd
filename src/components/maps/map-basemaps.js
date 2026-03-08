export const BASEMAPS = {
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
          attribution: 'В© OpenStreetMap contributors',
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
          attribution: 'В© OpenStreetMap contributors В© CARTO',
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
          attribution: 'В© Google',
        },
      },
      layers: [{ id: 'google-satellite', type: 'raster', source: 'googleSatellite' }],
    },
  },
};

export const BASEMAP_OPTIONS = Object.values(BASEMAPS).map(item => ({
  value: item.id,
  label: item.label,
}));

export const getBasemapStyle = basemap => BASEMAPS[basemap]?.style || BASEMAPS.osm.style;
