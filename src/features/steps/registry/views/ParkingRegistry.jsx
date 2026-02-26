import React, { useState, useMemo } from 'react';
import { Car, CheckCircle2, Loader2, ArrowLeft, Wand2, Building2, MapPin, FileText } from 'lucide-react';
import { Button, Card, useReadOnly } from '@components/ui/UIKit';
import EmptyState from '@components/ui/EmptyState';
import { FullIdentifierCompact } from '@components/ui/IdentifierBadge';
import { formatFullIdentifier } from '@lib/uj-identifier';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { useProject } from '@context/ProjectContext';
import { useQueryClient } from '@tanstack/react-query';
import { ApiService } from '@lib/api-service';
import { AuthService } from '@lib/auth-service';
import ParkingEditModal from '@/features/steps/shared/ParkingEditModal';
import { useToast } from '@context/ToastContext';

const ParkingRegistry = ({ projectId, buildingId, onBack }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = AuthService.getCurrentUser?.() || null;
  const actor = {
    userName: currentUser?.displayName || currentUser?.email || 'unknown',
    userRole: currentUser?.role || 'technician',
  };
  const { complexInfo, saveProjectImmediate, setHasUnsavedChanges } = useProject();
  const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);
  const isReadOnly = useReadOnly(); // Получаем статус режима чтения для скрытия кнопок

  const [editingUnit, setEditingUnit] = useState(null);
  const [isStepSaving, setIsStepSaving] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  
  const projectUjCode = complexInfo?.ujCode;

  // Получаем информацию о текущем здании для шапки
  const currentBuilding = useMemo(() => {
    if (!fullRegistry?.buildings) return null;
    return fullRegistry.buildings.find(b => b.id === buildingId);
  }, [fullRegistry, buildingId]);

  const { data, stats } = useMemo(() => {
    if (!fullRegistry || !fullRegistry.units) return { data: [], stats: null };

    const { units, buildings, floors, blocks } = fullRegistry;
    const bMap = {};
    buildings.forEach(b => (bMap[b.id] = b));
    const blMap = {};
    blocks.forEach(b => (blMap[b.id] = b));
    const fMap = {};
    floors.forEach(f => (fMap[f.id] = f));

    // 1. Фильтруем только паркинг
    let parking = units.filter(u => u.type === 'parking_place');

    // 2. Обогащаем
    let enriched = parking.map(u => {
      const floor = fMap[u.floorId];
      const block = floor ? blMap[floor.blockId] : null;
      const building = block ? bMap[block.buildingId] : null;

      return {
        ...u,
        floorLabel: floor?.label || '-',
        blockLabel: block?.tabLabel || block?.label || '-',
        buildingLabel: building?.label || '-',
        buildingId: building?.id,
        buildingCode: building?.building_code || building?.buildingCode || null,
        houseNumber: building?.houseNumber || '-',
      };
    });

    // Фильтруем по зданию (если выбрано)
    if (buildingId) {
        enriched = enriched.filter(item => item.buildingId === buildingId);
    }

    // Сортировка
    const sortedData = enriched.sort((a, b) => {
       if (a.buildingId !== b.buildingId) return a.buildingId.localeCompare(b.buildingId);
       return String(a.number || '').localeCompare(String(b.number || ''), 'ru', { numeric: true });
    });

    // 4. Статистика
    const totalArea = sortedData.reduce((sum, item) => sum + (parseFloat(item.area) || 0), 0);
    const totalReady = sortedData.filter(i => i.number && parseFloat(i.area) > 0).length;

    return {
      data: sortedData,
      stats: {
        count: sortedData.length,
        area: totalArea,
        ready: totalReady,
      },
    };
  }, [fullRegistry, buildingId]);

  // Логика сохранения одного юнита
  const handleSaveUnit = async (originalUnit, changes) => {
    try {
      const mergedData = { ...originalUnit, ...changes };
      const payload = {
        id: mergedData.id,
        floorId: mergedData.floorId,
        entranceId: mergedData.entranceId,
        num: mergedData.number || mergedData.num,
        type: mergedData.type,
        area: mergedData.area,
        livingArea: mergedData.livingArea,
        usefulArea: mergedData.usefulArea,
        rooms: mergedData.rooms,
        isSold: mergedData.isSold,
        explication: mergedData.explication || mergedData.roomsList,
      };

      await ApiService.upsertUnit(payload, actor);
      await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
      return true;
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Ошибка сохранения: ' + error.message);
      return false;
    }
  };

  const handleSave = async changes => {
    const success = await handleSaveUnit(editingUnit, changes);
    if (success) {
      setEditingUnit(null);
      toast.success('Сохранено');
    }
  };

  // Логика автозаполнения
  const handleAutoFill = async () => {
    if (isReadOnly) return;
    if (data.length === 0) return;
    if (!window.confirm('Автоматически присвоить номера и площадь (13.25м²) пустым местам?')) return;

    setIsAutoFilling(true);
    try {
        const updates = [];
        data.forEach((item, index) => {
            const needsNumber = !item.number;
            const needsArea = !parseFloat(item.area);

            if (needsNumber || needsArea) {
                updates.push({
                    id: item.id,
                    floorId: item.floorId,
                    type: item.type,
                    num: item.number || String(index + 1),
                    area: parseFloat(item.area) > 0 ? item.area : '13.25',
                    isSold: item.isSold
                });
            }
        });

        if (updates.length === 0) {
            toast.info('Все места уже заполнены');
            return;
        }

        if (ApiService.batchUpsertUnits) {
            await ApiService.batchUpsertUnits(updates, actor);
        } else {
            await Promise.all(updates.map(u => ApiService.upsertUnit(u, actor)));
        }

        await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
        toast.success(`Обновлено ${updates.length} мест`);

    } catch (error) {
        console.error('Autofill error:', error);
        toast.error('Ошибка автозаполнения');
    } finally {
        setIsAutoFilling(false);
    }
  };

  const handleStepSave = async () => {
    if (isReadOnly || isStepSaving) return;

    setIsStepSaving(true);
    try {
      await saveProjectImmediate({ shouldRefetch: false });
      setHasUnsavedChanges(false);
      toast.success('Шаг сохранен');
    } catch (error) {
      console.error(error);
      toast.error('Не удалось сохранить шаг');
    } finally {
      setIsStepSaving(false);
    }
  };

  if (loadingRegistry)
    return (
      <div className="p-12 text-center">
        <Loader2 className="animate-spin mx-auto text-blue-600" />
      </div>
    );

  return (
    <div className="space-y-6 px-4 md:px-6 2xl:px-8 pb-10">
      {/* Header */}
      {buildingId && onBack && (
        <div className="flex items-center gap-4 mb-4 pt-4 border-b border-slate-200 pb-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Инвентаризация машиномест</h2>
            <p className="text-sm text-slate-500">Заполнение реестра паркинга</p>
          </div>
        </div>
      )}

      {/* Инфо карточка */}
      {currentBuilding && (
        <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 leading-tight">
                  {currentBuilding.label}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                    <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        Дом {currentBuilding.houseNumber}
                    </span>
                    {currentBuilding.cadastreNumber && (
                        <span className="flex items-center gap-1 font-mono text-xs">
                            <FileText size={12} /> {currentBuilding.cadastreNumber}
                        </span>
                    )}
                </div>
              </div>
            </div>

            <div className="flex gap-8 border-l border-slate-100 pl-8">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Мест</div>
                <div className="text-2xl font-black text-slate-800">{stats?.count || 0}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Площадь</div>
                <div className="text-2xl font-black text-blue-600">
                  {stats?.area?.toFixed(0) || 0} <span className="text-sm text-slate-400 font-medium">м²</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Готово</div>
                <div className={`text-2xl font-black ${stats?.ready === stats?.count ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {stats?.ready || 0}<span className="text-lg text-slate-300 font-normal">/{stats?.count}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Панель действий */}
      <div className="flex justify-between items-center min-h-[40px]">
        <div className="flex gap-2">
            {!isReadOnly && (
                <Button 
                    variant="secondary"
                    onClick={handleAutoFill} 
                    disabled={isAutoFilling || data.length === 0}
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 shadow-sm"
                >
                    {isAutoFilling ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    Автозаполнение
                </Button>
            )}
        </div>

        {!isReadOnly && (
            <Button onClick={handleStepSave} disabled={isStepSaving} className="shrink-0 shadow-sm">
            {isStepSaving ? <><Loader2 size={16} className="animate-spin mr-2" />Сохраняем...</> : 'Сохранить шаг'}
            </Button>
        )}
      </div>

      {/* Таблица */}
      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 rounded-xl mx-4 md:mx-0">
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-bold sticky top-0 z-20">
              <tr>
                <th className="py-3 px-4 w-12 text-center text-slate-400">№</th>
                <th className="py-3 px-4 w-24 text-center">Дом</th>
                <th className="py-3 px-4 w-28 text-center">Номер</th>
                <th className="py-3 px-4 w-64 text-left">UJ-Код</th>
                <th className="py-3 px-4 w-32 text-center">Уровень</th>
                <th className="py-3 px-4 w-24 text-right">Площадь</th>
                <th className="py-3 px-4 w-32 text-center">Статус</th>
              </tr>
            </thead>
            <tbody className="bg-white text-sm divide-y divide-slate-100">
              {data.length > 0 ? (
                data.map((item, index) => {
                  const hasArea = parseFloat(item.area) > 0;
                  const hasNumber = !!item.number;
                  const isReady = hasArea && hasNumber;

                  return (
                    <tr
                      key={item.id}
                      // В режиме чтения клик не вызывает модалку
                      onClick={() => !isReadOnly && setEditingUnit(item)}
                      className={`group transition-colors ${!isReadOnly ? 'cursor-pointer hover:bg-blue-50/50' : 'cursor-default'}`}
                    >
                      {/* Индекс */}
                      <td className="p-4 text-xs text-slate-400 text-center font-mono">
                        {index + 1}
                      </td>

                      {/* Дом */}
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-100 text-slate-600 font-bold text-[10px] whitespace-nowrap">
                           {item.houseNumber ? `Дом ${item.houseNumber}` : '-'}
                        </div>
                      </td>

                      {/* Номер (Крупный) */}
                      <td className="p-4 text-center">
                         {item.number ? (
                             <span className="font-black text-slate-800 text-lg">{item.number}</span>
                         ) : (
                             <span className="text-xs text-slate-300 italic">пусто</span>
                         )}
                      </td>

                      {/* UJ-Код (Широкая колонка) */}
                      <td className="p-4 text-left">
                        {item.unitCode && item.buildingCode && projectUjCode ? (
                           <div className="flex items-center gap-2">
                                <FullIdentifierCompact 
                                  fullCode={formatFullIdentifier(projectUjCode, item.buildingCode, item.unitCode)}
                                  variant="compact"
                                />
                           </div>
                        ) : (
                            <span className="text-xs text-slate-300 pl-2">Код не сгенерирован</span>
                        )}
                      </td>
                      
                      {/* Уровень */}
                      <td className="p-4 text-center font-medium text-slate-600">
                        {item.floorLabel}
                      </td>

                      {/* Площадь (Узкая колонка) */}
                      <td className="p-4 text-right">
                         <div className={`font-mono font-bold ${item.area ? 'text-slate-800' : 'text-slate-300'}`}>
                            {item.area ? parseFloat(item.area).toFixed(2) : '-'}
                         </div>
                      </td>

                      {/* Статус */}
                      <td className="p-4 text-center">
                        {isReady ? (
                          <div className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>ГОТОВ</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full text-[10px] font-bold">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span>В РАБОТЕ</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Car}
                      title="Нет мест"
                      description="В реестре пока нет записей."
                      compact
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editingUnit && (
        <ParkingEditModal
          unit={editingUnit}
          buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
          onClose={() => setEditingUnit(null)}
          onSave={handleSave}
          // Здесь НЕ передаем isReadOnly, так как модалка сама берет его из контекста
        />
      )}
    </div>
  );
};

export default React.memo(ParkingRegistry);