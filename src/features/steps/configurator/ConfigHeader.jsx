import React from 'react';
import { ArrowLeft, MapPin, Building2, Car, Box, Save, Loader2, Home } from 'lucide-react';
import { getStageColor } from '@lib/utils';
import { FullIdentifierCompact } from '@components/ui/IdentifierBadge';
import { formatFullIdentifier } from '@lib/uj-identifier';
import { useProject } from '@context/ProjectContext';
import { SaveIndicator } from '@components/ui/UIKit';

const PARKING_TYPE_LABELS = {
  capital: 'Капитальный',
  light: 'Легкие констр.',
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
  saveLabel = 'Сохранить',
}) {
  const { complexInfo, hasUnsavedChanges, isReadOnly } = useProject(); 
  const projectUjCode = complexInfo?.ujCode;
  
  // Определяем иконку и цвет
  let TypeIcon = Building2;
  let typeLabel = 'Здание';
  
  if (isParking) {
    TypeIcon = Car;
    typeLabel = isUnderground ? 'Подземный паркинг' : 'Паркинг';
  } else if (isInfrastructure) {
    TypeIcon = Box;
    typeLabel = building.infraType || 'Инфраструктура';
  } else {
    // Для жилых/смешанных
    typeLabel = building.type === 'mixed' ? 'Жилой/Нежилой' : 'Жилой дом';
  }

  // Адрес одной строкой для тултипа или мелкого вывода
  const fullAddress = [building.region, building.district, building.address].filter(Boolean).join(', ');
  const positionClass = isSticky ? 'sticky top-2 z-30' : 'relative';

  const saveButtonClass = hasUnsavedChanges
    ? 'bg-blue-600 text-white hover:bg-blue-500 ring-2 ring-blue-500/30 border-transparent shadow-md'
    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm';

  const isSaving = saveDisabled && (String(saveLabel).toLowerCase().includes('сохраняем') || String(saveLabel).toLowerCase().includes('saving'));
  const shouldRenderSaveButton = showSaveButton && !isReadOnly;

  // Компонент разделителя
  const Divider = () => <div className="w-px h-6 bg-slate-200 mx-2 shrink-0" />;

  return (
    <div
      className={`bg-white/95 backdrop-blur-md rounded-lg border border-slate-200 shadow-sm mb-4 ${positionClass} flex items-center justify-between px-2 h-14 overflow-hidden`}
    >
      <div className="flex items-center gap-1 overflow-hidden flex-1">
        {/* 1. СТРЕЛКА НАЗАД */}
        <button
          onClick={onBack}
          className="flex items-center justify-center h-9 w-9 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          title="Вернуться к списку"
        >
          <ArrowLeft size={20} />
        </button>

        <Divider />

        {/* 2. КОД (UJ) - Желтый, крупный, темный фон */}
        {building.buildingCode && projectUjCode && (
            <>
                <div className="flex items-center px-3 py-1.5 bg-slate-900 rounded-md shadow-sm shrink-0">
                     <span className="text-yellow-400 font-mono font-black text-sm tracking-widest">
                        {formatFullIdentifier(projectUjCode, building.buildingCode)}
                     </span>
                </div>
                <Divider />
            </>
        )}

        {/* 3. ДОМ № (АДРЕС) */}
        <div className="flex flex-col justify-center min-w-[80px] shrink-0">
            <div className="flex items-center gap-1.5">
                <Home size={16} className="text-slate-500" />
                <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                    {building.houseNumber ? `Дом № ${building.houseNumber}` : 'Без номера'}
                </span>
            </div>
            {/* [MODIFIED] Показываем блок с адресом только если адрес есть */}
            {fullAddress && (
                <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={fullAddress}>
                    {fullAddress}
                </div>
            )}
        </div>

        <Divider />

        {/* 4. ВИД (НАЗВАНИЕ + ТИП + СТАТУС) */}
        <div className="flex flex-col justify-center min-w-0 shrink flex-1">
            <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 text-sm truncate" title={building.label}>
                    {building.label}
                </span>
                <span className={`px-1.5 py-px rounded-[4px] text-[9px] font-bold uppercase tracking-wide border shrink-0 ${getStageColor(building.stage)}`}>
                    {building.stage || 'Проект'}
                </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                <TypeIcon size={12} className="shrink-0 opacity-70" />
                <span className="truncate font-medium">{typeLabel}</span>
                {isParking && building.constructionType && (
                    <span className="opacity-60 hidden sm:inline">
                        • {PARKING_TYPE_LABELS[building.constructionType] || building.constructionType}
                    </span>
                )}
            </div>
        </div>
      </div>

      {/* 5. КНОПКА СОХРАНИТЬ (Справа) */}
      {shouldRenderSaveButton && (
        <div className="pl-2 ml-1 border-l border-slate-200 shrink-0">
          <button
            onClick={onSave}
            disabled={saveDisabled}
            className={`relative inline-flex items-center justify-center h-9 px-4 rounded-lg text-xs font-bold transition-all border disabled:opacity-60 disabled:cursor-not-allowed ${saveButtonClass}`}
            title={hasUnsavedChanges ? "Есть несохраненные изменения" : "Сохранить"}
          >
            <SaveIndicator hasChanges={hasUnsavedChanges} />
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={15} className="mr-2" />
            )}
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}