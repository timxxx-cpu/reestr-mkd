import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings2,
  MapPin,
  AlertCircle,
  Building,
  MonitorUp,
  Map as MapIcon,
  X,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react';
import { Card, SectionTitle, Label, Input, useReadOnly } from '@components/ui/UIKit';
import BlockCadEditorModal from '@components/cad/BlockCadEditorModal';
import { useProject } from '@context/ProjectContext';
import { ApiService } from '@lib/api-service';
import { GeometryPickerMap, BASEMAP_OPTIONS } from '@components/maps/GeometryPickerMap';

// Внутренний компонент полноэкранной карты для выбора контура блока
const BlockMapPickerModal = ({ isOpen, onClose, onSave, buildingGeometry }) => {
  const { projectId } = useProject();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeCandidateId, setActiveCandidateId] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [basemap, setBasemap] = useState('osm');

  useEffect(() => {
    if (isOpen && projectId) {
      setLoading(true);
      setSaveError('');
      ApiService.getProjectGeometryCandidates(projectId)
        .then(data => {
          setCandidates(Array.isArray(data) ? data : []);
        })
        .catch(err => console.error('Ошибка загрузки контуров:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, projectId]);

  // Сброс стейта при закрытии
  useEffect(() => {
    if (!isOpen) {
      setActiveCandidateId(null);
      setSelectedCandidateId(null);
      setSaveError('');
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    const candidate = candidates.find(c => c.id === selectedCandidateId);
    if (!candidate?.geometry) return;

    if (!buildingGeometry) {
      setSaveError('У здания отсутствует контур. Сначала задайте геометрию здания.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError('');
      await onSave(candidate.geometry);
      onClose();
    } catch (e) {
      setSaveError(e?.message || 'Не удалось сохранить геометрию блока.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col animate-in zoom-in-95 duration-200">
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <MapIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight">Выбор геометрии блока</h3>
            <p className="text-xs text-slate-500 font-medium">Привязка контура из генплана (SHP)</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 text-slate-500 shadow-sm bg-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* ЛЕВАЯ ПАНЕЛЬ: СПИСОК КОНТУРОВ */}
        <div className="w-72 shrink-0 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-100/50 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Объекты генплана</span>
            {loading ? (
              <Loader2 size={14} className="animate-spin text-slate-400" />
            ) : (
              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-600">
                {candidates.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar bg-slate-50/30">
            {candidates.length === 0 && !loading && (
              <div className="p-6 text-center text-xs text-slate-400">
                Нет доступных контуров. Загрузите генплан в паспорте объекта.
              </div>
            )}
            {candidates.map(candidate => {
              const isActive = candidate.id === activeCandidateId;
              const isSelected = candidate.id === selectedCandidateId;
              return (
                <button
                  key={candidate.id}
                  onClick={() => setActiveCandidateId(candidate.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all border outline-none ${
                    isActive
                      ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-sm ring-1 ring-blue-500/20'
                      : isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold truncate">
                    {candidate.label || `Контур #${candidate.sourceIndex}`}
                  </div>
                  {(isSelected || isActive) && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {isSelected && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold uppercase rounded">
                          Прикреплен
                        </span>
                      )}
                      {isActive && !isSelected && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold uppercase rounded">
                          Выбран
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ: КАРТА */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
          {/* Map Controls */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/80 flex flex-wrap gap-2 items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {selectedCandidateId && (
                <button
                  onClick={() => setSelectedCandidateId(null)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-white border border-red-100 text-red-600 hover:bg-red-50 text-xs shadow-sm font-medium"
                >
                  <Trash2 size={14} /> Открепить
                </button>
              )}
              {!selectedCandidateId && !activeCandidateId && (
                <span className="text-[11px] text-slate-500 font-medium px-1">
                  Выберите полигон из списка или на карте
                </span>
              )}
            </div>
            <select
              value={basemap}
              onChange={e => setBasemap(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-600 shadow-sm outline-none focus:border-blue-500"
            >
              {BASEMAP_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Banner */}
          {activeCandidateId && activeCandidateId !== selectedCandidateId && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center justify-between gap-3 p-2 px-3 bg-blue-600 rounded-lg shadow-lg text-white animate-in slide-in-from-top-4">
              <div className="text-xs font-medium">Контур выбран</div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setSelectedCandidateId(activeCandidateId);
                    setActiveCandidateId(null);
                  }}
                  className="bg-white text-blue-700 hover:bg-blue-50 h-7 px-3 rounded text-[11px] font-bold shadow-sm"
                >
                  Прикрепить
                </button>
                <button
                  onClick={() => setActiveCandidateId(null)}
                  className="h-7 w-7 flex items-center justify-center rounded border border-blue-400 hover:bg-blue-700 hover:border-blue-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* MAP */}
          <div className="flex-1 bg-slate-100 relative">
            <GeometryPickerMap
              candidates={candidates}
              selectedId={selectedCandidateId}
              activeId={activeCandidateId}
              savedGeometry={buildingGeometry} // Показываем контур здания для контекста
              fitToSavedOnOpen
              fitScopeKey={`block-map-${isOpen}`}
              onSelect={setActiveCandidateId}
              basemap={basemap}
              height="100%"
              onDraftPointAdd={() => {}}
            />
          </div>

          <div className="p-2 bg-white border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-center gap-4 shrink-0">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-emerald-500/80"></span> Выбрано для блока
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-blue-500/80"></span> Активный контур
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-amber-500/80"></span> Занято другим
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-emerald-700/80"></span> Контур здания (родитель)
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {saveError && (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedCandidateId || isSaving}
            className={`h-9 px-6 rounded-lg font-medium text-sm text-white flex items-center gap-2 shadow-md ${
              !selectedCandidateId || isSaving
                ? 'opacity-50 cursor-not-allowed bg-slate-400'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default function GeneralBlockCard({
  details,
  updateDetail,
  onMapGeometrySave,
  building,
  currentBlock,
  hasElevatorIssue,
  _errorBorder,
}) {
  const { saveProjectImmediate } = useProject();
  const isReadOnly = useReadOnly();
  const isResidential = currentBlock?.type === 'Ж';
  const canEditBlockAddress = String(building?.category || '').includes('residential');

  const [isCadEditorOpen, setIsCadEditorOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  const isInfra =
    building?.category === 'infrastructure' || currentBlock?.originalType === 'infrastructure';
  const isParking =
    building?.category === 'parking_separate' || currentBlock?.originalType === 'parking';
  const entrancesField = isInfra || isParking ? 'inputs' : 'entrances';

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

  const saveBlockGeometryImmediately = async geometry => {
   if (onMapGeometrySave) {
      await onMapGeometrySave(geometry);
    } else {
      updateDetail('blockGeometry', geometry);
      await new Promise(resolve => setTimeout(resolve, 0));
      await saveProjectImmediate({ shouldRefetch: false });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6 shadow-sm">
        <SectionTitle icon={Settings2}>Общие</SectionTitle>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{isResidential ? 'Подъездов' : 'Входов'} (макс. 30)</Label>
            <div className="flex items-center gap-3">
              <button
                disabled={isReadOnly}
                onClick={() => decrement(entrancesField, 1)}
                className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                -
              </button>
              <span className="font-bold text-lg w-8 text-center">
                {renderCounterValue(details[entrancesField])}
              </span>
              <button
                disabled={isReadOnly}
                onClick={() => increment(entrancesField, 30)}
                className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Лифтов</Label>
            <div className="flex items-center gap-3">
              <button
                disabled={isReadOnly}
                onClick={() => decrement('elevators', 0)}
                className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                -
              </button>
              <span className="font-bold text-lg w-8 text-center">
                {renderCounterValue(details.elevators)}
              </span>
              <button
                disabled={isReadOnly}
                onClick={() => increment('elevators')}
                className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                +
              </button>
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
            <label
              htmlFor="custom-address-checkbox"
              className={`flex items-start gap-3 group ${isReadOnly ? 'opacity-50' : 'cursor-pointer'}`}
            >
              <input
                id="custom-address-checkbox"
                type="checkbox"
                checked={details.hasCustomAddress || false}
                onChange={e => updateDetail('hasCustomAddress', e.target.checked)}
                disabled={isReadOnly}
                className="mt-1 rounded text-blue-600 w-4 h-4 disabled:cursor-not-allowed"
              />
              <div>
                <span className="text-sm font-bold text-slate-700">Указать отдельный адрес блока</span>
                <p className="text-[10px] text-slate-400">
                  Используйте, если блок имеет отдельный номер дома/корпуса
                </p>
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
        <SectionTitle icon={MapPin}>
          Геометрия блока <span className="text-red-500">*</span>
        </SectionTitle>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-4">
          <p className="text-xs text-slate-600">
            Задайте контур блока: выберите его из загруженного генплана (SHP) или нарисуйте вручную
            во встроенном CAD редакторе с метровой сеткой.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isReadOnly || !buildingGeometry}
              onClick={() => setIsMapPickerOpen(true)}
              className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm transition-colors"
            >
              <MapIcon size={16} /> Выбрать на карте (SHP)
            </button>
            <button
              type="button"
              disabled={isReadOnly || !buildingGeometry}
              onClick={() => setIsCadEditorOpen(true)}
              className="h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm transition-colors"
            >
              <MonitorUp size={16} /> Открыть CAD редактор
            </button>
          </div>

          {!buildingGeometry && (
            <p className="text-xs text-amber-600 font-medium">
              У здания отсутствует контур. Сначала задайте геометрию здания.
            </p>
          )}
          {!details.blockGeometry && buildingGeometry && (
            <p className="text-xs text-red-600 font-medium animate-pulse">
              Геометрия блока обязательна для сохранения.
            </p>
          )}
          {details.blockGeometry && (
            <p className="text-xs text-emerald-600 font-medium">
              ✓ Геометрия блока успешно привязана.
            </p>
          )}
        </div>

        <BlockCadEditorModal
          isOpen={isCadEditorOpen}
          onClose={() => setIsCadEditorOpen(false)}
          buildingGeometry={buildingGeometry}
          blockGeometry={blockGeometry}
          onSave={geometry => updateDetail('blockGeometry', geometry)}
          isReadOnly={isReadOnly}
        />

        <BlockMapPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          onSave={saveBlockGeometryImmediately}
          buildingGeometry={buildingGeometry}
        />
      </Card>
    </div>
  );
}