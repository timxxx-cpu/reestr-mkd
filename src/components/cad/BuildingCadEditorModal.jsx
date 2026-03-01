import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Save,
  Undo2,
  Redo2,
  Trash2,
  MoveRight,
  AlertTriangle,
  Magnet,
  Eraser,
  Crosshair,
} from 'lucide-react';
import {
  geometryFromMeterPoints,
  getGeometryBoundsInMeters,
  getNarrowAxisAngleDeg,
  isGeometryWithinGeometry,
  projectGeometryToLocalMeters,
  projectGeometryToOriginMeters,
  rotateGeometryInMeters,
} from '@lib/geometry-utils';

const MAX_VERTEX_OFFSET_M = 2;
const SNAP_THRESHOLD_M = 1.2;
const MIN_SEGMENT_LENGTH_M = 0.3;

const round2 = value => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toPointString = points => points.map(([x, y]) => `${x},${y}`).join(' ');

const distance = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
const formatMeters = value => `${value.toFixed(2)} м`;
const formatArea = value => `${value.toFixed(2)} м²`;

const calcPolygonAreaM2 = points => {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i] || [0, 0];
    const [x2, y2] = points[(i + 1) % points.length] || [0, 0];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

const getOuterRingGeo = geometry => {
  if (!geometry || typeof geometry !== 'object') return [];
  if (geometry.type === 'Polygon') return geometry.coordinates?.[0] || [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0] || [];
  return [];
};

const getLeftBottomVertex = (ring = []) => {
  const vertices = ring.slice(0, -1);
  if (!vertices.length) return null;
  return [...vertices].sort((a, b) => {
    if (Math.abs(a[0] - b[0]) < 1e-6) return a[1] - b[1];
    return a[0] - b[0];
  })[0];
};

const getPointToSegmentProjection = (point, start, end) => {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return { point: [x1, y1], distance: Math.hypot(px - x1, py - y1) };
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1);
  const projected = [x1 + dx * t, y1 + dy * t];
  return { point: projected, distance: Math.hypot(px - projected[0], py - projected[1]) };
};

const getNearestSnapPoint = (point, buildingRing = [], snapMode = {}) => {
  const candidates = [];

  if (snapMode.grid) {
    const gridPoint = [Math.round(point[0]), Math.round(point[1])];
    candidates.push({ point: gridPoint, distance: distance(point, gridPoint), type: 'grid' });
  }

  if (snapMode.vertex) {
    for (const vertex of buildingRing.slice(0, -1)) {
      candidates.push({ point: vertex, distance: distance(point, vertex), type: 'vertex' });
    }
  }

  if (snapMode.edge) {
    for (let i = 0; i < buildingRing.length - 1; i += 1) {
      const snap = getPointToSegmentProjection(point, buildingRing[i], buildingRing[i + 1]);
      candidates.push({ point: snap.point, distance: snap.distance, type: 'edge' });
    }
  }

  if (!candidates.length) return null;
  const best = candidates.sort((a, b) => a.distance - b.distance)[0];
  if (!best || best.distance > SNAP_THRESHOLD_M) return null;
  return best;
};

const toScreenProjector = (bounds, width, height) => {
  const padding = 32;
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight);
  const offsetX = (width - worldWidth * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - worldHeight * scale) / 2 + bounds.maxY * scale;

  return {
    scale,
    toScreen: (x, y) => [x * scale + offsetX, offsetY - y * scale],
  };
};

const orient = (a, b, c) => {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (a, b, c) =>
  Math.min(a[0], c[0]) <= b[0] + 1e-9 &&
  b[0] <= Math.max(a[0], c[0]) + 1e-9 &&
  Math.min(a[1], c[1]) <= b[1] + 1e-9 &&
  b[1] <= Math.max(a[1], c[1]) + 1e-9;

const segmentsIntersect = (p1, q1, p2, q2) => {
  const o1 = orient(p1, q1, p2);
  const o2 = orient(p1, q1, q2);
  const o3 = orient(p2, q2, p1);
  const o4 = orient(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
};

const hasSelfIntersections = points => {
  if (!Array.isArray(points) || points.length < 4) return false;
  const segments = points.map((start, index) => [start, points[(index + 1) % points.length]]);

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const isNeighbor =
        Math.abs(i - j) === 1 ||
        (i === 0 && j === segments.length - 1) ||
        (j === 0 && i === segments.length - 1);
      if (isNeighbor) continue;
      if (segmentsIntersect(segments[i][0], segments[i][1], segments[j][0], segments[j][1]))
        return true;
    }
  }
  return false;
};

