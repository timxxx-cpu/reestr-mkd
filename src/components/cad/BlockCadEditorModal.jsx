import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Undo2, Trash2, Save, AlertTriangle, Move } from 'lucide-react';
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

const toPointString = points => points.map(([x, y]) => `${x},${y}`).join(' ');

const gridStepPx = 24;

const PointHandle = ({ cx, cy, index, onPointerDown }) => (
  <g>
    <circle cx={cx} cy={cy} r={8} fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
    <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fill="#0f172a" className="select-none">
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
  const [error, setError] = useState('');

  const projected = useMemo(() => {
    if (!buildingGeometry) return null;

    const buildingProjected = projectGeometryToLocalMeters(buildingGeometry);
    if (!buildingProjected) return null;

    const narrowAxis = getNarrowAxisAngleDeg(buildingProjected);
    const rotationDeg = -narrowAxis;
    const rotatedBuilding = rotateGeometryInMeters(buildingProjected, rotationDeg);

    const rotatedBlock = blockGeometry
      ? rotateGeometryInMeters(projectGeometryToOriginMeters(blockGeometry, buildingProjected.origin), rotationDeg)
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
    return [
      (x - allBounds.minX) * scale,
      viewport.h - (y - allBounds.minY) * scale,
    ];
  };

  const toWorld = (screenX, screenY) => {
    if (!allBounds) return [0, 0];
    return [
      screenX / scale + allBounds.minX,
      (viewport.h - screenY) / scale + allBounds.minY,
    ];
  };

  const buildingOuterRing = projected?.buildingMeters?.coordinates?.[0]?.[0] || [];
  const blockRingFromState = draftPoints.length
    ? [...draftPoints, draftPoints[0]]
    : projected?.blockMeters?.coordinates?.[0]?.[0] || [];

  const buildingPolyline = toPointString(buildingOuterRing.map(([x, y]) => toScreen(x, y)));

  const blockPolyline = toPointString((blockRingFromState || []).map(([x, y]) => toScreen(x, y)));

  const activePoints = draftPoints.length
    ? draftPoints
    : (projected?.blockMeters?.coordinates?.[0]?.[0] || []).slice(0, -1);

  const beginDraftFromExisting = () => {
    if (draftPoints.length > 0) return;
    const existing = (projected?.blockMeters?.coordinates?.[0]?.[0] || []).slice(0, -1);
    if (existing.length) setDraftPoints(existing);
  };

  const handleCanvasClick = evt => {
    if (isReadOnly || !allBounds) return;
    beginDraftFromExisting();

    const rect = evt.currentTarget.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;

    const [x, y] = toWorld(px, py);
    const snappedX = Math.round(x);
    const snappedY = Math.round(y);

    setDraftPoints(prev => [...prev, [snappedX, snappedY]]);
    setError('');
  };

  const handlePointerMove = evt => {
    if (dragIndex === null || isReadOnly || !allBounds) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const px = clamp(evt.clientX - rect.left, 0, rect.width);
    const py = clamp(evt.clientY - rect.top, 0, rect.height);
    const [x, y] = toWorld(px, py);
    const snappedX = Math.round(x);
    const snappedY = Math.round(y);

    setDraftPoints(prev => {
      const next = [...prev];
      next[dragIndex] = [snappedX, snappedY];
      return next;
    });
  };

  const handleSave = () => {
    const points = draftPoints.length
      ? draftPoints
      : (projected?.blockMeters?.coordinates?.[0]?.[0] || []).slice(0, -1);

    if (points.length < 3 || !projected?.origin) {
      setError('Нужно минимум 3 точки для геометрии блока.');
      return;
    }

    const meterGeometry = {
      type: 'Polygon',
      coordinates: [[...points, points[0]]],
    };

    const unrotatedMeters = rotateGeometryInMeters(meterGeometry, projected.rotationDeg);
    const resultGeo = geometryFromMeterPoints(unrotatedMeters, projected.origin);

    if (!isGeometryWithinGeometry(resultGeo, buildingGeometry)) {
      setError('Геометрия блока должна полностью находиться внутри контура здания.');
      return;
    }

    onSave?.(resultGeo);
    onClose?.();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-950 text-slate-100 flex flex-col">
      <div className="h-16 border-b border-slate-800 px-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">CAD редактор блока</h3>
          <p className="text-xs text-slate-400">Полноэкранный режим, подложка отключена, сетка 1 метр.</p>
        </div>
        <button onClick={onClose} className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 inline-flex items-center gap-2">
          <X size={14} /> Закрыть
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-80 border-r border-slate-800 p-4 space-y-3 overflow-y-auto">
          <div className="text-xs text-slate-400 leading-relaxed">
            Добавляйте точки кликом. Точки привязываются к метровой сетке. Перетаскивайте узлы для корректировки.
          </div>
          <div className="text-xs">
            <div className="text-slate-400">Ориентация здания</div>
            <div className="font-semibold">Повернуто на {Math.round((-projected?.rotationDeg || 0) * 10) / 10}° (узкая сторона горизонтальна)</div>
          </div>

          {!isReadOnly && (
            <>
              <button onClick={() => setDraftPoints(prev => prev.slice(0, -1))} className="w-full h-9 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm inline-flex items-center justify-center gap-2" disabled={draftPoints.length === 0}>
                <Undo2 size={14} /> Отменить точку
              </button>
              <button onClick={() => { setDraftPoints([]); setError(''); }} className="w-full h-9 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm inline-flex items-center justify-center gap-2">
                <Trash2 size={14} /> Очистить чертёж
              </button>
              <button onClick={handleSave} className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold inline-flex items-center justify-center gap-2">
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
            <div className="inline-flex items-center gap-1"><Move size={12} /> drag & drop узлов доступен</div>
          </div>
        </div>

        <div className="flex-1 p-4">
          <svg
            viewBox={`0 0 ${viewport.w} ${viewport.h}`}
            className="w-full h-full bg-slate-900 rounded-xl border border-slate-800"
            onClick={handleCanvasClick}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDragIndex(null)}
          >
            <defs>
              <pattern id="meter-grid" width={gridStepPx} height={gridStepPx} patternUnits="userSpaceOnUse">
                <path d={`M ${gridStepPx} 0 L 0 0 0 ${gridStepPx}`} fill="none" stroke="#1f2937" strokeWidth="1" />
              </pattern>
              <pattern id="meter-grid-10" width={gridStepPx * 10} height={gridStepPx * 10} patternUnits="userSpaceOnUse">
                <rect width={gridStepPx * 10} height={gridStepPx * 10} fill="url(#meter-grid)" />
                <path d={`M ${gridStepPx * 10} 0 L 0 0 0 ${gridStepPx * 10}`} fill="none" stroke="#334155" strokeWidth="1.2" />
              </pattern>
            </defs>

            <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="url(#meter-grid-10)" />

            {buildingPolyline && (
              <polyline points={buildingPolyline} fill="rgba(59, 130, 246, 0.09)" stroke="#60a5fa" strokeWidth="2" />
            )}

            {blockPolyline && (
              <polyline points={blockPolyline} fill="rgba(16, 185, 129, 0.25)" stroke="#34d399" strokeWidth="2.4" />
            )}

            {activePoints.map(([x, y], index) => {
              const [sx, sy] = toScreen(x, y);
              return <PointHandle key={`${index}-${x}-${y}`} cx={sx} cy={sy} index={index} onPointerDown={(_, idx) => { beginDraftFromExisting(); setDragIndex(idx); }} />;
            })}
          </svg>
        </div>
      </div>
    </div>,
    document.body
  );
}
