import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Link2, MapPin, MonitorUp, Map as MapIcon, X, Loader2, Save, Trash2 } from 'lucide-react';
import { Card, SectionTitle, Label } from '@components/ui/UIKit';
import BlockCadEditorModal from '@components/cad/BlockCadEditorModal';
import { useProject } from '@context/ProjectContext';
import { ApiService } from '@lib/api-service';
import { BASEMAP_OPTIONS } from '@components/maps/map-basemaps';

const GeometryPickerMap = React.lazy(() => import('@components/maps/GeometryPickerMap'));

const GeometryPickerMapFallback = () => (
  <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-100">
    <Loader2 className="animate-spin text-slate-400" size={24} />
  </div>
);

// Внутренний компонент полноэкранной карты для выбора контура подвала
const BasementMapPickerModal = ({ isOpen, onClose, onSave, buildingGeometry }) => {
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
        .then(data => setCandidates(Array.isArray(data) ? data : []))
        .catch(err => console.error('Ошибка загрузки контуров:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, projectId]);

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
      setSaveError(e?.message || 'Не удалось сохранить геометрию подвала.');
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
            <h3 className="text-lg font-bold text-slate-800 leading-tight">Выбор геометрии подвала</h3>
            <p className="text-xs text-slate-500 font-medium">Привязка контура из генплана (SHP)</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 text-slate-500 shadow-sm bg-white">
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
              <div className="p-6 text-center text-xs text-slate-400">Нет доступных контуров.</div>
            )}
            {candidates.map(candidate => {
              const isActive = candidate.id === activeCandidateId;
              const isSelected = candidate.id === selectedCandidateId;
              return (
                <button
                  key={candidate.id}
                  onClick={() => setActiveCandidateId(candidate.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all border outline-none ${
                    isActive ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-sm ring-1 ring-blue-500/20' : 
                    isSelected ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 
                    'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold truncate">{candidate.label || `Контур #${candidate.sourceIndex}`}</div>
                  {(isSelected || isActive) && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {isSelected && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold uppercase rounded">Прикреплен</span>}
                      {isActive && !isSelected && <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold uppercase rounded">Выбран</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ: КАРТА */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
          <div className="p-3 border-b border-slate-100 bg-slate-50/80 flex flex-wrap gap-2 items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {selectedCandidateId && (
                <button onClick={() => setSelectedCandidateId(null)} className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-white border border-red-100 text-red-600 hover:bg-red-50 text-xs shadow-sm font-medium">
                  <Trash2 size={14} /> Открепить
                </button>
              )}
            </div>
            <select value={basemap} onChange={e => setBasemap(e.target.value)} className="bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-600 shadow-sm outline-none focus:border-blue-500">
              {BASEMAP_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {activeCandidateId && activeCandidateId !== selectedCandidateId && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center justify-between gap-3 p-2 px-3 bg-blue-600 rounded-lg shadow-lg text-white animate-in slide-in-from-top-4">
              <div className="text-xs font-medium">Контур выбран</div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setSelectedCandidateId(activeCandidateId); setActiveCandidateId(null); }} className="bg-white text-blue-700 hover:bg-blue-50 h-7 px-3 rounded text-[11px] font-bold shadow-sm">Прикрепить</button>
                <button onClick={() => setActiveCandidateId(null)} className="h-7 w-7 flex items-center justify-center rounded border border-blue-400 hover:bg-blue-700 hover:border-blue-500"><X size={14} /></button>
              </div>
            </div>
          )}

          <div className="flex-1 bg-slate-100 relative">
            <React.Suspense fallback={<GeometryPickerMapFallback />}>
              <GeometryPickerMap
                candidates={candidates}
                selectedId={selectedCandidateId}
                activeId={activeCandidateId}
                savedGeometry={buildingGeometry}
                fitToSavedOnOpen
                fitScopeKey={`basement-map-${isOpen}`}
                onSelect={setActiveCandidateId}
                basemap={basemap}
                height="100%"
                onDraftPointAdd={() => {}}
              />
            </React.Suspense>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {saveError && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</div>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={isSaving} className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm disabled:opacity-60">Отмена</button>
          <button onClick={handleSave} disabled={!selectedCandidateId || isSaving} className={`h-9 px-6 rounded-lg font-medium text-sm text-white flex items-center gap-2 shadow-md ${!selectedCandidateId || isSaving ? 'opacity-50 cursor-not-allowed bg-slate-400' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default function BasementParamsCard({
  basement,
  updateBasementField,
  isMultiblockResidential,
  blocks,
  toggleBlockLink,
  isReadOnly,
  buildingGeometry,
  saveProjectImmediate
}) {
  const depth = Math.min(4, Math.max(1, parseInt(basement.depth, 10) || 1));
  const entrancesCount = Math.min(10, Math.max(1, parseInt(basement.entrancesCount, 10) || 1));
  const linkedBlocks = Array.isArray(basement.blocks) ? basement.blocks : [];

  const blockGeometry = basement?.blockGeometry || null;
  const [isCadEditorOpen, setIsCadEditorOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  const saveBlockGeometryImmediately = async geometry => {
    updateBasementField(basement.id, { blockGeometry: geometry });
    await new Promise(resolve => setTimeout(resolve, 0));
    if (saveProjectImmediate) {
      await saveProjectImmediate({ shouldRefetch: false });
    }
  };

  return (
    <Card className="p-6 shadow-md border-t-4 border-t-blue-500">
      <SectionTitle icon={Archive}>Основные параметры</SectionTitle>
      
      <div className="space-y-6 mt-4">
        {/* Глубина */}
        <div className="space-y-2">
          <Label>Глубина (уровней вниз)</Label>
          <div className="flex items-center gap-3">
            <button
              disabled={isReadOnly}
              onClick={() => updateBasementField(basement.id, { depth: Math.max(1, depth - 1) })}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
            >
              -
            </button>
            <span className="font-bold text-2xl w-10 text-center text-slate-700">{depth}</span>
            <button
              disabled={isReadOnly}
              onClick={() => updateBasementField(basement.id, { depth: Math.min(4, depth + 1) })}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full" />

        {/* Входы */}
        <div className="space-y-2">
          <Label>Количество входов в подвал (макс. 10)</Label>
          <div className="flex items-center gap-3">
            <button
              disabled={isReadOnly}
              onClick={() => updateBasementField(basement.id, { entrancesCount: Math.max(1, entrancesCount - 1) })}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
            >
              -
            </button>
            <span className="font-bold text-2xl w-10 text-center text-slate-700">{entrancesCount}</span>
            <button
              disabled={isReadOnly}
              onClick={() => updateBasementField(basement.id, { entrancesCount: Math.min(10, entrancesCount + 1) })}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Обслуживаемые блоки */}
        {isMultiblockResidential && (
          <>
            <div className="h-px bg-slate-100 w-full" />
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
              <Label className="text-blue-900 flex items-center gap-2 mb-3">
                <Link2 size={16} className="text-blue-500" /> Обслуживаемые блоки (обязательно)
              </Label>
              <div className="flex flex-wrap gap-2">
                {/* ФИЛЬТРУЕМ БЛОКИ С ТИПОМ 'ПД' (Подвал) */}
                {blocks.filter(block => block.type !== 'ПД').map(block => {
                  const active = linkedBlocks.includes(block.id);
                  return (
                    <button
                      key={block.id}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleBlockLink(basement.id, block.id)}
                      className={`
                        px-3 py-2 rounded-lg text-xs font-bold transition-all border 
                        ${active 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                          : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
                        } 
                        ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {block.tabLabel || block.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="h-px bg-slate-100 w-full" />

        {/* БЛОК ГЕОМЕТРИИ */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <MapPin size={16} className="text-blue-500" />
            Геометрия подвала <span className="text-red-500">*</span>
          </Label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-4">
            <p className="text-xs text-slate-600">
              Задайте контур подвала: выберите его из загруженного генплана (SHP) или нарисуйте вручную
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
            {!blockGeometry && buildingGeometry && (
              <p className="text-xs text-red-600 font-medium animate-pulse">
                Геометрия подвала обязательна для сохранения.
              </p>
            )}
            {blockGeometry && (
              <p className="text-xs text-emerald-600 font-medium">
                ✓ Геометрия подвала успешно привязана.
              </p>
            )}
          </div>
        </div>

        <BlockCadEditorModal
          isOpen={isCadEditorOpen}
          onClose={() => setIsCadEditorOpen(false)}
          buildingGeometry={buildingGeometry}
          blockGeometry={blockGeometry}
          onSave={saveBlockGeometryImmediately}
          isReadOnly={isReadOnly}
        />

        <BasementMapPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          onSave={saveBlockGeometryImmediately}
          buildingGeometry={buildingGeometry}
        />

      </div>
    </Card>
  );
}
