import { 
  LayoutDashboard, ListPlus, Warehouse, Building2, 
  ParkingSquare, Grid, DoorOpen, Armchair, Key, 
  CarFront, PieChart 
} from 'lucide-react';

export const STEPS_CONFIG = [
  { id: 'passport', title: "Жилой комплекс", desc: "Паспорт", icon: LayoutDashboard },
  { id: 'composition', title: "Состав комплекса", desc: "Перечень строений", icon: ListPlus },
  { id: 'registry_nonres', title: "Нежилые блоки и Объекты инфраструктуры", desc: "Конфигурация", icon: Warehouse },
  { id: 'registry_res', title: "Жилые блоки", desc: "Конфигурация", icon: Building2 },
  { id: 'parking_config', title: "Конфигурация паркингов", desc: "Зоны парковки", icon: ParkingSquare },
  { id: 'floors', title: "Внешняя инвентаризация", desc: "Матрица этажей", icon: Grid },
  { id: 'entrances', title: "Подъезды", desc: "Входы", icon: DoorOpen },
  { id: 'mop', title: "МОП", desc: "Инвентаризация", icon: Armchair },
  { id: 'apartments', title: "Квартиры", desc: "Нумерация", icon: Key },
  { id: 'parking', title: "Паркинг", desc: "Машиноместа", icon: CarFront },
  { id: 'summary', title: "Сводка", desc: "Дашбоард", icon: PieChart }
];