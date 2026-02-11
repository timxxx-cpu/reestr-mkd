import React from 'react';
import { ArrowLeft, MapPin, Building2, Hash, Layers, Car, Box, Save } from 'lucide-react';
import { getStageColor } from '@lib/utils';
import { FullIdentifierCompact } from '@components/ui/IdentifierBadge';
import { formatFullIdentifier } from '@lib/uj-identifier';
import { useProject } from '@context/ProjectContext';

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
  isSticky = true, // [NEW] Возможность отключить sticky-позиционирование
  showSaveButton = false,
  onSave = null,
  saveDisabled = false,
  saveLabel = 'Сохранить здание',
}) {
  const { complexInfo } = useProject();
  const projectUjCode = complexInfo?.ujCode;
  // Определяем иконку и ЦВЕТ типа
  let TypeIcon = Building2;
  let accentColor = 'border-blue-500'; // Дефолт (Жилье)
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

  // [NEW] Класс позиционирования
  const positionClass = isSticky ? 'sticky top-2 z-30' : 'relative';

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

        {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ: Инфо */}
        <div className="flex-1 p-4 flex flex-col gap-2">
          {/* Верхняя строка: Название + Статус + ID */}
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

            {/* ID справа */}
            <div className="flex items-center gap-1.5 text-slate-400 select-all font-mono text-[10px] bg-white px-2 py-1 rounded border border-slate-100">
              <Hash size={10} />
              <span>{building.id.split('-')[0]}...</span>
            </div>
          </div>

          {/* Нижняя строка: Мета-данные */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Адрес */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded text-xs text-slate-500 font-medium border border-slate-200 shadow-sm">
              <MapPin size={12} className="text-slate-400" />
              <span className="max-w-[200px] truncate" title={fullAddress}>
                {fullAddress}
              </span>
            </div>

            {/* 2. Номер дома */}
            {building.houseNumber && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded text-xs text-slate-700 font-bold border border-slate-200 shadow-sm">
                <span className="text-[10px] text-slate-400 uppercase font-normal">Дом</span>
                <span>№ {building.houseNumber}</span>
              </div>
            )}

            {/* 3. Тип объекта */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded text-xs text-slate-600 font-medium border border-slate-200 shadow-sm">
              <Layers size={12} className="opacity-50" />
              <span>{building.type}</span>
            </div>

            {/* 4. Специфика */}
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

        {showSaveButton && (
          <div className="p-4 border-l border-slate-200 flex items-center justify-center">
            <button
              onClick={onSave}
              disabled={saveDisabled}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              title="Сохранить статус заполнения по зданию"
            >
              <Save size={14} />
              {saveLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
