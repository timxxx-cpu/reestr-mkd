import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Undo2,
  Redo2,
  Trash2,
  Save,
  AlertTriangle,
  Move,
  Magnet,
  Crosshair,
  Eraser,
  Ruler,
} from 'lucide-react';
import {
  projectGeometryToLocalMeters,
  projectGeometryToOriginMeters,
  rotateGeometryInMeters,
  getNarrowAxisAngleDeg,
  getGeometryBoundsInMeters,
  geometryFromMeterPoints,
  isGeometryWithinGeometry,
} from '@lib/geometry-utils';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SNAP_THRESHOLD_M = 1.2;
const MIN_SEGMENT_LENGTH_M = 0.3;

const toPointString = points => points.map(([x, y]) => `${x},${y}`).join(' ');
const formatMeters = value => `${value.toFixed(2)} м`;
const formatArea = value => `${value.toFixed(2)} м²`;
const round2 = value => Math.round(value * 100) / 100;

const getOuterRingGeo = geometry => {
  if (!geometry || typeof geometry !== 'object') return [];
  if (geometry.type === 'Polygon') return geometry.coordinates?.[0] || [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0] || [];
  return [];
};

const getOuterRingMeters = geometry => {
  if (!geometry || typeof geometry !== 'object') return [];
  if (geometry.type === 'Polygon') return geometry.coordinates?.[0] || [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0] || [];
  return [];
};

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

const distance = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);

const getPointToSegmentProjection = (point, start, end) => {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (!lengthSq) {
    return { point: [x1, y1], distance: Math.hypot(px - x1, py - y1) };
  }

  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1);
  const projected = [x1 + dx * t, y1 + dy * t];
  return { point: projected, distance: Math.hypot(px - projected[0], py - projected[1]) };
};

const getNearestSnapPoint = (point, buildingRing = [], snapMode = {}) => {
  if (!Array.isArray(buildingRing) || buildingRing.length < 2) return null;
  const candidates = [];

  if (snapMode.vertex) {
    const vertices = buildingRing.slice(0, -1);
    for (const vertex of vertices) {
      candidates.push({ point: vertex, distance: distance(point, vertex), type: 'vertex' });
    }
  }

  if (snapMode.edge) {
    for (let i = 0; i < buildingRing.length - 1; i += 1) {
      const snap = getPointToSegmentProjection(point, buildingRing[i], buildingRing[i + 1]);
      candidates.push({ point: snap.point, distance: snap.distance, type: 'edge' });
    }
  }

  const candidate = candidates.sort((a, b) => a.distance - b.distance)[0];
  if (!candidate || candidate.distance > SNAP_THRESHOLD_M) return null;
  return candidate;
};

const getNearestBoundaryPoint = (point, buildingRing = []) => {
  if (!Array.isArray(buildingRing) || buildingRing.length < 2) return point;
  let best = null;
  for (let i = 0; i < buildingRing.length - 1; i += 1) {
    const projection = getPointToSegmentProjection(point, buildingRing[i], buildingRing[i + 1]);
    if (!best || projection.distance < best.distance) best = projection;
  }
  return best?.point || point;
};

const rotateOffset = (x, y, angleDeg) => {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos];
};

const buildRectangleFromAnchor = (anchorPoint, width, depth, angleDeg) => {
  const [ax, ay] = anchorPoint;
  const vectors = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];
  return vectors.map(([vx, vy]) => {
    const [rx, ry] = rotateOffset(vx, vy, angleDeg);
    return [round2(ax + rx), round2(ay + ry)];
  });
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

const gridStepPx = 24;

const PointHandle = ({ cx, cy, index, isSelected, onPointerDown, onClick }) => (
  <g>
    <circle
      cx={cx}
      cy={cy}
      r={isSelected ? 9 : 8}
      fill={isSelected ? '#fde68a' : '#ffffff'}
      stroke="#0f172a"
      strokeWidth="2"
      onClick={evt => {
        evt.stopPropagation();
        onClick?.(index);
      }}
    />
    <text
      x={cx}
      y={cy + 4}
      textAnchor="middle"
      fontSize="10"
      fill="#0f172a"
      className="select-none"
    >
      {index + 1}
    </text>
    <circle
      cx={cx}
      cy={cy}
      r={14}
      fill="transparent"
      onPointerDown={evt => onPointerDown(evt, index)}
      style={{ cursor: 'grab' }}
    />
  </g>
);

