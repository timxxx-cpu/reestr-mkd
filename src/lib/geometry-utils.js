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


const pointInRing = (point, ring = []) => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] || [];
    const [xj, yj] = ring[j] || [];
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
};

const pointInPolygonWithHoles = (point, polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  const [outer, ...holes] = polygon;
  if (!pointInRing(point, outer || [])) return false;
  return !holes.some(hole => pointInRing(point, hole || []));
};

const flattenPolygonVertices = geometry => {
  const multi = toMultiPolygonGeometry(geometry);
  if (!multi) return [];
  return multi.coordinates.flatMap(poly => (poly[0] || []));
};

export const isGeometryWithinGeometry = (innerGeometry, outerGeometry) => {
  const inner = toMultiPolygonGeometry(innerGeometry);
  const outer = toMultiPolygonGeometry(outerGeometry);
  if (!inner || !outer) return false;

  const outerPolygons = outer.coordinates || [];
  const vertices = flattenPolygonVertices(inner);
  if (!vertices.length) return false;

  return vertices.every(point => outerPolygons.some(poly => pointInPolygonWithHoles(point, poly)));
};

// Доля площади inner, лежащая СНАРУЖИ outer (0..1), грубая плоскостная оценка.
export const getOutsideAreaRatioApprox = (innerGeometry, outerGeometry) => {
  const inner = toMultiPolygonGeometry(innerGeometry);
  const outer = toMultiPolygonGeometry(outerGeometry);
  if (!inner || !outer) return 1;

  const innerPolygons = inner.coordinates || [];
  const outerPolygons = outer.coordinates || [];
  if (!innerPolygons.length || !outerPolygons.length) return 1;

  let innerArea = 0;
  let insideArea = 0;

  innerPolygons.forEach(poly => {
    const [outerRing] = poly || [];
    const polyArea = ringArea(outerRing || []);
    innerArea += polyArea;

    // Аппроксимация: считаем долю вершин внешнего кольца, попавших в outer
    const points = (outerRing || []).slice(0, -1);
    if (!points.length || polyArea <= 0) return;
    const insidePoints = points.filter(point =>
      outerPolygons.some(outerPoly => pointInPolygonWithHoles(point, outerPoly))
    ).length;
    insideArea += (insidePoints / points.length) * polyArea;
  });

  if (innerArea <= 0) return 1;
  return Math.max(0, Math.min(1, (innerArea - insideArea) / innerArea));
};

const toRadians = deg => (deg * Math.PI) / 180;
const toDegrees = rad => (rad * 180) / Math.PI;

const normalizeAngleDeg = deg => {
  let normalized = deg % 180;
  if (normalized < 0) normalized += 180;
  return normalized;
};

const getOuterRing = geometry => {
  const multi = toMultiPolygonGeometry(geometry);
  if (!multi) return [];
  return multi.coordinates?.[0]?.[0] || [];
};


const projectRingToMeters = (ring = [], origin = null) => {
  if (!ring.length || !origin) return [];
  return ring.map(([lng, lat]) => [
    (lng - origin.lng) * (origin.metersPerDegLng || 1),
    (lat - origin.lat) * (origin.metersPerDegLat || 1),
  ]);
};

export const projectGeometryToOriginMeters = (geometry, origin) => {
  const ring = getOuterRing(geometry);
  if (!ring.length || !origin) return null;
  return {
    type: 'Polygon',
    coordinates: [projectRingToMeters(ring, origin)],
  };
};

export const projectGeometryToLocalMeters = geometry => {
  const ring = getOuterRing(geometry);
  if (!ring.length) return null;

  const [originLng, originLat] = ring[0];
  const lat0 = toRadians(originLat);
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(lat0);

  const projectedRing = projectRingToMeters(ring, {
    lng: originLng,
    lat: originLat,
    metersPerDegLat,
    metersPerDegLng,
  });

  return {
    type: 'Polygon',
    coordinates: [projectedRing],
    origin: {
      lng: originLng,
      lat: originLat,
      metersPerDegLat,
      metersPerDegLng,
    },
  };
};

export const geometryFromMeterPoints = (geometryMeters, origin) => {
  const multi = toMultiPolygonGeometry(geometryMeters);
  if (!multi || !origin) return null;

  return {
    type: 'MultiPolygon',
    coordinates: multi.coordinates.map(poly =>
      poly.map(ring =>
        ring.map(([x, y]) => [
          origin.lng + x / (origin.metersPerDegLng || 1),
          origin.lat + y / (origin.metersPerDegLat || 1),
        ])
      )
    ),
  };
};

export const rotateGeometryInMeters = (geometry, angleDeg = 0) => {
  const multi = toMultiPolygonGeometry(geometry);
  if (!multi) return null;

  const angle = toRadians(angleDeg);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    type: 'MultiPolygon',
    coordinates: multi.coordinates.map(poly =>
      poly.map(ring =>
        ring.map(([x, y]) => [
          x * cos - y * sin,
          x * sin + y * cos,
        ])
      )
    ),
  };
};

export const getGeometryBoundsInMeters = geometry => {
  const bounds = getGeometryBounds(geometry);
  if (!bounds) return null;
  const [minX, minY, maxX, maxY] = bounds;
  return { minX, minY, maxX, maxY };
};

export const getNarrowAxisAngleDeg = geometry => {
  const ring = getOuterRing(geometry);
  if (ring.length < 2) return 0;

  let shortestLength = Infinity;
  let shortestAngle = 0;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i] || [0, 0];
    const [x2, y2] = ring[i + 1] || [0, 0];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len > 0.05 && len < shortestLength) {
      shortestLength = len;
      shortestAngle = normalizeAngleDeg(toDegrees(Math.atan2(dy, dx)));
    }
  }

  return shortestLength === Infinity ? 0 : shortestAngle;
};