const getShortestSegment = points => {
  if (!Array.isArray(points) || points.length < 2) return Infinity;
  let minLength = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    minLength = Math.min(minLength, distance(points[i], points[(i + 1) % points.length]));
  }
  return minLength;
};

export default function BuildingCadEditorModal({
  isOpen,
  onClose,
  boundaryGeometry,
  initialGeometry = null,
  onSave,
  isReadOnly = false,
}) {
  const [points, setPoints] = useState([]);
  const [segmentLength, setSegmentLength] = useState(10);
  const [segmentAngle, setSegmentAngle] = useState(90);
  const [isClosed, setIsClosed] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [snapMode, setSnapMode] = useState({ grid: true, vertex: true, edge: true });
  const [lastSnap, setLastSnap] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showSatellite, setShowSatellite] = useState(false);
  const [satelliteProvider, setSatelliteProvider] = useState('google');
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.6);
  const [error, setError] = useState('');

  const projected = useMemo(() => {
    if (!boundaryGeometry) return null;
    const boundaryProjected = projectGeometryToLocalMeters(boundaryGeometry);
    if (!boundaryProjected) return null;

    const narrowAxis = getNarrowAxisAngleDeg(boundaryProjected);
    const rotationDeg = 90 - narrowAxis;
    const rotatedBoundary = rotateGeometryInMeters(boundaryProjected, rotationDeg);
    const rotatedInitial = initialGeometry
      ? rotateGeometryInMeters(
          projectGeometryToOriginMeters(initialGeometry, boundaryProjected.origin),
          rotationDeg
        )
      : null;

    return {
      rotationDeg,
      origin: boundaryProjected.origin,
      boundaryMeters: rotatedBoundary,
      initialMeters: rotatedInitial,
    };
  }, [boundaryGeometry, initialGeometry]);

  const referenceRing = useMemo(() => projected?.boundaryMeters?.coordinates?.[0] || [], [projected]);
  const referenceVertices = useMemo(() => referenceRing.slice(0, -1), [referenceRing]);

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev, { points, isClosed, selectedPointIndex }]);
    setRedoStack([]);
  }, [isClosed, points, selectedPointIndex]);

  const restoreSnapshot = useCallback(snapshot => {
    setPoints(snapshot?.points || []);
    setIsClosed(Boolean(snapshot?.isClosed));
    setSelectedPointIndex(snapshot?.selectedPointIndex ?? null);
    setError('');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (projected?.initialMeters?.coordinates?.[0]?.length >= 4) {
      const initialPoints = projected.initialMeters.coordinates[0].slice(0, -1);
      setPoints(initialPoints);
      setIsClosed(true);
      setSelectedPointIndex(null);
      setHistory([]);
      setRedoStack([]);
      return;
    }
    const anchor = getLeftBottomVertex(referenceRing);
    setPoints(anchor ? [anchor.map(round2)] : []);
    setIsClosed(false);
    setSelectedPointIndex(null);
    setHistory([]);
    setRedoStack([]);
  }, [isOpen, projected, referenceRing]);

  const bounds = useMemo(() => {
    const base = getGeometryBoundsInMeters(projected?.boundaryMeters);
    if (!base) return null;
    const draft = points.length
      ? {
          minX: Math.min(base.minX, ...points.map(([x]) => x)),
          minY: Math.min(base.minY, ...points.map(([, y]) => y)),
          maxX: Math.max(base.maxX, ...points.map(([x]) => x)),
          maxY: Math.max(base.maxY, ...points.map(([, y]) => y)),
        }
      : base;
    return {
      minX: draft.minX - 4,
      minY: draft.minY - 4,
      maxX: draft.maxX + 4,
      maxY: draft.maxY + 4,
    };
  }, [projected, points]);

  const draftSegments = useMemo(() => {
    if (points.length < 2) return [];
    const ring = isClosed && points.length > 2 ? [...points, points[0]] : points;
    return ring.slice(0, -1).map((start, index) => {
      const end = ring[index + 1];
      return {
        key: `d-${index}-${start[0]}-${start[1]}`,
        mid: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
        length: distance(start, end),
      };
    });
  }, [isClosed, points]);

  const boundarySegments = useMemo(() => {
    if (referenceVertices.length < 2) return [];
    return referenceVertices.map((start, index) => {
      const end = referenceVertices[(index + 1) % referenceVertices.length];
      return {
        key: `b-${index}-${start[0]}-${start[1]}`,
        mid: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
        length: distance(start, end),
      };
    });
  }, [referenceVertices]);

  const draftAreaM2 = useMemo(() => (isClosed ? calcPolygonAreaM2(points) : 0), [isClosed, points]);
  const boundaryAreaM2 = useMemo(() => calcPolygonAreaM2(referenceVertices), [referenceVertices]);
  const draftPerimeterM = useMemo(() => draftSegments.reduce((acc, s) => acc + s.length, 0), [draftSegments]);

  const polygonCenter = useCallback(vertices => {
    if (!vertices.length) return null;
    const sum = vertices.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [sum[0] / vertices.length, sum[1] / vertices.length];
  }, []);

  const draftCenter = useMemo(
    () => (isClosed ? polygonCenter(points) : null),
    [isClosed, points, polygonCenter]
  );
  const boundaryCenter = useMemo(
    () => polygonCenter(referenceVertices),
    [referenceVertices, polygonCenter]
  );

  const closureDistance = useMemo(() => {
    if (isClosed || points.length < 2) return null;
    return distance(points[0], points[points.length - 1]);
  }, [isClosed, points]);

  const satelliteUrls = useMemo(() => {
    const ring = getOuterRingGeo(boundaryGeometry);
    if (!Array.isArray(ring) || !ring.length) return { google: '', osm: '' };
    const [sumLng, sumLat] = ring.reduce(
      (acc, point) => [acc[0] + (point?.[0] || 0), acc[1] + (point?.[1] || 0)],
      [0, 0]
    );
    const centerLng = sumLng / ring.length;
    const centerLat = sumLat / ring.length;
    return {
      google: `https://maps.google.com/maps?q=${centerLat},${centerLng}&t=k&z=20&output=embed`,
      osm: `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.001}%2C${centerLat - 0.001}%2C${centerLng + 0.001}%2C${centerLat + 0.001}&layer=mapnik&marker=${centerLat}%2C${centerLng}`,
    };
  }, [boundaryGeometry]);

  const width = 780;
  const height = 480;
  const projector = bounds ? toScreenProjector(bounds, width, height) : null;

  const referencePolyline = projector
    ? toPointString(referenceRing.map(([x, y]) => projector.toScreen(x, y)))
    : '';
  const draftPolyline = projector
    ? toPointString(
        (points.length > 1 ? (isClosed ? [...points, points[0]] : points) : points).map(([x, y]) =>
          projector.toScreen(x, y)
        )
      )
    : '';

  const validateClosedGeometry = useCallback(currentPoints => {
    if (hasSelfIntersections(currentPoints)) {
      return 'Контур самопересекается. Исправьте геометрию перед замыканием/сохранением.';
    }
    if (getShortestSegment(currentPoints) < MIN_SEGMENT_LENGTH_M) {
      return `Слишком короткая сторона. Минимальная длина: ${formatMeters(MIN_SEGMENT_LENGTH_M)}.`;
    }
    return '';
  }, []);

  const snapPoint = useCallback(
    (point, ignoreSnap = false) => {
      const nearestVertexDistance = referenceVertices.length
        ? referenceVertices.reduce((min, vertex) => Math.min(min, distance(point, vertex)), Infinity)
        : Infinity;

      if (nearestVertexDistance > MAX_VERTEX_OFFSET_M) {
        return {
          point,
          snap: null,
          error: `Новая вершина должна быть не дальше ${MAX_VERTEX_OFFSET_M} м от вершины импортированной границы.`,
        };
      }

      if (ignoreSnap) return { point, snap: null, error: '' };
      const snap = getNearestSnapPoint(point, referenceRing, snapMode);
      if (!snap) return { point, snap: null, error: '' };
      return { point: snap.point.map(round2), snap, error: '' };
    },
    [referenceRing, referenceVertices, snapMode]
  );

  const handleAddSegment = () => {
    if (isClosed) {
      setError('Контур уже замкнут. Разомкните или сбросьте чертёж, чтобы добавить сторону.');
      return;
    }
    if (!points.length) {
      setError('Нет опорной точки.');
      return;
    }
    const length = Number(segmentLength);
    const angle = Number(segmentAngle);
    if (!Number.isFinite(length) || length <= 0) {
      setError('Длина стороны должна быть больше 0.');
      return;
    }
    if (!Number.isFinite(angle)) {
      setError('Укажите корректный угол.');
      return;
    }

    const [x, y] = points[points.length - 1];
    const rad = (angle * Math.PI) / 180;
    const nextPoint = [round2(x + length * Math.cos(rad)), round2(y + length * Math.sin(rad))];
    const snapped = snapPoint(nextPoint);
    if (snapped.error) {
      setError(snapped.error);
      return;
    }

    pushHistory();
    setError('');
    setPoints(prev => [...prev, snapped.point]);
    setSelectedPointIndex(points.length);
    setLastSnap(snapped.snap);
  };

  const handleClosePolyline = () => {
    if (points.length < 3) {
      setError('Для замыкания нужно минимум 3 вершины.');
      return;
    }
    const validationError = validateClosedGeometry(points);
    if (validationError) {
      setError(validationError);
      return;
    }
    pushHistory();
    setError('');
    setIsClosed(true);
  };

  const undo = useCallback(() => {
    if (!history.length) return;
    const snapshot = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, { points, isClosed, selectedPointIndex }]);
    restoreSnapshot(snapshot);
  }, [history, isClosed, points, restoreSnapshot, selectedPointIndex]);

  const redo = useCallback(() => {
    if (!redoStack.length) return;
    const snapshot = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setHistory(prev => [...prev, { points, isClosed, selectedPointIndex }]);
    restoreSnapshot(snapshot);
  }, [redoStack, isClosed, points, restoreSnapshot, selectedPointIndex]);

  const deleteSelectedPoint = useCallback(() => {
    if (selectedPointIndex === null) return;
    if (points.length <= 3 && isClosed) {
      setError('Замкнутый контур должен содержать минимум 3 вершины.');
      return;
    }
    if (points.length <= 1) return;
    pushHistory();
    setPoints(prev => prev.filter((_, idx) => idx !== selectedPointIndex));
    setSelectedPointIndex(null);
    if (points.length - 1 < 3) setIsClosed(false);
    setError('');
  }, [isClosed, points.length, pushHistory, selectedPointIndex]);

  const handleSave = () => {
    if (!projected?.origin) return;
    if (points.length < 3) {
      setError('Нужно минимум 3 вершины для контура.');
      return;
    }
    if (!isClosed) {
      setError('Перед сохранением замкните контур кнопкой «Замкнуть».');
      return;
    }

    const validationError = validateClosedGeometry(points);
    if (validationError) {
      setError(validationError);
      return;
    }

    const geometryMeters = {
      type: 'Polygon',
      coordinates: [[...points, points[0]]],
    };
    const unrotatedGeometryMeters = rotateGeometryInMeters(geometryMeters, projected.rotationDeg);
    const geometry = geometryFromMeterPoints(unrotatedGeometryMeters, projected.origin);
    if (!isGeometryWithinGeometry(geometry, boundaryGeometry)) {
      setError('Контур вышел за границы импортированного здания.');
      return;
    }

    setError('');
    onSave?.(geometry);
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = evt => {
      if (evt.key === 'Escape') setSelectedPointIndex(null);
      if (isReadOnly) return;

      if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'z') {
        evt.preventDefault();
        if (evt.shiftKey) redo();
        else undo();
      }

      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        evt.preventDefault();
        deleteSelectedPoint();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelectedPoint, isOpen, isReadOnly, redo, undo]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-semibold text-slate-800">CAD редактор здания</h3>
            <p className="text-xs text-slate-500">
              Старт с левой нижней вершины, обход по часовой. Добавляйте стороны, затем замкните
              контур.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 overflow-y-auto">
          <div className="space-y-3">
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-3">
              Вершины нового контура должны быть в пределах {MAX_VERTEX_OFFSET_M} м от вершин
              импортированной геометрии.
            </div>

            <div className="text-xs text-slate-700 border border-slate-200 rounded p-3 bg-white space-y-1">
              <div className="text-slate-500">Ориентация здания</div>
              <div className="font-semibold">
                Повернуто на {Math.round((-projected?.rotationDeg || 0) * 10) / 10}° (длинная
                сторона горизонтальна)
              </div>
              <div className="text-slate-500">Площадь импорта: {formatArea(boundaryAreaM2)}</div>
              {isClosed && points.length >= 3 && (
                <div className="text-slate-500">Площадь CAD: {formatArea(draftAreaM2)}</div>
              )}
              <div className="text-slate-500">Периметр CAD: {formatMeters(draftPerimeterM)}</div>
              {!isClosed && closureDistance !== null && (
                <div className="text-amber-700">
                  До замыкания: {formatMeters(closureDistance)}
                </div>
              )}
            </div>

            <div className="rounded border border-slate-200 p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                <Magnet size={12} /> Привязка
              </div>
              {['grid', 'vertex', 'edge'].map(mode => (
                <label key={mode} className="text-xs flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={snapMode[mode]}
                    onChange={e => setSnapMode(prev => ({ ...prev, [mode]: e.target.checked }))}
                  />
                  {mode === 'grid' ? 'Сетка' : mode === 'vertex' ? 'Вершины' : 'Стороны'}
                </label>
              ))}
              <div className="text-[11px] text-slate-500">Порог привязки: {formatMeters(SNAP_THRESHOLD_M)}</div>
              {lastSnap && (
                <div className="text-[11px] text-emerald-700">
                  Последняя привязка: {lastSnap.type} · {formatMeters(lastSnap.distance || 0)}
                </div>
              )}
            </div>

            <label className="text-xs flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
              Показать сетку
            </label>

            <label className="text-xs flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={showSatellite}
                onChange={e => setShowSatellite(e.target.checked)}
              />
              Подложка карты
            </label>

            {showSatellite && (
              <>
                <label className="block text-xs font-medium text-slate-700">
                  Провайдер
                  <select
                    value={satelliteProvider}
                    onChange={e => setSatelliteProvider(e.target.value)}
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="google">Google Satellite</option>
                    <option value="osm">OpenStreetMap</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Прозрачность подложки: {Math.round(satelliteOpacity * 100)}%
                  <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.05"
                    value={satelliteOpacity}
                    onChange={e => setSatelliteOpacity(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              </>
            )}

            <label className="block text-xs font-medium text-slate-700">
              Длина стороны, м
              <input
                type="number"
                value={segmentLength}
                onChange={e => setSegmentLength(clamp(Number(e.target.value) || 0, 0, 10000))}
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                disabled={isReadOnly}
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              Угол направления, °
              <input
                type="number"
                value={segmentAngle}
                onChange={e => setSegmentAngle(Number(e.target.value) || 0)}
                className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                disabled={isReadOnly}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAddSegment}
                disabled={isReadOnly}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 text-white text-xs"
              >
                <MoveRight size={14} /> Добавить сторону
              </button>
              <button
                type="button"
                onClick={handleClosePolyline}
                disabled={isReadOnly || isClosed || points.length < 3}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
              >
                Замкнуть
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={isReadOnly || !history.length}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
              >
                <Undo2 size={14} /> Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={isReadOnly || !redoStack.length}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
              >
                <Redo2 size={14} /> Redo
              </button>
              <button
                type="button"
                onClick={deleteSelectedPoint}
                disabled={isReadOnly || selectedPointIndex === null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
              >
                <Eraser size={14} /> Удалить вершину
              </button>
              <button
                type="button"
                onClick={() => {
                  pushHistory();
                  setPoints(getLeftBottomVertex(referenceRing) ? [getLeftBottomVertex(referenceRing).map(round2)] : []);
                  setIsClosed(false);
                  setSelectedPointIndex(null);
                }}
                disabled={isReadOnly}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
              >
                <Trash2 size={14} /> Сбросить
              </button>
            </div>

            <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
              <Crosshair size={12} /> Hotkeys: Ctrl+Z / Ctrl+Shift+Z / Delete / Esc.
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 overflow-auto relative">
            {showSatellite && satelliteUrls[satelliteProvider] && (
              <iframe
                title="Map underlay"
                src={satelliteUrls[satelliteProvider]}
                className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)] rounded pointer-events-none"
                loading="lazy"
                style={{ opacity: satelliteOpacity }}
              />
            )}
            <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded relative">
              <defs>
                <pattern id="building-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#d1d5db" strokeWidth="1" />
                </pattern>
              </defs>
              <rect
                x="0"
                y="0"
                width={width}
                height={height}
                fill={showSatellite ? 'rgba(248,250,252,0.28)' : '#f8fafc'}
              />
              {showGrid && <rect x="0" y="0" width={width} height={height} fill="url(#building-grid)" />}
              {referencePolyline && (
                <polyline
                  points={referencePolyline}
                  fill="rgba(59,130,246,0.1)"
                  stroke="#2563eb"
                  strokeWidth="2"
                />
              )}
              {draftPolyline && (
                <polyline
                  points={draftPolyline}
                  fill="rgba(16,185,129,0.18)"
                  stroke="#059669"
                  strokeWidth="2"
                  strokeDasharray={isClosed ? undefined : '7 5'}
                />
              )}

              {projector &&
                boundarySegments
                  .filter((_, idx) => projector.scale > 10 || idx % 2 === 0)
                  .map(segment => {
                    const [sx, sy] = projector.toScreen(segment.mid[0], segment.mid[1]);
                    return (
                      <text
                        key={segment.key}
                        x={sx}
                        y={sy - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#1d4ed8"
                      >
                        {formatMeters(segment.length)}
                      </text>
                    );
                  })}

              {projector &&
                draftSegments
                  .filter((_, idx) => projector.scale > 10 || idx % 2 === 0)
                  .map(segment => {
                    const [sx, sy] = projector.toScreen(segment.mid[0], segment.mid[1]);
                    return (
                      <text
                        key={segment.key}
                        x={sx}
                        y={sy - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#047857"
                      >
                        {formatMeters(segment.length)}
                      </text>
                    );
                  })}

              {projector && boundaryCenter && (
                <text
                  x={projector.toScreen(boundaryCenter[0], boundaryCenter[1])[0]}
                  y={projector.toScreen(boundaryCenter[0], boundaryCenter[1])[1]}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#1e3a8a"
                >
                  {formatArea(boundaryAreaM2)}
                </text>
              )}

              {projector && draftCenter && isClosed && points.length >= 3 && (
                <text
                  x={projector.toScreen(draftCenter[0], draftCenter[1])[0]}
                  y={projector.toScreen(draftCenter[0], draftCenter[1])[1]}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#065f46"
                >
                  {formatArea(draftAreaM2)}
                </text>
              )}

              {projector &&
                points.map((point, index) => {
                  const [cx, cy] = projector.toScreen(point[0], point[1]);
                  return (
                    <g key={`point-${index}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={selectedPointIndex === index ? 7 : 5}
                        fill={selectedPointIndex === index ? '#f59e0b' : '#047857'}
                        onClick={evt => {
                          evt.stopPropagation();
                          setSelectedPointIndex(index);
                        }}
                      />
                      <text x={cx + 8} y={cy - 8} fontSize="10" fill="#0f172a">
                        {index + 1}
                      </text>
                    </g>
                  );
                })}
            </svg>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">
            Закрыть
          </button>
          {!isReadOnly && (
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-1.5"
            >
              <Save size={14} /> Сохранить CAD
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
