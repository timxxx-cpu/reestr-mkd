import React, { useState, useMemo } from 'react';
import {
  Home,
  Car,
  Box,
  Pencil,
  Trash2,
  X,
  Sparkles,
  Building2,
  Clock,
  ArrowRight,
  Layers,
  AlertCircle,
  Eye,
  Loader2,
  Hash,
  LayoutGrid, // Иконка сетки
  List as ListIcon, // Иконка списка
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { Button, Input, Select, Label, SectionTitle, useReadOnly, useEscapeKey } from '@components/ui/UIKit';
import { FullIdentifierCompact } from '@components/ui/IdentifierBadge';
import { formatFullIdentifier } from '@lib/uj-identifier';
import { getStageColor } from '@lib/utils';
import { BuildingModalSchema } from '@lib/schemas';
import { useValidation } from '@hooks/useValidation';
import { useCatalog } from '@hooks/useCatalogs';

const TYPE_NAMES = {
  residential: 'Обычный многоквартирный дом',
  residential_multiblock: 'Многоквартирный дом со встроенными нежилыми частями',
  parking_separate: 'Отдельный паркинг',
  infrastructure: 'Объект инфраструктуры',
};

const PARKING_CONSTRUCTION_NAMES = {
  capital: 'Капитальный',
  light: 'Из легких конструкций',
  open: 'Открытый',
};

const PARKING_CONSTRUCTION_FALLBACK = [
  { code: 'capital', label: 'Капитальный' },
  { code: 'light', label: 'Из легких конструкций' },
  { code: 'open', label: 'Открытый' },
];

// Хелпер генерации блоков для payload
const generateBlocksPayload = params => {
  const blocks = [];
  const { category, resBlocks, nonResBlocks, infraType, parkingType } = params;

  if (category.includes('residential')) {
    const rCount = parseInt(resBlocks) || 0;
    const nCount = category === 'residential_multiblock' ? parseInt(nonResBlocks) || 0 : 0;

    for (let i = 0; i < rCount; i++) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'residential',
        label: rCount > 1 ? `Жилая секция ${i + 1}` : 'Жилой дом',
        index: i,
      });
    }
    for (let i = 0; i < nCount; i++) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'non_residential',
        label: `Нежилая секция ${i + 1}`,
        index: rCount + i,
      });
    }
  } else if (category === 'parking_separate') {
    blocks.push({
      id: crypto.randomUUID(),
      type: 'parking',
      label: parkingType === 'underground' ? 'Подземный паркинг' : 'Наземный паркинг',
      index: 0,
    });
  } else if (category === 'infrastructure') {
    blocks.push({
      id: crypto.randomUUID(),
      type: 'infrastructure',
      label: infraType || 'Объект инфраструктуры',
      index: 0,
    });
  }

  return blocks;
};
// Настройка стилей карточки в зависимости от типа
const CARD_THEMES = {
  residential: {
    bg: 'bg-white', // Жилье оставляем чистым или очень легким
    border: 'border-slate-200',
    header: 'bg-slate-50/50',
    iconWrapper: 'bg-white border-slate-200 text-blue-600',
    accent: 'group-hover:border-blue-300',
  },
  residential_multiblock: {
    bg: 'bg-indigo-50/30', // Легкий индиго для сложных домов
    border: 'border-indigo-100',
    header: 'bg-indigo-50/40',
    iconWrapper: 'bg-white border-indigo-200 text-indigo-600',
    accent: 'group-hover:border-indigo-300',
  },
  parking_separate: {
    bg: 'bg-slate-50', // Серый фон для тех. сооружений/паркинга
    border: 'border-slate-200',
    header: 'bg-slate-100/50',
    iconWrapper: 'bg-white border-slate-200 text-slate-600',
    accent: 'group-hover:border-slate-300',
  },
  infrastructure: {
    bg: 'bg-amber-50/40', // Теплый фон для инфраструктуры
    border: 'border-amber-200/50',
    header: 'bg-amber-50/60',
    iconWrapper: 'bg-white border-amber-200 text-amber-600',
    accent: 'group-hover:border-amber-300',
  },
};
// --- Компонент Карточки Строения ---
const BuildingCard = ({ item, projectUjCode, isReadOnly, onEdit, onDelete }) => {
  // Определяем тему по категории, fallback на residential
  const theme = CARD_THEMES[item.category] || CARD_THEMES.residential;
  
  let detailsBadge = null;
  if (item.category === 'parking_separate') {
    const pType =
      item.parkingType === 'ground' || item.parkingType === 'aboveground'
        ? 'Наземный'
        : 'Подземный';
    const pConstName =
      PARKING_CONSTRUCTION_NAMES[item.constructionType] || item.constructionType;
    detailsBadge = `${pType} • ${pConstName}`;
  }

  const Icon = item.category === 'parking_separate' ? Car : item.category === 'infrastructure' ? Box : Building2;

  return (
    <div 
      className={`group rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden relative ${theme.bg} ${theme.border} ${theme.accent}`}
    >
      {/* Верхняя часть с номером и иконкой */}
      <div className={`p-4 border-b ${theme.border} ${theme.header} flex justify-between items-start`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm border ${theme.iconWrapper}`}>
             <Icon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Строение</span>
              <span className="font-black text-slate-800 bg-white/80 border border-slate-200 px-1.5 rounded text-xs">
                {item.houseNumber || '?'}
              </span>
            </div>
            {item.buildingCode && projectUjCode ? (
              <div className="mt-1">
                <FullIdentifierCompact 
                  fullCode={formatFullIdentifier(projectUjCode, item.buildingCode)}
                  variant="default"
                />
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic mt-1 block">Нет UJ кода</span>
            )}
          </div>
        </div>
        
        {/* Статус */}
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border bg-white/50 ${getStageColor(item.stage)}`}>
          {item.stage || 'Проект'}
        </span>
      </div>

      {/* Основная информация */}
      <div className="p-4 flex-grow space-y-3">
        <div>
          <h3 className="font-bold text-slate-800 leading-tight group-hover:text-blue-700 transition-colors">
            {item.label}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {TYPE_NAMES[item.category] || item.category}
          </p>
        </div>

        {/* Характеристики (теги) */}
        <div className="flex flex-wrap gap-1.5">
           {(item.resBlocks > 0 || item.nonResBlocks > 0) && (
              <span className="px-2 py-1 bg-white/60 rounded border border-slate-200 text-[10px] font-semibold text-slate-600">
                {item.resBlocks} жил. / {item.nonResBlocks} нежил. бл.
              </span>
            )}
            {item.hasNonResPart && (
              <span className="px-2 py-1 bg-white/60 text-indigo-700 border border-indigo-100 rounded text-[10px] font-semibold">
                Нежилые на жил. эт.
              </span>
            )}
            {item.category === 'infrastructure' && (
              <span className="px-2 py-1 bg-white/60 text-amber-700 border border-amber-100 rounded text-[10px] font-semibold">
                {item.infraType}
              </span>
            )}
            {detailsBadge && (
              <span className="px-2 py-1 bg-white/60 text-slate-600 border border-slate-200 rounded text-[10px] font-semibold">
                {detailsBadge}
              </span>
            )}
        </div>
      </div>

      {/* Футер с действиями */}
      <div className={`p-3 border-t ${theme.border} flex gap-2 bg-white/40 mt-auto`}>
        <button
          onClick={() => onEdit(item)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors shadow-sm"
        >
          {isReadOnly ? <Eye size={14} /> : <Pencil size={14} />}
          {isReadOnly ? 'Просмотр' : 'Редактировать'}
        </button>
        {!isReadOnly && (
          <button
            onClick={() => onDelete(item.id)}
            className="px-3 py-2 text-xs font-semibold text-red-600 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 rounded-lg transition-colors shadow-sm"
            title="Удалить"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
// -------------------------------------

const BuildingModal = ({
  modal,
  setModal,
  onCommit,
  isSaving,
  parkingTypeOptions,
  parkingConstructionOptions,
  infraTypeOptions,
  projectStageOptions,
}) => {
  const isReadOnly = useReadOnly();
  useEscapeKey(() => setModal(m => ({ ...m, isOpen: false })));

  const { errors, isValid } = useValidation(BuildingModalSchema, {
    baseName: modal.baseName,
    houseNumber: modal.houseNumber,
    category: modal.category || '',
    quantity: modal.quantity,
    resBlocks: modal.resBlocks,
    nonResBlocks: modal.nonResBlocks,
    hasNonResPart: modal.hasNonResPart,
    stage: modal.stage,
    dateStart: modal.dateStart,
    dateEnd: modal.dateEnd,
    parkingType: modal.parkingType,
    parkingConstruction: modal.parkingConstruction,
    infraType: modal.infraType,
  });

  const isMultiblockError =
    (modal.category === 'residential' && modal.resBlocks < 1) ||
    (modal.category === 'residential_multiblock' && (modal.resBlocks < 1 || modal.nonResBlocks < 1));
  const ErrorMsg = ({ field }) =>
    errors[field] ? (
      <span className="text-[9px] text-red-500 font-bold ml-1 animate-in fade-in">
        {errors[field]}
      </span>
    ) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/20 animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              {modal.editingId
                ? isReadOnly
                  ? 'Просмотр объекта'
                  : 'Редактирование объекта'
                : 'Создание объекта'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Паспортные данные строения</p>
          </div>
          <button
            onClick={() => setModal(m => ({ ...m, isOpen: false }))}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-200"
          >
            <X size={20} className="text-slate-400 hover:text-slate-700" />
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ЛЕВАЯ КОЛОНКА */}
          <div className="space-y-5">
            <SectionTitle icon={Hash}>Идентификация</SectionTitle>
            <div className="space-y-1.5">
              <Label>
                Номер дома / Корпус <span className="text-red-500">*</span>{' '}
                <ErrorMsg field="houseNumber" />
              </Label>
              <div className="relative">
                <Hash
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  value={modal.houseNumber}
                  onChange={e => setModal(m => ({ ...m, houseNumber: e.target.value }))}
                  placeholder="12А"
                  className={`pl-9 font-bold text-lg uppercase ${errors.houseNumber ? 'border-red-300 bg-red-50' : ''}`}
                  autoFocus={!isReadOnly}
                  disabled={isReadOnly || isSaving}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>
                Наименование <ErrorMsg field="baseName" />
              </Label>
              <Input
                value={modal.baseName}
                onChange={e => setModal(m => ({ ...m, baseName: e.target.value }))}
                placeholder="Например: Отдельный жилой дом"
                className={errors.baseName ? 'border-red-300 bg-red-50' : ''}
                disabled={
                  isReadOnly || 
                  isSaving || 
                  modal.category === 'infrastructure' || 
                  modal.category === 'parking_separate' ||
                  modal.category.includes('residential') // ИЗМЕНЕНИЕ: Блокируем и для жилья
                }
              />
            </div>
            </div>

          {/* ПРАВАЯ КОЛОНКА */}
          <div className="space-y-5">
            <SectionTitle icon={Clock}>Параметры и Сроки</SectionTitle>
            {modal.category?.includes('residential') && (
              <div
                className={`flex flex-col gap-3 p-3 rounded-xl border transition-colors animate-in fade-in ${isMultiblockError ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}
              >
               <div className={`grid ${modal.category === 'residential_multiblock' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                  <div className="space-y-1">
                    <Label>Жилых блоков</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={modal.resBlocks}
                      onChange={e =>
                        setModal(m => {
                          const val = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
                          
                          // ИЗМЕНЕНИЕ: Пересчитываем имя с учетом текущих нежилых блоков
                          let newName = m.baseName;
                          if (m.category.includes('residential')) {
                             newName = getResidentialName(val, m.nonResBlocks);
                          }

                          return {
                            ...m,
                            resBlocks: val,
                            baseName: newName,
                          };
                        })
                      }
                      disabled={modal.editingId || isSaving}
                    />
                  </div>
                  {modal.category === 'residential_multiblock' && (
                    <div className="space-y-1">
                      <Label>Нежилых</Label>
                      <div className="space-y-1">
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={modal.nonResBlocks}
                        onChange={e =>
                          setModal(m => {
                            const val = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
                            
                            // ИЗМЕНЕНИЕ: Также пересчитываем имя при смене кол-ва нежилых
                            let newName = m.baseName;
                            if (m.category.includes('residential')) {
                               newName = getResidentialName(m.resBlocks, val);
                            }

                            return {
                              ...m,
                              nonResBlocks: val,
                              baseName: newName,
                            };
                          })
                        }
                        disabled={modal.editingId || isSaving}
                      />
                    </div>
                    </div>
                  )}
                </div>
                {modal.editingId && (
                  <div className="text-[10px] text-slate-500 italic">
                    Изменение структуры блоков доступно только при создании.
                  </div>
                )}
                {isMultiblockError && (
                  <div className="flex items-start gap-2 text-[10px] text-red-600 font-bold leading-tight mt-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>
                      {modal.category === 'residential_multiblock'
                        ? 'Для этого типа необходимо минимум: 1 жилой и 1 нежилой блок.'
                        : 'Необходимо минимум: 1 жилой блок.'}
                    </span>
                  </div>
                )}
                {modal.category === 'residential' && (
                  <div className="text-[10px] text-slate-500">
                    Отдельный жилой дом может состоять из нескольких жилых блоков. Нежилые блоки не создаются.
                  </div>
                )}
              </div>
            )}
            {modal.category === 'parking_separate' && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in">
                <div className="space-y-1.5">
                  <Label>Тип паркинга</Label>
                  <Select
                    value={modal.parkingType}
                    onChange={e => {
                      const nextType = e.target.value;
                      setModal(m => ({
                        ...m,
                        parkingType: nextType,
                        parkingConstruction:
                          nextType === 'underground' ? 'capital' : m.parkingConstruction,
                      }));
                    }}
                    disabled={isReadOnly || isSaving}
                  >
                    {parkingTypeOptions.map(opt => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
                {(modal.parkingType === 'ground' || modal.parkingType === 'aboveground') && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2">
                    <Label>Конструктив</Label>
                    <Select
                      value={modal.parkingConstruction}
                      onChange={e => setModal(m => ({ ...m, parkingConstruction: e.target.value }))}
                      disabled={isReadOnly || isSaving}
                    >
                      {parkingConstructionOptions.map(opt => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            )}
            {modal.category === 'infrastructure' && (
              <div className="space-y-1.5 p-3 bg-amber-50 rounded-xl border border-amber-100 animate-in fade-in">
                <Label>
                  Тип объекта <span className="text-red-500">*</span>
                  {/* Вывод ошибки, если валидатор вернул ошибку */}
                  <ErrorMsg field="infraType" />
                </Label>
                <Select
                  value={modal.infraType}
                  onChange={e => {
                    const newValue = e.target.value;
                    setModal(m => ({ 
                      ...m, 
                      infraType: newValue,
                      baseName: newValue // Авто-заполнение имени
                    }));
                  }}
                  disabled={isReadOnly || isSaving}
                  // Подсветка красным, если попытка сохранения с пустым полем (зависит от вашей валидации)
                  className={!modal.infraType && !isValid ? 'border-red-300 bg-white' : 'bg-white'}
                >
                  {/* ИЗМЕНЕНИЕ: Добавляем пустой пункт по умолчанию */}
                  <option value="" disabled>-- Выберите тип --</option>
                  
                  {infraTypeOptions.map(opt => (
                    <option key={opt.code} value={opt.label}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Текущая стадия</Label>
              <Select
                value={modal.stage}
                onChange={e => setModal(m => ({ ...m, stage: e.target.value }))}
                disabled={isReadOnly || isSaving}
              >
                {projectStageOptions.map(opt => (
                  <option key={opt.code} value={opt.label}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Начало работ</Label>
                <Input
                  type="date"
                  value={modal.dateStart}
                  onChange={e => setModal(m => ({ ...m, dateStart: e.target.value }))}
                  className="text-xs font-bold"
                  disabled={isReadOnly || isSaving}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ввод в экспл.</Label>
                <Input
                  type="date"
                  value={modal.dateEnd}
                  onChange={e => setModal(m => ({ ...m, dateEnd: e.target.value }))}
                  className="text-xs font-bold"
                  disabled={isReadOnly || isSaving}
                />
              </div>
            </div>
            {modal.category?.includes('residential') && (
              <div className="pt-2 border-t border-slate-100 mt-2">
                <div
                  className={`flex items-start gap-3 group ${isReadOnly || isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    id="has-nonres-part-checkbox"
                    aria-label="Есть нежилые объекты на жилых этажах"
                    type="checkbox"
                    checked={modal.hasNonResPart}
                    onChange={e => setModal(m => ({ ...m, hasNonResPart: e.target.checked }))}
                    disabled={isReadOnly || isSaving}
                    className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 disabled:cursor-not-allowed"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                      Есть нежилые объекты на жилых этажах
                    </span>
                    <p className="text-[10px] text-slate-400">Есть квартиры используемые как нежилые объекты</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => setModal(m => ({ ...m, isOpen: false }))}
            disabled={isReadOnly || isSaving}
          >
            {isReadOnly ? 'Закрыть' : 'Отмена'}
          </Button>
          {!isReadOnly && (
            <Button
              onClick={onCommit}
              disabled={!isValid || isMultiblockError || isSaving}
              className={`shadow-xl shadow-blue-200/50 px-8 ${!isValid || isMultiblockError ? 'opacity-50 cursor-not-allowed bg-slate-400' : ''}`}
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin mr-2" />
              ) : (
                <ArrowRight size={18} className="mr-2" />
              )}
              {isSaving ? 'Сохранение...' : 'Применить'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, isDeleting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 border border-red-100">
            <Trash2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Удалить объект?</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Вы собираетесь удалить строение и все связанные с ним данные:
            <br />
            <span className="font-semibold text-slate-700">блоки, этажи, помещения и планировки.</span>
            <br />
            Это действие невозможно отменить.
          </p>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-slate-50 border-t border-slate-100">
          <Button 
            variant="ghost" 
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1"
          >
            Отмена
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-red-200/50"
          >
            {isDeleting ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : (
              <Trash2 size={16} className="mr-2" />
            )}
            {isDeleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </div>
      </div>
    </div>
  );
};


// Хелпер для формирования названия жилого дома
const getResidentialName = (resBlocks, nonResBlocks) => {
  let name = 'Многоквартирный жилой дом';
  if (resBlocks > 1) {
    name += ` из ${resBlocks} блоков`;
  }
  if (nonResBlocks > 0) {
    name += ' с нежилыми блоками';
  }
  return name;
};

const CompositionEditor = () => {
  const { projectId, complexInfo, userProfile } = useProject();
  const isReadOnly = useReadOnly();
  const projectUjCode = complexInfo?.ujCode;
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // State для переключения вида (grid/list)
  // Инициализируем из localStorage или по умолчанию 'grid'
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('compositionViewMode') || 'grid');

  // Функция для сохранения выбора пользователя
  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('compositionViewMode', mode);
  };

  const { buildings, isLoading, createBuilding, updateBuilding, deleteBuilding, isMutating } =
    useDirectBuildings(projectId);

  const [modal, setModal] = useState({
    isOpen: false,
    category: null,
    quantity: 1,
    resBlocks: 1,
    nonResBlocks: 0,
    hasNonResPart: false,
    baseName: '',
    houseNumber: '',
    dateStart: '',
    dateEnd: '',
    stage: 'Проектный',
    editingId: null,
    parkingType: 'ground',
    parkingConstruction: 'light',
    infraType: 'Котельная',
  });

  const hasResidential = useMemo(
    () => buildings.some(c => c.category.includes('residential')),
    [buildings]
  );

  const { options: parkingTypeOptions } = useCatalog('dict_parking_types');
  const { options: parkingConstructionOptions } = useCatalog('dict_parking_construction_types');

  const normalizedParkingConstructionOptions = useMemo(() => {
    const byCode = new Map((parkingConstructionOptions || []).map(opt => [opt.code, opt]));

    return PARKING_CONSTRUCTION_FALLBACK.map(fallback => ({
      code: fallback.code,
      label: byCode.get(fallback.code)?.label || fallback.label,
    }));
  }, [parkingConstructionOptions]);
  const { options: infraTypeOptions } = useCatalog('dict_infra_types');
  const { options: projectStageOptions } = useCatalog('dict_project_statuses');

  

  const openPlanning = category => {
    let defaultName = TYPE_NAMES[category] || 'Новый объект';
    
    // Начальные значения блоков
    const initResBlocks = category.includes('multiblock') ? 1 : category.includes('residential') ? 1 : 0;
    const initNonResBlocks = category.includes('multiblock') ? 1 : 0;

    if (category === 'infrastructure') {
      defaultName = '';
    } else if (category === 'parking_separate') {
      defaultName = 'Отдельно стоящий Паркинг';
    } else if (category.includes('residential')) {
      // ИЗМЕНЕНИЕ: Формируем имя через хелпер
      defaultName = getResidentialName(initResBlocks, initNonResBlocks);
    }

    const defaultInfraType = category === 'infrastructure' ? '' : 'Котельная';

    setModal({
      isOpen: true,
      category,
      quantity: 1,
      resBlocks: initResBlocks,
      nonResBlocks: initNonResBlocks,
      hasNonResPart: false,
      baseName: defaultName,
      houseNumber: '',
      dateStart: '',
      dateEnd: '',
      stage: 'Проектный',
      parkingType: 'ground',
      parkingConstruction: 'light',
      infraType: defaultInfraType,
      editingId: null,
    });
  };

  const openEditing = item => {
    setModal({
      isOpen: true,
      editingId: item.id,
      category: item.category,
      quantity: 1,
      resBlocks: item.resBlocks || 0,
      nonResBlocks: item.category === 'residential_multiblock' ? item.nonResBlocks || 0 : 0,
      hasNonResPart: item.hasNonResPart || false,
      baseName: item.label,
      houseNumber: item.houseNumber,
      dateStart: item.dateStart || '',
      dateEnd: item.dateEnd || '',
      stage: item.stage || 'Проектный',
      parkingType: item.parkingType || 'ground',
      parkingConstruction: item.constructionType || 'capital',
      infraType: item.infraType || 'Котельная',
      blocksData: Array.isArray(item.blocks)
        ? item.blocks.map((block, index) => ({
            id: block.id,
            label: block.label,
            type: block.type,
            floorsCount: block.floorsCount,
            index,
          }))
        : [],
    });
  };

  const commitPlanning = async () => {
    const isParking = modal.category === 'parking_separate';
    const isInfrastructure = modal.category === 'infrastructure';

    const isAbovegroundParking =
      modal.parkingType === 'ground' || modal.parkingType === 'aboveground';
    const normalizedModal = {
      ...modal,
      nonResBlocks: modal.category === 'residential' ? 0 : modal.nonResBlocks,
    };

    const buildingData = {
      label: modal.baseName,
      houseNumber: modal.houseNumber,
      category: modal.category,
      constructionType: isParking
        ? isAbovegroundParking
          ? modal.parkingConstruction
          : 'capital'
        : null,
      parkingType: isParking ? modal.parkingType : null,
      infraType: isInfrastructure ? modal.infraType : null,
      hasNonResPart: modal.hasNonResPart,
      // Пробрасываем эти поля, даже если их нет в базовой схеме buildings,
      // так как api-service может использовать их для записи в building_blocks или мета-таблицы
      stage: modal.stage,
      dateStart: modal.dateStart,
      dateEnd: modal.dateEnd,
    };

    if (modal.editingId) {
      await updateBuilding({
        id: modal.editingId,
        data: buildingData,
        blocksData: modal.blocksData,
        actor: {
          userName: userProfile?.name,
          userRole: userProfile?.role,
        },
      });
    } else {
      for (let i = 0; i < modal.quantity; i++) {
        const label = modal.quantity > 1 ? `${modal.baseName} ${i + 1}` : modal.baseName;
        const blocks = generateBlocksPayload(normalizedModal);

        await createBuilding({
          buildingData: { ...buildingData, label },
          blocksData: blocks,
          actor: {
            userName: userProfile?.name,
            userRole: userProfile?.role,
          },
        });
      }
    }
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleDeleteClick = (id) => {
    setDeleteTargetId(id);
  };

  // 2. Обработчик подтверждения (выполняет удаление)
  const handleConfirmDelete = async () => {
    if (deleteTargetId) {
      await deleteBuilding({
        id: deleteTargetId,
        actor: {
          userName: userProfile?.name,
          userRole: userProfile?.role,
        },
      });
      setDeleteTargetId(null); // Закрываем окно после успеха
    }
  };

  if (isLoading)
    return (
      <div className="p-20 flex justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );

  return (
    <div className="w-full px-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-2 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Состав жилого комплекса</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
            Создание и управление строениями входящими в состав комплекса
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => handleSetViewMode('list')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'list' 
                  ? 'bg-white shadow-sm text-blue-600' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Списком"
            >
              <ListIcon size={18} />
            </button>
            <button
              onClick={() => handleSetViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white shadow-sm text-blue-600' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Карточки"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
         
          <div className="h-10 px-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center shadow-lg shadow-slate-900/20">
            зданий и сооружений в составе комплекса - {buildings.length} 
          </div>
        </div>
      </div>

      {!isReadOnly && (
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-xl shadow-slate-900/10 mb-8 animate-in slide-in-from-top-4 duration-500">
          {/* Декоративный фон */}
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Building2 size={200} className="text-white" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-900/40" />

          <div className="relative z-10 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xs">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-blue-400" />
                              </h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Выберите тип строения для добавления в состав жилого комплекса.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                {
                  id: 'residential',
                  label: 'Жилой дом',
                  desc: 'Обычный / МКД',
                  icon: Home,
                  style: 'hover:bg-blue-500 hover:border-blue-400 text-white',
                },
                {
                  id: 'residential_multiblock',
                  label: 'Многосекционный',
                  desc: 'Жилье + Нежилые',
                  icon: Layers,
                  style: 'hover:bg-indigo-500 hover:border-indigo-400 text-white',
                },
                {
                  id: 'parking_separate',
                  label: 'Паркинг',
                  desc: 'Отдельное здание',
                  icon: Car,
                  style: 'hover:bg-slate-600 hover:border-slate-500 text-white',
                },
                {
                  id: 'infrastructure',
                  label: 'Инфраструктура',
                  desc: 'ТП, Котельная и др.',
                  icon: Box,
                  style: 'hover:bg-amber-500 hover:border-amber-400 text-white',
                },
              ].map(btn => (
                <button
                  key={btn.id}
                  onClick={() => openPlanning(btn.id)}
                  disabled={isMutating}
                  className={`group relative flex flex-col items-start justify-center pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${btn.style}`}
                >
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
                     {isMutating ? <Loader2 size={16} className="animate-spin" /> : <btn.icon size={16} />}
                  </div>
                  <span className="text-xs font-bold leading-none mb-0.5">{btn.label}</span>
                  <span className="text-[10px] opacity-60 font-medium leading-none">{btn.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!hasResidential && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in">
          <div className="p-2 bg-white rounded-full shadow-sm border border-red-100 text-red-500">
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold">Необходимо добавить жилой дом</h4>
            <p className="text-xs opacity-80 mt-0.5">
              В проекте должен быть минимум один жилой или многоблочный дом для продолжения работы.
            </p>
          </div>
        </div>
      )}

      {buildings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
              <Building2 size={32} />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Список объектов пуст</h3>
            <p className="text-xs text-slate-400 mt-1">Используйте кнопки сверху для создания</p>
        </div>
      ) : (
        <>
          {viewMode === 'list' ? (
             <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-200 py-4 pl-6 pr-4 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-1 text-center">Дом №</div>
                  <div className="col-span-2">Код</div>
                  <div className="col-span-3">Наименование</div>
                  <div className="col-span-2">Характеристики</div>
                  <div className="col-span-1">Статус</div>
                  <div className="col-span-1 text-right">Ред.</div>
                  <div className="col-span-1 text-right">Действия</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {buildings.map((item, idx) => {
                    const isRes = item.category.includes('residential');
                    let detailsBadge = null;
                    if (item.category === 'parking_separate') {
                      const pType =
                        item.parkingType === 'ground' || item.parkingType === 'aboveground'
                          ? 'Наземный'
                          : 'Подземный';
                      const pConstName =
                        PARKING_CONSTRUCTION_NAMES[item.constructionType] || item.constructionType;
                      detailsBadge = `${pType} • ${pConstName}`;
                    }

                  return (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 items-center py-4 pl-6 pr-4 hover:bg-blue-50/50 transition-colors group even:bg-slate-50/50"
                      >
                        <div className="col-span-1 text-xs font-bold text-slate-400 text-center">
                          {idx + 1}
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shadow-sm border ${isRes ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-amber-700'}`}
                          >
                            {item.houseNumber || '?'}
                          </div>
                        </div>

                        {/* НОВАЯ КОЛОНКА КОД */}
                        <div className="col-span-2 flex items-center">
                          {item.buildingCode && projectUjCode ? (
                              <FullIdentifierCompact 
                                fullCode={formatFullIdentifier(projectUjCode, item.buildingCode)}
                                variant="default" 
                              />
                          ) : (
                            <span className="text-slate-300 text-xs px-2">-</span>
                          )}
                        </div>

                        <div className="col-span-3 pr-4">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                                {item.label}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {TYPE_NAMES[item.category] || item.category}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="col-span-2 pr-4 flex flex-col justify-center gap-1.5">
                          <div className="flex flex-wrap gap-1">
                            {(item.resBlocks > 0 || item.nonResBlocks > 0) && (
                              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px] font-bold text-slate-600">
                                {item.resBlocks} жил. / {item.nonResBlocks} нежил.
                              </span>
                            )}
                            {item.hasNonResPart && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-bold">
                                +Нежилые объекты на жилых этажах
                              </span>
                            )}
                            {item.category === 'infrastructure' && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold">
                                {item.infraType}
                              </span>
                            )}
                            {detailsBadge && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">
                                {detailsBadge}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="col-span-1 pr-4">
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${getStageColor(item.stage)}`}
                          >
                            {item.stage || 'Проект'}
                          </span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => openEditing(item)}
                            title={isReadOnly ? 'Просмотр' : 'Редактировать'}
                            className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold shadow-sm hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            {isReadOnly ? <Eye size={14} /> : <Pencil size={14} />}
                            <span>{isReadOnly ? 'Просм.' : 'Ред.'}</span>
                          </button>
                        </div>
                        <div className="col-span-1 flex justify-end gap-1">
                          <button
                            onClick={() => openEditing(item)}
                            title="Открыть"
                            className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                          >
                            <ArrowRight size={14} />
                          </button>
                          {!isReadOnly && (
                            <button
                              onClick={() => handleDeleteClick(item.id)}
                              title="Удалить"
                              className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm flex items-center justify-center hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in">
              {buildings.map((item) => (
                <BuildingCard 
                  key={item.id}
                  item={item}
                  projectUjCode={projectUjCode}
                  isReadOnly={isReadOnly}
                  onEdit={openEditing}
                  onDelete={handleDeleteClick}
                />
              ))}
              
            </div>
          )}
        </>
      )}

      {modal.isOpen && (
        <BuildingModal
          modal={modal}
          setModal={setModal}
          onCommit={commitPlanning}
          isSaving={isMutating}
          parkingTypeOptions={parkingTypeOptions}
          parkingConstructionOptions={normalizedParkingConstructionOptions}
          infraTypeOptions={infraTypeOptions}
          projectStageOptions={projectStageOptions}
        />
      )}
      <DeleteConfirmationModal 
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isMutating}
      />
    </div>
  );
};

export default React.memo(CompositionEditor);
