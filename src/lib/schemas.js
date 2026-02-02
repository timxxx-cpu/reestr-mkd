import { z } from 'zod';

// --- Базовые типы ---

export const MopItemSchema = z.object({
  id: z.string().uuid().optional(), // Делаем optional для валидации при вводе, но в коде будем генерировать
  type: z.string().min(1, "Тип обязателен"),
  area: z.coerce.number().nonnegative("Площадь должна быть >= 0"),
  buildingId: z.string().uuid().optional(), // Связь с зданием
});

export const UnitSchema = z.object({
  id: z.string().uuid().optional(),
  num: z.string(),
  area: z.coerce.number().optional(),
  type: z.enum(['flat', 'office', 'pantry', 'duplex_up', 'duplex_down']).default('flat'),
  rooms: z.number().int().optional(),
  // Внешние ключи для будущего SQL
  buildingId: z.string().uuid().optional(),
  blockId: z.string().optional(),
  floorId: z.string().optional(),
  entranceId: z.number().int().optional(),
});

export const FloorDataSchema = z.object({
  id: z.string().uuid().optional(),
  height: z.coerce.number().min(0, "Высота не может быть отрицательной"),
  areaProj: z.coerce.number().nonnegative("Площадь не может быть отрицательной"),
  areaFact: z.coerce.number().nonnegative().optional(),
  isDuplex: z.boolean().optional(),
  // Связи
  buildingId: z.string().uuid().optional(),
  blockId: z.string().optional(),
  levelIndex: z.number().int().optional(),
});

export const EntranceDataSchema = z.object({
  apts: z.coerce.number().int().nonnegative("Число квартир >= 0"),
  units: z.coerce.number().int().nonnegative("Число офисов >= 0"),
  mopQty: z.coerce.number().int().nonnegative("Число МОП >= 0"),
});

export const ParkingPlaceSchema = z.object({
  id: z.string().uuid().optional(),
  number: z.string().min(1, "Номер обязателен"),
  area: z.coerce.number().positive("Площадь > 0"),
  isSold: z.boolean().optional(),
  // Связи
  buildingId: z.string().uuid().optional(),
});

export const ParkingLevelConfigSchema = z.object({
  count: z.coerce.number().int().nonnegative("Кол-во мест должно быть целым числом >= 0"),
});

export const ParticipantSchema = z.object({
  name: z.string().optional(),
  inn: z.string().regex(/^\d{9,12}$/, "ИНН должен содержать от 9 до 12 цифр").optional().or(z.literal('')),
  loading: z.boolean().optional()
});

export const ComplexInfoSchema = z.object({
  name: z.string().min(3, "Название должно быть не короче 3 символов"),
  status: z.enum(['Проектный', 'Строящийся', 'Готовый к вводу', 'Введенный', 'Архив']).default('Проектный'),
  region: z.string().optional(),
  district: z.string().optional(),
  street: z.string().min(5, "Укажите корректный адрес"),
  landmark: z.string().optional(),
  dateStartProject: z.string().optional(),
  dateEndProject: z.string().optional(),
  dateStartFact: z.string().optional(),
  dateEndFact: z.string().optional(),
}).refine(data => {
  if (data.dateStartProject && data.dateEndProject) {
    return new Date(data.dateEndProject) > new Date(data.dateStartProject);
  }
  return true;
}, {
  message: "Дата окончания должна быть позже даты начала",
  path: ["dateEndProject"] 
});

export const BuildingModalSchema = z.object({
  baseName: z.string().min(1, "Наименование обязательно"),
  houseNumber: z.string().min(1, "Номер дома обязателен"),
  category: z.string(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  stage: z.string(),
  quantity: z.coerce.number().int().min(1).max(20),
  resBlocks: z.coerce.number().int().min(0),
  nonResBlocks: z.coerce.number().int().min(0),
  hasNonResPart: z.boolean().optional(),
  parkingType: z.string().optional(),
  parkingConstruction: z.string().optional(),
  infraType: z.string().optional(),
});

export const BuildingConfigSchema = z.object({
  floorsFrom: z.coerce.number().int().min(1, "Минимум 1 этаж"),
  floorsTo: z.coerce.number().int().min(1, "Минимум 1 этаж").max(100, "Максимум 100 этажей"),
  entrances: z.coerce.number().int().min(1, "Минимум 1 подъезд").max(30, "Максимум 30 подъездов"),
  inputs: z.coerce.number().int().min(1).optional(),
  vehicleEntries: z.coerce.number().int().min(1).optional(),
  elevators: z.coerce.number().int().min(0).optional(),
  levelsDepth: z.coerce.number().int().min(1).max(10).optional(),
  floorsCount: z.coerce.number().int().min(1).optional(),
  foundation: z.string().optional(),
  walls: z.string().optional(),
  slabs: z.string().optional(),
  roof: z.string().optional(),
  seismicity: z.coerce.number().int().min(1, "Мин. 1 балл").max(9, "Макс. 9 баллов").optional(),
  
  hasCustomAddress: z.boolean().optional(),
  customHouseNumber: z.string().optional(),

  hasBasementFloor: z.boolean().optional(),
  hasAttic: z.boolean().optional(),
  hasLoft: z.boolean().optional(),
  hasExploitableRoof: z.boolean().optional(),
}).refine(data => {
  if (data.floorsFrom > data.floorsTo) return false;
  return true;
}, {
  message: "Первый этаж не может быть выше последнего",
  path: ["floorsFrom"]
});

export const BuildingMetaSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, "Название обязательно"),
  houseNumber: z.string(),
  type: z.string(),
  category: z.enum(['residential', 'residential_multiblock', 'parking_separate', 'infrastructure']),
  stage: z.enum(['Проектный', 'Строящийся', 'Введенный', 'Архив']),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  resBlocks: z.number().int().default(0),
  nonResBlocks: z.number().int().default(0),
  hasNonResPart: z.boolean().optional(),
  parkingType: z.string().optional(),
  constructionType: z.string().optional(),
  infraType: z.string().optional(),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3, "Минимум 3 символа"),
  status: z.string(),
  author: z.string().optional(),
  lastModified: z.string().datetime().optional(),
  complexInfo: z.record(z.string(), z.any()).optional(),
  composition: z.array(BuildingMetaSchema).default([]),
});