export default function BlockCadEditorModal({
  isOpen,
  onClose,
  buildingGeometry,
  blockGeometry,
  onSave,
  isReadOnly = false,
}) {
  const [draftPoints, setDraftPoints] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [error, setError] = useState('');
  const [snapMode, setSnapMode] = useState({ grid: true, vertex: true, edge: true });
  const [lastSnap, setLastSnap] = useState(null);

  const [templateWidth, setTemplateWidth] = useState(12);
  const [templateDepth, setTemplateDepth] = useState(8);
  const [templateAngleDeg, setTemplateAngleDeg] = useState(0);
  const [templateSnapToBoundary, setTemplateSnapToBoundary] = useState(true);
  const [showUnderlay, setShowUnderlay] = useState(false);
  const [underlayProvider, setUnderlayProvider] = useState('google');
  const [underlayOpacity, setUnderlayOpacity] = useState(0.55);

  const projected = useMemo(() => {
    if (!buildingGeometry) return null;

    const buildingProjected = projectGeometryToLocalMeters(buildingGeometry);
    if (!buildingProjected) return null;

    const narrowAxis = getNarrowAxisAngleDeg(buildingProjected);
    const rotationDeg = 90 - narrowAxis;
    const rotatedBuilding = rotateGeometryInMeters(buildingProjected, rotationDeg);

    const rotatedBlock = blockGeometry
      ? rotateGeometryInMeters(
          projectGeometryToOriginMeters(blockGeometry, buildingProjected.origin),
          rotationDeg
        )
      : null;

    return {
      rotationDeg,
      origin: buildingProjected.origin,
      buildingMeters: rotatedBuilding,
      blockMeters: rotatedBlock,
    };
  }, [buildingGeometry, blockGeometry]);

  const allBounds = useMemo(() => {
    const bb = getGeometryBoundsInMeters(projected?.buildingMeters || null);
    if (!bb) return null;

    const padding = 8;
    return {
      minX: bb.minX - padding,
      minY: bb.minY - padding,
      maxX: bb.maxX + padding,
      maxY: bb.maxY + padding,
    };
  }, [projected]);

  const worldSize = useMemo(() => {
    if (!allBounds) return { w: 1, h: 1 };
    return {
      w: Math.max(1, allBounds.maxX - allBounds.minX),
      h: Math.max(1, allBounds.maxY - allBounds.minY),
    };
  }, [allBounds]);

  const viewport = { w: 1400, h: 800 };
  const scale = Math.min(viewport.w / worldSize.w, viewport.h / worldSize.h);

  const toScreen = (x, y) => {
    if (!allBounds) return [0, 0];
    return [(x - allBounds.minX) * scale, viewport.h - (y - allBounds.minY) * scale];
  };

  const toWorld = (screenX, screenY) => {
    if (!allBounds) return [0, 0];
    return [screenX / scale + allBounds.minX, (viewport.h - screenY) / scale + allBounds.minY];
  };

  const existingPoints = useMemo(() => getOuterRingMeters(projected?.blockMeters).slice(0, -1), [projected]);
  const activePoints = draftPoints.length ? draftPoints : existingPoints;

  const buildingOuterRing = useMemo(() => getOuterRingMeters(projected?.buildingMeters), [projected]);
  const buildingVertices = buildingOuterRing.slice(0, -1);

  const underlayUrls = useMemo(() => {
    const ring = getOuterRingGeo(buildingGeometry);
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
  }, [buildingGeometry]);

  const blockRingFromState = activePoints.length ? [...activePoints, activePoints[0]] : [];
  const buildingPolyline = toPointString(buildingOuterRing.map(([x, y]) => toScreen(x, y)));
  const blockPolyline = toPointString(blockRingFromState.map(([x, y]) => toScreen(x, y)));

  const blockAreaM2 = calcPolygonAreaM2(activePoints);
  const buildingAreaM2 = calcPolygonAreaM2(buildingVertices);

  const blockCenter = useMemo(() => {
    if (!activePoints.length) return null;
    const sum = activePoints.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [sum[0] / activePoints.length, sum[1] / activePoints.length];
  }, [activePoints]);

  const buildingCenter = useMemo(() => {
    if (!buildingVertices.length) return null;
    const sum = buildingVertices.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [sum[0] / buildingVertices.length, sum[1] / buildingVertices.length];
  }, [buildingVertices]);

  const blockSegments = useMemo(() => {
    if (activePoints.length < 2) return [];
    return activePoints.map((start, index) => {
      const end = activePoints[(index + 1) % activePoints.length];
      const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      return { mid, length: distance(start, end), key: `${index}-${start[0]}-${start[1]}` };
    });
  }, [activePoints]);

  const buildingSegments = useMemo(() => {
    if (buildingVertices.length < 2) return [];
    return buildingVertices.map((start, index) => {
      const end = buildingVertices[(index + 1) % buildingVertices.length];
      const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      return { mid, length: distance(start, end), key: `b-${index}-${start[0]}-${start[1]}` };
    });
  }, [buildingVertices]);

  const templateAnchor = useMemo(() => {
    if (selectedPointIndex !== null && activePoints[selectedPointIndex])
      return activePoints[selectedPointIndex];
    if (activePoints.length) return activePoints[0];
    if (buildingVertices.length) return buildingVertices[0];
    return null;
  }, [selectedPointIndex, activePoints, buildingVertices]);

  const templatePreviewPoints = useMemo(() => {
    if (!templateAnchor) return [];
    const base = buildRectangleFromAnchor(
      templateAnchor,
      Number(templateWidth),
      Number(templateDepth),
      Number(templateAngleDeg)
    );
    if (templateSnapToBoundary) {
      return base.map(point => getNearestBoundaryPoint(point, buildingOuterRing).map(round2));
    }
    return base;
  }, [
    templateAnchor,
    templateWidth,
    templateDepth,
    templateAngleDeg,
    templateSnapToBoundary,
    buildingOuterRing,
  ]);

  const templatePreviewPolyline = toPointString(
    templatePreviewPoints.length
      ? [...templatePreviewPoints, templatePreviewPoints[0]].map(([x, y]) => toScreen(x, y))
      : []
  );

  const applyPointsUpdate = useCallback(
    updater => {
      setDraftPoints(prev => {
        const base = prev.length ? prev : existingPoints;
        const next = updater(base);
        if (!Array.isArray(next)) return base;
        setHistory(h => [...h, base]);
        setRedoStack([]);
        return next;
      });
    },
    [existingPoints]
  );

  const undo = useCallback(() => {
    if (!history.length) return;
    setHistory(prev => {
      const snapshot = prev[prev.length - 1];
      const rest = prev.slice(0, -1);
      setDraftPoints(current => {
        const currentBase = current.length ? current : existingPoints;
        setRedoStack(r => [...r, currentBase]);
        return snapshot;
      });
      return rest;
    });
    setSelectedPointIndex(null);
    setError('');
  }, [history, existingPoints]);

  const redo = useCallback(() => {
    if (!redoStack.length) return;
    setRedoStack(prev => {
      const snapshot = prev[prev.length - 1];
      const rest = prev.slice(0, -1);
      setDraftPoints(current => {
        const currentBase = current.length ? current : existingPoints;
        setHistory(h => [...h, currentBase]);
        return snapshot;
      });
      return rest;
    });
    setSelectedPointIndex(null);
    setError('');
  }, [redoStack, existingPoints]);

  const deleteSelectedPoint = useCallback(() => {
    if (selectedPointIndex === null) return;
    if (activePoints.length <= 3) {
      setError('Контур должен содержать минимум 3 точки.');
      return;
    }
    applyPointsUpdate(prev => prev.filter((_, idx) => idx !== selectedPointIndex));
    setSelectedPointIndex(null);
    setError('');
  }, [selectedPointIndex, activePoints, applyPointsUpdate]);

  const snapPoint = point => {
    const snapping = getNearestSnapPoint(point, buildingOuterRing, snapMode);
    if (snapping) {
      const snapped = [round2(snapping.point[0]), round2(snapping.point[1])];
      return { point: snapped, snap: { ...snapping, point: snapped } };
    }
    if (snapMode.grid) {
      const snapped = [Math.round(point[0]), Math.round(point[1])];
      return {
        point: snapped,
        snap: { type: 'grid', point: snapped, distance: distance(point, snapped) },
      };
    }
    const raw = [round2(point[0]), round2(point[1])];
    return { point: raw, snap: null };
  };

  const handleCanvasClick = evt => {
    if (isReadOnly || !allBounds) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const [x, y] = toWorld(evt.clientX - rect.left, evt.clientY - rect.top);
    const { point, snap } = snapPoint([x, y]);
    applyPointsUpdate(prev => [...prev, point]);
    setLastSnap(snap);
    setSelectedPointIndex(null);
    setError('');
  };

  const handlePointerMove = evt => {
    if (dragIndex === null || isReadOnly || !allBounds) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const px = clamp(evt.clientX - rect.left, 0, rect.width);
    const py = clamp(evt.clientY - rect.top, 0, rect.height);
    const [x, y] = toWorld(px, py);
    const { point, snap } = snapPoint([x, y]);

    setDraftPoints(prev => {
      const base = prev.length ? prev : existingPoints;
      const next = [...base];
      next[dragIndex] = point;
      return next;
    });
    setLastSnap(snap);
  };

  const handleDragStart = idx => {
    if (isReadOnly) return;
    const base = draftPoints.length ? draftPoints : existingPoints;
    setHistory(h => [...h, base]);
    setRedoStack([]);
    setDragIndex(idx);
    setSelectedPointIndex(idx);
  };

  const validatePoints = points => {
    if (points.length < 3 || !projected?.origin)
      return 'Нужно минимум 3 точки для геометрии блока.';
    if (hasSelfIntersections(points))
      return 'Контур блока самопересекается. Исправьте узлы перед сохранением.';
    if (getShortestSegment(points) < MIN_SEGMENT_LENGTH_M) {
      return `Слишком короткая сторона. Минимальная длина: ${formatMeters(MIN_SEGMENT_LENGTH_M)}.`;
    }
    return '';
  };

  const handleCreateByDimensions = () => {
    if (isReadOnly) return;
    if (!templateAnchor) {
      setError('Нет опорной вершины. Выделите вершину блока или начните построение контура.');
      return;
    }

    let points = buildRectangleFromAnchor(
      templateAnchor,
      Number(templateWidth),
      Number(templateDepth),
      Number(templateAngleDeg)
    );
    if (templateSnapToBoundary) {
      points = points.map(point => getNearestBoundaryPoint(point, buildingOuterRing).map(round2));
    }

    const validationError = validatePoints(points);
    if (validationError) {
      setError(validationError);
      return;
    }

    const meterGeometry = { type: 'Polygon', coordinates: [[...points, points[0]]] };
    const unrotatedMeters = rotateGeometryInMeters(meterGeometry, -projected.rotationDeg);
    const resultGeo = geometryFromMeterPoints(unrotatedMeters, projected.origin);
    if (!isGeometryWithinGeometry(resultGeo, buildingGeometry)) {
      setError(
        'Геометрия по размерам вышла за границы здания. Измените угол/размеры или отключите прижатие.'
      );
      return;
    }

    applyPointsUpdate(() => points);
    setError('');
  };

  const handleSave = () => {
    const points = activePoints;
    const validationError = validatePoints(points);
    if (validationError) {
      setError(validationError);
      return;
    }

    const meterGeometry = { type: 'Polygon', coordinates: [[...points, points[0]]] };
    const unrotatedMeters = rotateGeometryInMeters(meterGeometry, -projected.rotationDeg);
    const resultGeo = geometryFromMeterPoints(unrotatedMeters, projected.origin);

    if (!isGeometryWithinGeometry(resultGeo, buildingGeometry)) {
      setError('Геометрия блока должна полностью находиться внутри контура здания.');
      return;
    }

    onSave?.(resultGeo);
    onClose?.();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = evt => {
      if (evt.key === 'Escape') {
        setDragIndex(null);
        setSelectedPointIndex(null);
      }
      if (isReadOnly) return;
      if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'z') {
        evt.preventDefault();
        if (evt.shiftKey) redo();
        else undo();
        return;
      }
      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        evt.preventDefault();
        deleteSelectedPoint();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isReadOnly, undo, redo, deleteSelectedPoint]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-950 text-slate-100 flex flex-col">
      <div className="h-16 border-b border-slate-800 px-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">CAD редактор блока</h3>
          <p className="text-xs text-slate-400">
            Полноэкранный режим, сетка 1 метр, опциональная картографическая подложка.
          </p>
        </div>
        <button
          onClick={onClose}
          className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 inline-flex items-center gap-2"
        >
          <X size={14} /> Закрыть
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[360px] border-r border-slate-800 p-4 space-y-3 overflow-y-auto">
          <div className="text-xs text-slate-400 leading-relaxed">
            Клик добавляет точки. Перетаскивание двигает вершины. Есть snap к сетке/зданию,
            undo/redo и удаление выбранной вершины.
          </div>

          <div className="text-xs">
            <div className="text-slate-400">Ориентация здания</div>
            <div className="font-semibold">
              Повернуто на {Math.round((-projected?.rotationDeg || 0) * 10) / 10}° (длинная сторона
              горизонтальна)
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 p-2 space-y-2">
            <div className="text-xs font-semibold">Подложка</div>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={showUnderlay}
                onChange={e => setShowUnderlay(e.target.checked)}
              />
              Показать подложку
            </label>
            {showUnderlay && (
              <>
                <label className="text-xs text-slate-300 block">
                  Провайдер
                  <select
                    value={underlayProvider}
                    onChange={e => setUnderlayProvider(e.target.value)}
                    className="mt-1 w-full h-8 rounded bg-slate-900 border border-slate-700 px-2 text-xs"
                  >
                    <option value="google">Google Satellite</option>
                    <option value="osm">OpenStreetMap</option>
                  </select>
                </label>
                <label className="text-xs text-slate-300 block">
                  Прозрачность: {Math.round(underlayOpacity * 100)}%
                  <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.05"
                    value={underlayOpacity}
                    onChange={e => setUnderlayOpacity(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              </>
            )}
          </div>

          <div className="rounded-lg border border-slate-700 p-2 space-y-2">
            <div className="text-xs font-semibold inline-flex items-center gap-2">
              <Magnet size={12} /> Режимы привязки
            </div>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={snapMode.grid}
                onChange={e => setSnapMode(prev => ({ ...prev, grid: e.target.checked }))}
              />
              Сетка
            </label>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={snapMode.vertex}
                onChange={e => setSnapMode(prev => ({ ...prev, vertex: e.target.checked }))}
              />
              Вершины здания
            </label>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={snapMode.edge}
                onChange={e => setSnapMode(prev => ({ ...prev, edge: e.target.checked }))}
              />
              Стороны здания
            </label>
            <div className="text-[11px] text-slate-400">
              Порог привязки: {formatMeters(SNAP_THRESHOLD_M)}
            </div>
            {lastSnap && (
              <div className="text-[11px] text-emerald-300">
                Последняя привязка: {lastSnap.type === 'grid' ? 'сетка' : lastSnap.type} ·{' '}
                {formatMeters(lastSnap.distance || 0)}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-700 p-2 space-y-2">
            <div className="text-xs font-semibold inline-flex items-center gap-2">
              <Ruler size={12} /> Геометрия по размерам
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-300">
                Ширина, м
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  value={templateWidth}
                  onChange={e => setTemplateWidth(Number(e.target.value))}
                  className="mt-1 w-full h-8 rounded bg-slate-900 border border-slate-700 px-2 text-xs"
                />
              </label>
              <label className="text-xs text-slate-300">
                Глубина, м
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  value={templateDepth}
                  onChange={e => setTemplateDepth(Number(e.target.value))}
                  className="mt-1 w-full h-8 rounded bg-slate-900 border border-slate-700 px-2 text-xs"
                />
              </label>
            </div>
            <label className="text-xs text-slate-300 block">
              Поворот, °
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={templateAngleDeg}
                onChange={e => setTemplateAngleDeg(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-[11px] text-slate-400">{templateAngleDeg}°</div>
            </label>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={templateSnapToBoundary}
                onChange={e => setTemplateSnapToBoundary(e.target.checked)}
              />
              Прижать вершины шаблона к границам здания
            </label>
            <div className="text-[11px] text-slate-400">
              Опорная вершина:{' '}
              {templateAnchor
                ? `${templateAnchor[0].toFixed(2)}, ${templateAnchor[1].toFixed(2)}`
                : 'не выбрана'}
            </div>
            <button
              onClick={handleCreateByDimensions}
              disabled={isReadOnly}
              className="w-full h-9 rounded-lg border border-cyan-700 hover:bg-cyan-900/30 text-sm inline-flex items-center justify-center gap-2"
            >
              <Ruler size={14} /> Создать по размерам
            </button>
          </div>

          {!isReadOnly && (
            <>
              <button
                onClick={undo}
                className="w-full h-9 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm inline-flex items-center justify-center gap-2"
                disabled={!history.length}
              >
                <Undo2 size={14} /> Отменить (Ctrl+Z)
              </button>
              <button
                onClick={redo}
                className="w-full h-9 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm inline-flex items-center justify-center gap-2"
                disabled={!redoStack.length}
              >
                <Redo2 size={14} /> Повторить (Ctrl+Shift+Z)
              </button>
              <button
                onClick={deleteSelectedPoint}
                className="w-full h-9 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm inline-flex items-center justify-center gap-2"
                disabled={selectedPointIndex === null || activePoints.length <= 3}
              >
                <Eraser size={14} /> Удалить выбранную вершину (Del)
              </button>
              <button
                onClick={() => {
                  setHistory(h => [...h, activePoints]);
                  setDraftPoints([]);
                  setError('');
                  setLastSnap(null);
                  setSelectedPointIndex(null);
                  setRedoStack([]);
                }}
                className="w-full h-9 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm inline-flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Очистить чертёж
              </button>
              <button
                onClick={handleSave}
                className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Save size={14} /> Сохранить контур блока
              </button>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/40 p-2 text-xs text-red-300 inline-flex gap-2 items-start">
              <AlertTriangle size={14} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 space-y-1">
            <div>Точек в контуре: {activePoints.length}</div>
            <div className="inline-flex items-center gap-1">
              <Move size={12} /> drag & drop узлов доступен
            </div>
            <div className="inline-flex items-center gap-1">
              <Crosshair size={12} /> Esc — снять выделение/drag
            </div>
            <div>Мин. длина стороны: {formatMeters(MIN_SEGMENT_LENGTH_M)}</div>
            {!!blockAreaM2 && <div>Площадь блока: {formatArea(blockAreaM2)}</div>}
          </div>
        </div>

        <div className="flex-1 p-4 relative">
          {showUnderlay && underlayUrls[underlayProvider] && (
            <iframe
              title="CAD map underlay"
              src={underlayUrls[underlayProvider]}
              className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] rounded-xl pointer-events-none border border-slate-800"
              loading="lazy"
              style={{
                opacity: underlayOpacity,
                transform: `rotate(${-(projected?.rotationDeg || 0)}deg)`,
                transformOrigin: 'center',
              }}
            />
          )}
          <svg
            viewBox={`0 0 ${viewport.w} ${viewport.h}`}
            className="w-full h-full rounded-xl border border-slate-800 relative"
            onClick={handleCanvasClick}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDragIndex(null)}
          >
            <defs>
              <pattern
                id="meter-grid"
                width={gridStepPx}
                height={gridStepPx}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${gridStepPx} 0 L 0 0 0 ${gridStepPx}`}
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="1"
                />
              </pattern>
              <pattern
                id="meter-grid-10"
                width={gridStepPx * 10}
                height={gridStepPx * 10}
                patternUnits="userSpaceOnUse"
              >
                <rect width={gridStepPx * 10} height={gridStepPx * 10} fill="url(#meter-grid)" />
                <path
                  d={`M ${gridStepPx * 10} 0 L 0 0 0 ${gridStepPx * 10}`}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.2"
                />
              </pattern>
            </defs>

            <rect x="0" y="0" width={viewport.w} height={viewport.h} fill={showUnderlay ? "rgba(2,6,23,0.35)" : "#0f172a"} />
            <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="url(#meter-grid-10)" />
            {buildingPolyline && (
              <polyline
                points={buildingPolyline}
                fill="rgba(59, 130, 246, 0.09)"
                stroke="#60a5fa"
                strokeWidth="2"
              />
            )}
            {templatePreviewPolyline && (
              <polyline
                points={templatePreviewPolyline}
                fill="rgba(34,211,238,0.1)"
                stroke="#22d3ee"
                strokeDasharray="8 6"
                strokeWidth="2"
              />
            )}

            {buildingVertices.map(([x, y], index) => {
              const [sx, sy] = toScreen(x, y);
              return (
                <g key={`building-vertex-${index}-${x}-${y}`}>
                  <circle cx={sx} cy={sy} r={6} fill="#60a5fa" stroke="#0f172a" strokeWidth="2" />
                  <text
                    x={sx}
                    y={sy - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#bfdbfe"
                    className="select-none"
                  >
                    B{index + 1}
                  </text>
                </g>
              );
            })}

            {buildingSegments.map(segment => {
              const [sx, sy] = toScreen(segment.mid[0], segment.mid[1]);
              return (
                <text
                  key={segment.key}
                  x={sx}
                  y={sy - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#93c5fd"
                  className="select-none"
                >
                  {formatMeters(segment.length)}
                </text>
              );
            })}

            {buildingCenter && (
              <text
                x={toScreen(buildingCenter[0], buildingCenter[1])[0]}
                y={toScreen(buildingCenter[0], buildingCenter[1])[1]}
                textAnchor="middle"
                fontSize="16"
                fill="#bfdbfe"
                className="select-none"
              >
                {formatArea(buildingAreaM2)}
              </text>
            )}
            {blockPolyline && (
              <polyline
                points={blockPolyline}
                fill="rgba(16, 185, 129, 0.25)"
                stroke="#34d399"
                strokeWidth="2.4"
              />
            )}

            {blockSegments.map(segment => {
              const [sx, sy] = toScreen(segment.mid[0], segment.mid[1]);
              return (
                <text
                  key={segment.key}
                  x={sx}
                  y={sy - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#6ee7b7"
                  className="select-none"
                >
                  {formatMeters(segment.length)}
                </text>
              );
            })}

            {blockCenter && (
              <text
                x={toScreen(blockCenter[0], blockCenter[1])[0]}
                y={toScreen(blockCenter[0], blockCenter[1])[1]}
                textAnchor="middle"
                fontSize="16"
                fill="#bbf7d0"
                className="select-none"
              >
                {formatArea(blockAreaM2)}
              </text>
            )}

            {lastSnap?.point && (
              <circle
                cx={toScreen(lastSnap.point[0], lastSnap.point[1])[0]}
                cy={toScreen(lastSnap.point[0], lastSnap.point[1])[1]}
                r={5}
                fill={
                  lastSnap.type === 'vertex'
                    ? '#f59e0b'
                    : lastSnap.type === 'edge'
                      ? '#fb7185'
                      : '#e2e8f0'
                }
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            )}

            {activePoints.map(([x, y], index) => {
              const [sx, sy] = toScreen(x, y);
              return (
                <PointHandle
                  key={`${index}-${x}-${y}`}
                  cx={sx}
                  cy={sy}
                  index={index}
                  isSelected={selectedPointIndex === index}
                  onClick={idx => setSelectedPointIndex(idx)}
                  onPointerDown={(_, idx) => handleDragStart(idx)}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>,
    document.body
  );
}
