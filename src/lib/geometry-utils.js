export const toMultiPolygonGeometry = geometry => {
  if (!geometry || typeof geometry !== 'object') return null;
  if (geometry.type === 'MultiPolygon') return geometry;
  if (geometry.type === 'Polygon') {
    return { type: 'MultiPolygon', coordinates: [geometry.coordinates] };
  }
  return null;
};

const ringArea = ring => {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i] || [0, 0];
    const [x2, y2] = ring[(i + 1) % ring.length] || [0, 0];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

export const computeApproxAreaM2 = geometry => {
  const multi = toMultiPolygonGeometry(geometry);
  if (!multi) return 0;
  return Number(
    multi.coordinates
      .reduce((acc, polygon) => {
        if (!Array.isArray(polygon) || polygon.length === 0) return acc;
        const [outer, ...holes] = polygon;
        const holesArea = holes.reduce((hAcc, hole) => hAcc + ringArea(hole), 0);
        return acc + Math.max(0, ringArea(outer) - holesArea);
      }, 0)
      .toFixed(2)
  );
};

export const getGeometryBounds = geometry => {
  const multi = toMultiPolygonGeometry(geometry);
  if (!multi) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  multi.coordinates.forEach(poly => {
    poly.forEach(ring => {
      ring.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });
    });
  });
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
};


const R = 6378137;
const mercatorToWgs84 = ([x, y]) => {
  const lon = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
};

export const geometry3857To4326 = geometry => {
  const multi = toMultiPolygonGeometry(geometry);
  if (!multi) return null;
  return {
    type: 'MultiPolygon',
    coordinates: multi.coordinates.map(poly => poly.map(ring => ring.map(mercatorToWgs84))),
  };
};

export const normalizeShpFeatures = geojson => {
  const list = geojson?.type === 'FeatureCollection'
    ? geojson.features || []
    : Array.isArray(geojson)
      ? geojson
      : geojson?.features || [];

  return list
    .map((feature, idx) => {
      const geometry = toMultiPolygonGeometry(feature?.geometry || null);
      if (!geometry) return null;
      return {
        sourceIndex: idx,
        label: feature?.properties?.name || `Полигон ${idx + 1}`,
        properties: feature?.properties || {},
        geometry,
        areaM2: computeApproxAreaM2(geometry),
      };
    })
    .filter(Boolean);
};
