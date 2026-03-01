import React, { useMemo, useState } from 'react';
import { Settings2, MapPin, AlertCircle, Building, PenLine, Check, Undo2, Trash2 } from 'lucide-react';
import { Card, SectionTitle, Label, Input, useReadOnly } from '@components/ui/UIKit';
import { GeometryPickerMap, BASEMAP_OPTIONS } from '@components/maps/GeometryPickerMap';
import { isGeometryWithinGeometry } from '@lib/geometry-utils';

const draftToPolygon = points => {
  if (!Array.isArray(points) || points.length < 3) return null;
  return {
    type: 'Polygon',
    coordinates: [[...points, points[0]]],
  };
};

export default function GeneralBlockCard({
  details,
  updateDetail,
  building,
  currentBlock,
  hasElevatorIssue,
  _errorBorder,
}) {
  const isReadOnly = useReadOnly();
  const isResidential = currentBlock?.type === 'Ж';
  const canEditBlockAddress = String(building?.category || '').includes('residential');

  const [isDrawingGeometry, setIsDrawingGeometry] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [basemap, setBasemap] = useState('osm');
  const [geometryError, setGeometryError] = useState('');

  const isInfra = building?.category === 'infrastructure' || currentBlock?.originalType === 'infrastructure';
  const isParking = building?.category === 'parking_separate' || currentBlock?.originalType === 'parking';
  const entrancesField = (isInfra || isParking) ? 'inputs' : 'entrances';

  const increment = (field, max = 100) => {
    const val = parseInt(details[field]) || 0;
    updateDetail(field, Math.min(max, val + 1));
  };
  const decrement = (field, min = 1) => {
    const val = parseInt(details[field]) || 0;
    updateDetail(field, Math.max(min, val - 1));
  };
  const renderCounterValue = val =>
    val === '' || val === undefined ? <span className="text-red-300">?</span> : val;

  const fullHouseAddress = [
    building.region,
    building.district,
    building.address,
    building.houseNumber ? `Дом № ${building.houseNumber}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const buildingGeometry = building?.geometry || null;
  const blockGeometry = details?.blockGeometry || null;
  const blockGeometryCandidates = useMemo(() => {
    if (!blockGeometry) return [];
    return [{ id: 'block-geometry', geometry: blockGeometry }];
  }, [blockGeometry]);

  const saveDraftGeometry = () => {
    const geometry = draftToPolygon(draftPoints);
    if (!geometry) {
      setGeometryError('Для геометрии блока нужно минимум 3 точки.');
      return;
    }
    if (!buildingGeometry) {
      setGeometryError('У здания отсутствует геометрия. Сначала задайте контур здания.');
      return;
    }
    if (!isGeometryWithinGeometry(geometry, buildingGeometry)) {
      setGeometryError('Геометрия блока должна полностью находиться внутри границ здания.');
      return;
    }

    updateDetail('blockGeometry', geometry);
    setGeometryError('');
    setIsDrawingGeometry(false);
    setDraftPoints([]);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6 shadow-sm">
        <SectionTitle icon={Settings2}>Общие</SectionTitle>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{isResidential ? 'Подъездов' : 'Входов'} (макс. 30)</Label>
            <div className="flex items-center gap-3">
              <button disabled={isReadOnly} onClick={() => decrement(entrancesField, 1)} className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50">-</button>
              <span className="font-bold text-lg w-8 text-center">{renderCounterValue(details[entrancesField])}</span>
              <button disabled={isReadOnly} onClick={() => increment(entrancesField, 30)} className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50">+</button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Лифтов</Label>
            <div className="flex items-center gap-3">
              <button disabled={isReadOnly} onClick={() => decrement('elevators', 0)} className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50">-</button>
              <span className="font-bold text-lg w-8 text-center">{renderCounterValue(details.elevators)}</span>
              <button disabled={isReadOnly} onClick={() => increment('elevators')} className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50">+</button>
            </div>
            {hasElevatorIssue && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-red-500 font-bold animate-in fade-in">
                <AlertCircle size={10} />
                <span>Лифт обязателен &gt; 5 этажей</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {canEditBlockAddress && (
        <Card className="p-6 shadow-sm flex flex-col">
          <SectionTitle icon={MapPin}>Адрес</SectionTitle>
          <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Building size={10} />
              <span className="font-bold uppercase tracking-wider">Адрес дома</span>
            </div>
            <div className="text-slate-700 font-medium">{fullHouseAddress}</div>
          </div>

          <div className="space-y-4 mt-auto">
            <label className={`flex items-start gap-3 group ${isReadOnly ? 'opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={details.hasCustomAddress || false}
                onChange={e => updateDetail('hasCustomAddress', e.target.checked)}
                disabled={isReadOnly}
                className="mt-1 rounded text-blue-600 w-4 h-4 disabled:cursor-not-allowed"
              />
              <div>
                <span className="text-sm font-bold text-slate-700">Указать отдельный адрес блока</span>
                <p className="text-[10px] text-slate-400">Используйте, если блок имеет отдельный номер дома/корпуса</p>
              </div>
            </label>

            {details.hasCustomAddress && (
              <div className="animate-in slide-in-from-top-2 fade-in duration-300 flex items-start gap-2">
                <Input
                  value={details.customHouseNumber || ''}
                  onChange={e => updateDetail('customHouseNumber', e.target.value)}
                  placeholder="Например: 15А"
                  disabled={isReadOnly}
                  className={`font-bold uppercase ${_errorBorder('customHouseNumber')}`}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6 shadow-sm md:col-span-2">
        <SectionTitle icon={MapPin}>Геометрия блока <span className="text-red-500">*</span></SectionTitle>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select value={basemap} onChange={e => setBasemap(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700">
            {BASEMAP_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button disabled={isReadOnly} onClick={() => { setIsDrawingGeometry(v => !v); setGeometryError(''); }} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            <PenLine size={14} /> {isDrawingGeometry ? 'Режим рисования: вкл' : 'Рисовать полигон'}
          </button>
          <button disabled={isReadOnly || draftPoints.length === 0} onClick={() => setDraftPoints(prev => prev.slice(0, -1))} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Undo2 size={14} /> Отменить точку</button>
          <button disabled={isReadOnly || draftPoints.length === 0} onClick={() => setDraftPoints([])} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Trash2 size={14} /> Очистить</button>
          <button disabled={isReadOnly || draftPoints.length < 3} onClick={saveDraftGeometry} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Check size={14} /> Сохранить геометрию</button>
        </div>

        <GeometryPickerMap
          candidates={blockGeometryCandidates}
          selectedId={blockGeometry ? 'block-geometry' : null}
          savedGeometry={buildingGeometry}
          fitToSavedOnOpen
          fitScopeKey={building?.id}
          basemap={basemap}
          isDrawing={isDrawingGeometry}
          draftPoints={draftPoints}
          onDraftPointAdd={point => setDraftPoints(prev => [...prev, point])}
          height={320}
        />

        {!buildingGeometry && <p className="mt-2 text-xs text-amber-600">У здания отсутствует контур. Сначала задайте геометрию здания.</p>}
        {geometryError && <p className="mt-2 text-xs text-red-600">{geometryError}</p>}
        {!details.blockGeometry && <p className="mt-2 text-xs text-red-600">Геометрия блока обязательна для сохранения.</p>}
      </Card>
    </div>
  );
}
