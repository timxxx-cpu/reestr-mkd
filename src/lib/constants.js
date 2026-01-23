import { 
  LayoutDashboard, ListPlus, Warehouse, Building2, 
  ParkingSquare, Grid, DoorOpen, Armchair, Key, 
  PieChart, TableProperties 
} from 'lucide-react';

export const STEPS_CONFIG = [
  { id: 'passport', title: "Жилой комплекс", desc: "Паспорт", icon: LayoutDashboard },
  { id: 'composition', title: "Состав комплекса", desc: "Перечень строений", icon: ListPlus },
  
  // 1. Настройка структуры (Конфигураторы)
  { id: 'registry_nonres', title: "Нежилые и Инфра", desc: "Конфигурация", icon: Warehouse },
  { id: 'registry_res', title: "Жилые блоки", desc: "Конфигурация", icon: Building2 },

  // 2. Наполнение данными
  { id: 'parking_config', title: "Конфигурация паркингов", desc: "Зоны парковки", icon: ParkingSquare },
  { id: 'floors', title: "Внешняя инвентаризация", desc: "Матрица этажей", icon: Grid },
  { id: 'entrances', title: "Подъезды", desc: "Входы", icon: DoorOpen },
  { id: 'mop', title: "Места общего пользования", desc: "Инвентаризация", icon: Armchair },
  { id: 'apartments', title: "Квартиры", desc: "Нумерация", icon: Key },

  // 3. Сводные реестры (Теперь они здесь, когда данные уже есть)
  { id: 'registry_nonres_view', title: "Реестр Инфра (Свод)", desc: "ТЭП Инфра", icon: TableProperties },
  { id: 'registry_res_view', title: "Реестр ЖФ (Свод)", desc: "ТЭП Жилье", icon: TableProperties },

  // 4. Финальный дашборд
  { id: 'summary', title: "Сводные данные", desc: "Дашбоард", icon: PieChart }
];