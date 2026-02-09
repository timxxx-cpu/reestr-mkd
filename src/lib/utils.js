import { Building2, Store, Car, Box } from 'lucide-react';

/**
 * Возвращает список блоков для здания.
 * Работает с реальными объектами блоков (UUID), хранящимися в building.blocks
 * @param {import('./types').BuildingMeta} building
 * @param {Object} [buildingDetails] - Детальные настройки (для получения кастомных адресов)
 */
export function getBlocksList(building, buildingDetails = {}) {
  if (!building) return [];

  // Приоритет: Реальные блоки из БД/Стейта (массив объектов)
  if (building.blocks && Array.isArray(building.blocks) && building.blocks.length > 0) {
    return building.blocks.map((block, index) => {
      // Определяем иконку и подпись для UI
      let Icon = Building2;
      let typeLabel = 'Ж';

      if (block.type === 'residential') {
        Icon = Building2;
        typeLabel = 'Ж';
      } else if (block.type === 'non_residential') {
        Icon = Store;
        typeLabel = 'Н';
      } else if (block.type === 'parking') {
        Icon = Car;
        typeLabel = 'П';
      } else if (block.type === 'infrastructure') {
        Icon = Box;
        typeLabel = 'И';
      }

      // Формируем уникальный ключ для buildingDetails
      // Используем ID блока (UUID)
      const detailsKey = `${building.id}_${block.id}`;
      const details = buildingDetails[detailsKey];

      // Формируем красивое название (tabLabel)
      let displayLabel = block.label;

      // Если есть кастомный номер дома для этого блока
      if (details?.hasCustomAddress && details?.customHouseNumber) {
        displayLabel = `${displayLabel} (№${details.customHouseNumber})`;
      } else if (building.houseNumber) {
        // Если это МКД, добавляем номер дома для контекста
        displayLabel = `${displayLabel} (№${building.houseNumber})`;
      }

      return {
        id: block.id, // Реальный UUID блока
        type: typeLabel, // 'Ж', 'Н' для UI
        index: index,
        fullId: detailsKey, // Ключ для поиска в buildingDetails
        tabLabel: displayLabel,
        icon: Icon,
        originalType: block.type, // Сохраняем оригинальный тип для логики
      };
    });
  }

  // Fallback: Если блоков нет (например, только что созданный объект без блоков или старые данные)
  // Возвращаем заглушку, чтобы UI не падал
  return [
    {
      id: 'main',
      type: 'Основной',
      index: 0,
      fullId: `${building.id}_main`,
      tabLabel: building.label || 'Основной корпус',
      icon: Building2,
      originalType: 'residential',
    },
  ];
}

/**
 * Расчет прогресса строительства в процентах по датам.
 */
export const calculateProgress = (start, end) => {
  if (!start || !end) return 0;
  const total = new Date(end).getTime() - new Date(start).getTime();
  const current = new Date().getTime() - new Date(start).getTime();
  if (total <= 0) return 0;
  const percent = (current / total) * 100;
  return Math.min(100, Math.max(0, percent));
};

/**
 * Возвращает CSS классы для бейджика статуса.
 */
export const getStageColor = stage => {
  switch (stage) {
    case 'Введенный':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Строящийся':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Проектный':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Архив':
      return 'bg-slate-100 text-slate-500 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};
