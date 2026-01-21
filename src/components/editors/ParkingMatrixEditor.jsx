import React, { useState, useMemo } from 'react';
import { ArrowLeft, Save, Car, Grip, Hash } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';

function getBlocksList(building) {
  if (!building) return [];
  // Если это отдельный паркинг - показываем его как один блок
  if (building.category === 'parking_separate') {
    return [
      { id: 'main', type: 'Паркинг', index: 0, fullId: `${building.id}_main` },
    ];
  }
  // Если жилой дом - ищем блоки
  const list = [];
  if (building.category && building.category.includes('residential')) {
    for (let i = 0; i < (building.resBlocks || 0); i++)
      list.push({
        id: `res_${i}`,
        type: 'Ж',
        index: i,
        fullId: `${building.id}_res_${i}`,
      });
  }
  if (list.length === 0)
    list.push({
      id: 'main',
      type: 'Основной',
      index: 0,
      fullId: `${building.id}_main`,
    });
  return list;
}

export default function ParkingMatrixEditor({ buildingId, onBack }) {
  const {
    composition,
    buildingDetails,
    parkingPlaces,
    setParkingPlaces,
    saveData,
  } = useProject();
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);

  const building = composition.find((c) => c.id === buildingId);
  if (!building)
    return (
      <div className="p-8 text-center text-slate-500">Здание не найдено</div>
    );

  const blocksList = useMemo(() => getBlocksList(building), [building]);
  const currentBlock = blocksList[activeBlockIndex];

  if (!currentBlock)
    return <div className="p-8 text-center text-slate-500">Нет блоков</div>;

  const blockDetails =
    buildingDetails[`${building.id}_${currentBlock.id}`] || {};
  const basements = buildingDetails[`${building.id}_features`]?.basements || [];

  // Определяем уровни, где может быть парковка
  const parkingLevels = useMemo(() => {
    const list = [];

    // 1. Если это отдельный паркинг - берем все этажи
    if (building.category === 'parking_separate') {
      const start = blockDetails.floorsFrom || 1;
      const end = blockDetails.floorsTo || 1;

      // Подвалы паркинга
      basements
        .filter((b) => b.blocks?.includes(currentBlock.id))
        .forEach((b) => {
          for (let d = b.depth; d >= 1; d--)
            list.push({
              id: `base_${b.id}_L${d}`,
              label: `Подвал -${d}`,
              sortOrder: -100 - d,
            });
        });

      // Этажи паркинга
      for (let i = start; i <= end; i++) {
        list.push({ id: `floor_${i}`, label: `${i} этаж`, sortOrder: i });
      }
    }
    // 2. Если жилой дом - берем только подвалы, где стоит галочка hasParking (или просто все подвалы для простоты)
    else {
      basements
        .filter((b) => b.blocks?.includes(currentBlock.id))
        .forEach((b) => {
          // В реальном проекте тут была бы проверка b.hasParking
          for (let d = b.depth; d >= 1; d--)
            list.push({
              id: `base_${b.id}_L${d}`,
              label: `Подвал -${d}`,
              sortOrder: -100 - d,
            });
        });
    }

    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [building, blockDetails, basements, currentBlock]);

  // --- Логика ---

  // Кол-во мест на уровне (храним отдельно, чтобы знать сколько рисовать)
  const getLevelCount = (levelId) => {
    const key = `${currentBlock.fullId}_${levelId}_meta`;
    return parseInt(parkingPlaces[key]?.count || 0);
  };

  const setLevelCount = (levelId, count) => {
    const key = `${currentBlock.fullId}_${levelId}_meta`;
    setParkingPlaces((prev) => ({
      ...prev,
      [key]: { count: count },
    }));
  };

  const getPlace = (levelId, idx, field) => {
    const key = `${currentBlock.fullId}_${levelId}_place${idx}`;
    return parkingPlaces[key]?.[field] || '';
  };

  const setPlace = (levelId, idx, field, val) => {
    const key = `${currentBlock.fullId}_${levelId}_place${idx}`;
    setParkingPlaces((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: val },
    }));
  };

  // Авто-генерация мест (задает дефолтную площадь и номера)
  const generatePlaces = (levelId) => {
    const count = getLevelCount(levelId);
    if (count <= 0) return;

    const updates = {};
    // Находим последний номер, чтобы продолжать нумерацию (упрощенно - начнем с 1 для каждого этажа или сквозную)
    // Для простоты сделаем префикс уровня: P-1-01

    for (let i = 0; i < count; i++) {
      const key = `${currentBlock.fullId}_${levelId}_place${i}`;
      if (!parkingPlaces[key]) {
        updates[key] = {
          number: `${i + 1}`,
          area: '13.25',
        };
      }
    }
    setParkingPlaces((p) => ({ ...p, ...updates }));
  };

  return (
    <div className="space-y-6 pb-20 max-w-full mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
        <div className="flex gap-4 items-center">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {building.label}
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase">
              Машиноместа
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              saveData();
              onBack();
            }}
          >
            <Save size={14} /> Готово
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {blocksList.map((b, i) => (
          <TabButton
            key={b.id}
            active={activeBlockIndex === i}
            onClick={() => setActiveBlockIndex(i)}
          >
            Блок {i + 1} ({b.type})
          </TabButton>
        ))}
      </div>

      {parkingLevels.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed rounded-2xl text-slate-400">
          <Car size={48} className="mx-auto mb-4 opacity-50" />
          <p>В этом блоке нет парковочных уровней.</p>
          <p className="text-xs mt-2">
            Добавьте подвал в Конфигураторе или выберите Тип здания "Отдельный
            паркинг".
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {parkingLevels.map((lvl) => {
            const count = getLevelCount(lvl.id);
            return (
              <Card key={lvl.id} className="p-6">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-500 text-xs">
                      {lvl.label}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase">
                        Количество мест
                      </div>
                      <input
                        type="number"
                        className="font-bold text-lg text-slate-800 outline-none w-24 border-b border-transparent focus:border-blue-500 bg-transparent placeholder:text-slate-300"
                        placeholder="0"
                        value={count || ''}
                        onChange={(e) =>
                          setLevelCount(lvl.id, parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => generatePlaces(lvl.id)}
                    className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                  >
                    <Grip size={14} /> Сформировать сетку
                  </button>
                </div>

                {count > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {Array.from({ length: count }).map((_, idx) => (
                      <div
                        key={idx}
                        className="p-2 border rounded-xl bg-slate-50 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
                          <Hash size={10} className="text-slate-400" />
                          <DebouncedInput
                            className="w-full text-xs font-bold bg-transparent outline-none text-slate-700"
                            placeholder="№"
                            value={getPlace(lvl.id, idx, 'number')}
                            onChange={(v) => setPlace(lvl.id, idx, 'number', v)}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-bold">
                            S:
                          </span>
                          <DebouncedInput
                            className="w-full text-xs font-bold bg-transparent outline-none text-blue-600"
                            placeholder="0.00"
                            value={getPlace(lvl.id, idx, 'area')}
                            onChange={(v) => setPlace(lvl.id, idx, 'area', v)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
