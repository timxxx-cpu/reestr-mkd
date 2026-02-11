import React from 'react';
import { ArrowLeft, MapPin, Building2, Hash, Layers, Car, Box, Save, Loader2 } from 'lucide-react'; // Добавил Loader2 для спиннера
import { getStageColor } from '@lib/utils';
import { FullIdentifierCompact } from '@components/ui/IdentifierBadge';
import { formatFullIdentifier } from '@lib/uj-identifier';
import { useProject } from '@context/ProjectContext';
import { SaveIndicator } from '@components/ui/UIKit'; // [NEW] Импорт индикатора

const PARKING_TYPE_LABELS = {
  capital: 'Капитальный',
  light: 'Легкие конструкции',
  open: 'Открытый',
};

export default function ConfigHeader({
  building,
  isParking,
  isInfrastructure,
  isUnderground,
  onBack,
  isSticky = true,
  showSaveButton = false,
  onSave = null,
  saveDisabled = false,
  saveLabel = 'Сохранить здание',
}) {
  // [UPDATED] Получаем hasUnsavedChanges из контекста
  const { complexInfo, hasUnsavedChanges } = useProject(); 
  const projectUjCode = complexInfo?.ujCode;
  
  // Определяем иконку и ЦВЕТ типа
  let TypeIcon = Building2;
  let accentColor = 'border-blue-500';
  let iconBg = 'bg-blue-100 text-blue-600';

  if (isParking) {
    TypeIcon = Car;
    accentColor = 'border-amber-500';
    iconBg = 'bg-amber-100 text-amber-600';
  } else if (isInfrastructure) {
    TypeIcon = Box;
    accentColor = 'border-emerald-500';
    iconBg = 'bg-emerald-100 text-emerald-600';
  }

  // Формируем полный адрес
  const fullAddress = [building.region, building.district, building.address]
    .filter(Boolean)
    .join(', ');

  const positionClass = isSticky ? 'sticky top-2 z-30' : 'relative';

  // [NEW] Логика стилей кнопки сохранения
  // Если есть изменения: яркая синяя кнопка
  // Если нет изменений: спокойная белая/серая кнопка (но все еще доступная для нажатия)
  const saveButtonClass = hasUnsavedChanges
    ? 'bg-blue-600 text-white hover:bg-blue-500 ring-2 ring-blue-500/30 border-transparent shadow-md'
    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm';

  return (
    <div
      className={`bg-slate-50/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm mb-6 ${positionClass} ${accentColor} border-t-4`}
    >
      <div className="flex flex-col md:flex-row items-stretch">
        {/* ЛЕВАЯ ЧАСТЬ: Кнопка Назад */}
        <button
          onClick={onBack}
          className="flex items-center justify-center w-14 border-r border-slate-200 hover:bg-white transition-colors text-slate-400 hover:text-slate-700 rounded-bl-xl"
          title="Вернуться к списку"
        >
          <ArrowLeft size={20} />
        </button>

        {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ: Инфо (без изменений) */}
        <div className="flex-1 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <TypeIcon size={18} />
              </div>
              <h1 className="text-xl font-bold text-slate-800 leading-none">{building.label}</h1>
              {building.buildingCode && projectUjCode && (
                <FullIdentifierCompact 
                  fullCode={formatFullIdentifier(projectUjCode, building.buildingCode)}
                  variant="default"
                />
              )}
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStageColor(building.stage)}`}
              >
                {building.stage || 'Проектный'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400 select-all font-mono text-[10px] bg-white px-2 py-1 rounded border border-slate-100">
              <Hash size={10} />
              <span>{building.id.split('-')[0]}...</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded text-xs text-slate-500 font-medium border border-slate-200 shadow-sm">
              <MapPin size={12} className="text-slate-400" />
              <span className="max-w-[200px] truncate" title={fullAddress}>
                {fullAddress}
              </span>
            </div>

            {building.houseNumber && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded text-xs text-slate-700 font-bold border border-slate-200 shadow-sm">
                <span className="text-[10px] text-slate-400 uppercase font-normal">Дом</span>
                <span>№ {building.houseNumber}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded text-xs text-slate-600 font-medium border border-slate-200 shadow-sm">
              <Layers size={12} className="opacity-50" />
              <span>{building.type}</span>
            </div>

            {isParking && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded text-xs text-amber-700 font-medium border border-amber-100">
                <span>{isUnderground ? 'Подземный' : 'Наземный'}</span>
                {building.constructionType && (
                  <span className="opacity-50">
                    • {PARKING_TYPE_LABELS[building.constructionType] || building.constructionType}
                  </span>
                )}
              </div>
            )}
            {isInfrastructure && building.infraType && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded text-xs text-emerald-700 font-medium border border-emerald-100">
                <span>{building.infraType}</span>
              </div>
            )}
          </div>
        </div>

        {/* ПРАВАЯ ЧАСТЬ: Кнопка Сохранить */}
        {showSaveButton && (
          <div className="p-4 border-l border-slate-200 flex items-center justify-center">
            <button
              onClick={onSave}
              disabled={saveDisabled}
              className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border disabled:opacity-60 disabled:cursor-not-allowed ${saveButtonClass}`}
              title={hasUnsavedChanges ? "Есть несохраненные изменения" : "Сохранить"}
            >
              {/* Индикатор мигает, если есть изменения */}
              <SaveIndicator hasChanges={hasUnsavedChanges} />
              
              {/* Показываем спиннер, если сохранение идет, иначе иконку дискеты */}
              {saveDisabled ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saveLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}