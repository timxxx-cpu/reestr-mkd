import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Undo2, Trash2, MoveRight, AlertTriangle } from 'lucide-react';
import {
  geometryFromMeterPoints,
  getGeometryBoundsInMeters,
  isGeometryWithinGeometry,
  projectGeometryToLocalMeters,
} from '@lib/geometry-utils';

const MAX_VERTEX_OFFSET_M = 2;

const round2 = value => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toPointString = points => points.map(([x, y]) => `${x},${y}`).join(' ');

const distance = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);

const getLeftBottomVertex = (ring = []) => {
  const vertices = ring.slice(0, -1);
  if (!vertices.length) return null;
  return [...vertices].sort((a, b) => {
    if (Math.abs(a[0] - b[0]) < 1e-6) return a[1] - b[1];
    return a[0] - b[0];
  })[0];
};

const findNearestVertexDistance = (point, referenceVertices = []) => {
  if (!referenceVertices.length) return Infinity;
  return referenceVertices.reduce((min, vertex) => Math.min(min, distance(point, vertex)), Infinity);
};

const toScreenProjector = (bounds, width, height) => {
  const padding = 32;
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight);
  const offsetX = (width - worldWidth * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - worldHeight * scale) / 2 + bounds.maxY * scale;

  return {
    toScreen: (x, y) => [x * scale + offsetX, offsetY - y * scale],
  };
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
  const [error, setError] = useState('');

  const projectedBoundary = useMemo(() => {
    if (!boundaryGeometry) return null;
    return projectGeometryToLocalMeters(boundaryGeometry);
  }, [boundaryGeometry]);

  const referenceRing = useMemo(() => projectedBoundary?.coordinates?.[0] || [], [projectedBoundary]);
  const referenceVertices = useMemo(() => referenceRing.slice(0, -1), [referenceRing]);

  const projectedInitial = useMemo(() => {
    if (!initialGeometry || !projectedBoundary?.origin) return null;
    return projectGeometryToLocalMeters(initialGeometry);
  }, [initialGeometry, projectedBoundary?.origin]);

  useEffect(() => {
    if (!isOpen) return;
    if (projectedInitial?.coordinates?.[0]?.length >= 4) {
      setPoints(projectedInitial.coordinates[0].slice(0, -1));
      return;
    }
    const anchor = getLeftBottomVertex(referenceRing);
    setPoints(anchor ? [anchor.map(round2)] : []);
  }, [isOpen, projectedInitial, referenceRing]);

  const bounds = useMemo(() => {
    const base = getGeometryBoundsInMeters(projectedBoundary);
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
  }, [projectedBoundary, points]);

  const width = 780;
  const height = 480;
  const projector = bounds ? toScreenProjector(bounds, width, height) : null;

  const referencePolyline = projector
    ? toPointString(referenceRing.map(([x, y]) => projector.toScreen(x, y)))
    : '';
  const draftPolyline = projector
    ? toPointString((points.length > 1 ? [...points, points[0]] : points).map(([x, y]) => projector.toScreen(x, y)))
    : '';

  const handleAddSegment = () => {
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
    const nearestDistance = findNearestVertexDistance(nextPoint, referenceVertices);

    if (nearestDistance > MAX_VERTEX_OFFSET_M) {
      setError(`Новая вершина должна быть не дальше ${MAX_VERTEX_OFFSET_M} м от вершины импортированной границы.`);
      return;
    }

    setError('');
    setPoints(prev => [...prev, nextPoint]);
  };

  const handleSave = () => {
    if (!projectedBoundary?.origin) return;
    if (points.length < 3) {
      setError('Нужно минимум 3 вершины для контура.');
      return;
    }

    const geometryMeters = {
      type: 'Polygon',
      coordinates: [[...points, points[0]]],
    };
    const geometry = geometryFromMeterPoints(geometryMeters, projectedBoundary.origin);
    if (!isGeometryWithinGeometry(geometry, boundaryGeometry)) {
      setError('Контур вышел за границы импортированного здания.');
      return;
    }

    setError('');
    onSave?.(geometry);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-semibold text-slate-800">CAD редактор здания</h3>
            <p className="text-xs text-slate-500">Старт с левой нижней вершины, обход по часовой. Укажите длину стороны и угол (по умолчанию 90°).</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 overflow-y-auto">
          <div className="space-y-3">
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-3">
              Вершины нового контура должны быть в пределах {MAX_VERTEX_OFFSET_M} м от вершин импортированной геометрии.
            </div>

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
                onClick={() => setPoints(prev => prev.slice(0, -1))}
                disabled={isReadOnly || points.length <= 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
              >
                <Undo2 size={14} /> Отменить
              </button>
              <button
                type="button"
                onClick={() => setPoints(getLeftBottomVertex(referenceRing) ? [getLeftBottomVertex(referenceRing).map(round2)] : [])}
                disabled={isReadOnly}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
              >
                <Trash2 size={14} /> Сбросить
              </button>
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 overflow-auto">
            <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white rounded">
              <rect x="0" y="0" width={width} height={height} fill="#f8fafc" />
              {referencePolyline && <polyline points={referencePolyline} fill="rgba(59,130,246,0.1)" stroke="#2563eb" strokeWidth="2" />}
              {draftPolyline && <polyline points={draftPolyline} fill="rgba(16,185,129,0.18)" stroke="#059669" strokeWidth="2" />}
              {projector &&
                points.map((point, index) => {
                  const [cx, cy] = projector.toScreen(point[0], point[1]);
                  return (
                    <g key={`point-${index}`}>
                      <circle cx={cx} cy={cy} r="5" fill="#047857" />
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
            <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-1.5">
              <Save size={14} /> Сохранить CAD
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
