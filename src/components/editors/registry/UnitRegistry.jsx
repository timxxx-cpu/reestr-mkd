import React, { useState, useEffect } from 'react';
import { Home, Briefcase, Car, Loader2 } from 'lucide-react';
import { useToast } from '@context/ToastContext';
import { TabButton } from '@components/ui/UIKit';
import { ApiService } from '@lib/api-service';
import { useProject } from '@context/ProjectContext';

// Импорт видов
import ApartmentsRegistry from './views/ApartmentsRegistry';
import CommercialRegistry from './views/CommercialRegistry';
import ParkingRegistry from './views/ParkingRegistry';

const MODES = {
  apartments: { component: ApartmentsRegistry, icon: Home, title: 'Квартиры' },
  commercial: { component: CommercialRegistry, icon: Briefcase, title: 'Коммерция' },
  parking: { component: ParkingRegistry, icon: Car, title: 'Паркинг' },
};

const UnitRegistry = ({ mode = 'apartments' }) => {
  const { projectId } = useProject();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(mode);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (MODES[mode]) {
      setActiveTab(mode);
    }
  }, [mode]);

  // [NEW] Новая логика сохранения напрямую в БД
  const handleSaveUnit = async (originalUnit, changes) => {
    setIsSaving(true);
    try {
      // 1. Мержим данные
      const mergedData = {
        ...originalUnit,
        ...changes,
      };

      // 2. Подготовка payload для API
      // ApiService.upsertUnit ожидает структуру, совместимую с БД
      const payload = {
        id: mergedData.id,
        floorId: mergedData.floorId,
        entranceId: mergedData.entranceId, // Важно!

        num: mergedData.number || mergedData.num,
        type: mergedData.type,
        area: mergedData.area,

        // Доп. поля
        livingArea: mergedData.livingArea,
        usefulArea: mergedData.usefulArea,
        rooms: mergedData.rooms,
        isSold: mergedData.isSold,

        // Комнаты (если есть)
        explication: mergedData.explication || mergedData.roomsList,
      };

      // 3. Отправляем в БД
      await ApiService.upsertUnit(payload);

      toast.success('Сохранено');

      // ВАЖНО: Нам нужно обновить данные в UI.
      // Компоненты-списки (ApartmentsRegistry) используют useQuery.
      // Нам нужно инвалидировать кэш 'project-registry', чтобы список обновился.
      // Мы сделаем это через queryClient внутри компонентов или передадим callback.
      // Но проще всего - компоненты сами подпишутся на обновление.

      return true; // Успех
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Ошибка сохранения: ' + error.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const ActiveComponent = MODES[activeTab]?.component || ApartmentsRegistry;

  return (
    <div className="w-full pb-24 space-y-6 animate-in fade-in">
      {/* Шапка */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 px-6 pt-2">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            {React.createElement(MODES[activeTab].icon, { className: 'text-blue-600' })}
            <span>{MODES[activeTab].title}</span>
          </h1>
          {isSaving && (
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold animate-pulse">
              <Loader2 size={14} className="animate-spin" /> Сохранение...
            </div>
          )}
        </div>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-max">
          {Object.entries(MODES).map(([key, config]) => (
            <TabButton key={key} active={activeTab === key} onClick={() => setActiveTab(key)}>
              <config.icon size={16} className="mr-2 opacity-70" />
              {config.title}
            </TabButton>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div className="px-6">
        <ActiveComponent onSaveUnit={handleSaveUnit} projectId={projectId} />
      </div>
    </div>
  );
};

export default React.memo(UnitRegistry);
