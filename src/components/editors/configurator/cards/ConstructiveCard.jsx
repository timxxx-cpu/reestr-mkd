import React from 'react';
import { Hammer, Activity, AlertCircle } from 'lucide-react';
import { Card, SectionTitle, Label, Select, useReadOnly } from '@components/ui/UIKit';
import { useCatalog } from '../../../../hooks/useCatalogs';

export default function ConstructiveCard({ details, updateDetail, errors }) {
  const isReadOnly = useReadOnly();
  // Защита от undefined, если errors не передан
  const safeErrors = errors || {};

  const { options: foundationOptions } = useCatalog('dict_foundations');
  const { options: wallOptions } = useCatalog('dict_wall_materials');
  const { options: slabOptions } = useCatalog('dict_slab_types');
  const { options: roofOptions } = useCatalog('dict_roof_types');

  const fields = [
    { key: 'foundation', label: 'Фундамент', options: foundationOptions },
    { key: 'walls', label: 'Стены', options: wallOptions },
    { key: 'slabs', label: 'Перекрытия', options: slabOptions },
    { key: 'roof', label: 'Крыша', options: roofOptions },
  ];

  // Проверяем, есть ли ошибки в этой карточке
  const hasCardErrors = fields.some(f => safeErrors[f.key]) || safeErrors.seismicity;

  // Хелпер для стилей ошибки поля
  const getErrorClass = key =>
    safeErrors[key]
      ? 'border-red-500 focus:border-red-500 bg-red-50 text-red-900 placeholder:text-red-300'
      : '';

  return (
    <Card
      className={`p-5 shadow-sm transition-all duration-300 ${hasCardErrors ? 'border-red-300 ring-2 ring-red-50 shadow-red-100' : ''}`}
    >
      <div className="flex justify-between items-center mb-4">
        <SectionTitle icon={Hammer} className="mb-0">
          Конструктив
        </SectionTitle>
        {hasCardErrors && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg animate-pulse">
            <AlertCircle size={14} />
            <span>Требуется заполнение</span>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* Основные элементы */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {fields.map(({ key, label, options }) => (
            <div key={key} className="space-y-1.5 relative group">
              <Label className={safeErrors[key] ? 'text-red-600' : 'text-slate-500'}>
                {label} {safeErrors[key] && <span className="text-red-500">*</span>}
              </Label>
              <Select
                className={`w-full text-sm py-2 font-medium bg-slate-50 border-slate-200 focus:bg-white transition-colors ${getErrorClass(key)}`}
                value={details[key] || ''}
                onChange={e => updateDetail(key, e.target.value)}
                disabled={isReadOnly}
              >
                <option value="" disabled>
                  Не выбрано
                </option>
                {(options || []).map(o => (
                  <option key={o.code} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {/* Текст ошибки */}
              {safeErrors[key] && (
                <div className="absolute -bottom-4 left-0 text-[9px] text-red-500 font-bold whitespace-nowrap">
                  Выберите значение из списка
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Сейсмичность */}
        <div
          className={`pt-4 border-t ${safeErrors.seismicity ? 'border-red-100' : 'border-slate-100'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity
              size={16}
              className={safeErrors.seismicity ? 'text-red-500' : 'text-rose-500'}
            />
            <Label
              className={`font-bold mb-0 ${safeErrors.seismicity ? 'text-red-700' : 'text-slate-700'}`}
            >
              Сейсмостойкость {safeErrors.seismicity && <span className="text-red-500">*</span>}
            </Label>
          </div>
          <div className="flex gap-2">
            {[7, 8, 9, 10].map(ball => {
              const isSelected = parseInt(details.seismicity) === ball;
              return (
                <button
                  key={ball}
                  disabled={isReadOnly}
                  onClick={() => updateDetail('seismicity', ball)}
                  className={`
                                        flex-1 py-2 rounded-lg border text-sm font-bold transition-all
                                        ${
                                          isSelected
                                            ? 'bg-rose-50 border-rose-200 text-rose-700 ring-1 ring-rose-400 shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                        }
                                        ${safeErrors.seismicity && !details.seismicity ? 'border-red-300 bg-red-50 text-red-400' : ''}
                                    `}
                >
                  {ball}
                </button>
              );
            })}
          </div>
          {safeErrors.seismicity && (
            <p className="text-[10px] text-red-500 mt-1 font-bold">
              Необходимо указать сейсмичность
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
