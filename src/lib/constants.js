import {
  FileText,
  Layout,
  Warehouse,
  Ruler,
  DoorOpen,
  Grid3X3,
  BarChart3,
  Table2,
  Car,
  PaintBucket,
  Building2,
  Home,
  Briefcase,
  Globe,
  Database,
} from 'lucide-react';

// --- 1. РОЛЕВАЯ МОДЕЛЬ ---
export const ROLES = {
  TECHNICIAN: 'technician', // Техник-инвентаризатор (Ввод данных)
  CONTROLLER: 'controller', // Бригадир-контроллер (Проверка)
  BRANCH_MANAGER: 'branch_manager', // Начальник филиала (Управление заявлениями)
  ADMIN: 'admin', // Администратор (Полный доступ)
};

// --- 2. СТАТУСЫ ЗАЯВЛЕНИЯ (Внешние — видны пользователю) ---
export const APP_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS', // В работе (объединяет бывшие NEW, DRAFT, REVIEW, APPROVED, REJECTED, INTEGRATION)
  COMPLETED: 'COMPLETED', // Завершено
  DECLINED: 'DECLINED', // Отказано
};

// Настройки отображения внешних статусов (цвета, названия)
export const APP_STATUS_LABELS = {
  [APP_STATUS.IN_PROGRESS]: {
    label: 'В работе',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  [APP_STATUS.COMPLETED]: {
    label: 'Завершено',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  [APP_STATUS.DECLINED]: {
    label: 'Отказано',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
};

// --- 2b. ПОДСТАТУСЫ WORKFLOW (Внутренние — для workflow-движка) ---
export const WORKFLOW_SUBSTATUS = {
  DRAFT: 'DRAFT', // Техник работает с данными
  REVIEW: 'REVIEW', // Отправлено на проверку контролеру
  REVISION: 'REVISION', // Возвращено контролером на доработку
  PENDING_DECLINE: 'PENDING_DECLINE', // Техник запросил отказ — на рассмотрении у начальника филиала
  RETURNED_BY_MANAGER: 'RETURNED_BY_MANAGER', // Начальник филиала вернул технику на доработку
  INTEGRATION: 'INTEGRATION', // Этап интеграции с УЗКАД
  DONE: 'DONE', // Все шаги пройдены (внешний: COMPLETED)
  DECLINED_BY_ADMIN: 'DECLINED_BY_ADMIN', // Отказано администратором
  DECLINED_BY_CONTROLLER: 'DECLINED_BY_CONTROLLER', // Отказано контролером
  DECLINED_BY_MANAGER: 'DECLINED_BY_MANAGER', // Отказано начальником филиала
};

// Настройки отображения подстатусов (цвета, названия)
export const SUBSTATUS_LABELS = {
  [WORKFLOW_SUBSTATUS.DRAFT]: {
    label: 'Ввод данных',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  [WORKFLOW_SUBSTATUS.REVIEW]: {
    label: 'На проверке',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  [WORKFLOW_SUBSTATUS.REVISION]: {
    label: 'На доработке',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  [WORKFLOW_SUBSTATUS.PENDING_DECLINE]: {
    label: 'Запрос на отказ',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  [WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER]: {
    label: 'Возвращено начальником',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  [WORKFLOW_SUBSTATUS.INTEGRATION]: {
    label: 'Интеграция',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  [WORKFLOW_SUBSTATUS.DONE]: {
    label: 'Завершено',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  [WORKFLOW_SUBSTATUS.DECLINED_BY_ADMIN]: {
    label: 'Отказано (админ)',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  [WORKFLOW_SUBSTATUS.DECLINED_BY_CONTROLLER]: {
    label: 'Отказано (контролер)',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  [WORKFLOW_SUBSTATUS.DECLINED_BY_MANAGER]: {
    label: 'Отказано (нач. филиала)',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
};

// Маппинг подстатуса → внешний статус
export const SUBSTATUS_TO_STATUS = {
  [WORKFLOW_SUBSTATUS.DRAFT]: APP_STATUS.IN_PROGRESS,
  [WORKFLOW_SUBSTATUS.REVIEW]: APP_STATUS.IN_PROGRESS,
  [WORKFLOW_SUBSTATUS.REVISION]: APP_STATUS.IN_PROGRESS,
  [WORKFLOW_SUBSTATUS.PENDING_DECLINE]: APP_STATUS.IN_PROGRESS,
  [WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER]: APP_STATUS.IN_PROGRESS,
  [WORKFLOW_SUBSTATUS.INTEGRATION]: APP_STATUS.IN_PROGRESS,
  [WORKFLOW_SUBSTATUS.DONE]: APP_STATUS.COMPLETED,
  [WORKFLOW_SUBSTATUS.DECLINED_BY_ADMIN]: APP_STATUS.DECLINED,
  [WORKFLOW_SUBSTATUS.DECLINED_BY_CONTROLLER]: APP_STATUS.DECLINED,
  [WORKFLOW_SUBSTATUS.DECLINED_BY_MANAGER]: APP_STATUS.DECLINED,
};

// --- 2c. СТАТУСЫ ВЕРСИЙ ОБЪЕКТОВ ---
export const VERSION_STATUS = {
  PENDING: 'PENDING',
  CURRENT: 'CURRENT',
  REJECTED: 'REJECTED',
  PREVIOUS: 'PREVIOUS',

  // Legacy aliases (backward compatibility)
  ACTUAL: 'CURRENT',
  IN_WORK: 'PENDING',
  DECLINED: 'REJECTED',
  ARCHIVED: 'PREVIOUS',
};

export const VERSION_STATUS_LABELS = {
  [VERSION_STATUS.CURRENT]: {
    label: 'Текущая',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  [VERSION_STATUS.PENDING]: {
    label: 'В ожидании',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  [VERSION_STATUS.REJECTED]: {
    label: 'Отклонена',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  [VERSION_STATUS.PREVIOUS]: {
    label: 'Предыдущая',
    color: 'bg-slate-100 text-slate-500 border-slate-200',
  },

  // Legacy labels mapping
  ACTUAL: {
    label: 'Текущая',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  IN_WORK: {
    label: 'В ожидании',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  DECLINED: {
    label: 'Отклонена',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  ARCHIVED: {
    label: 'Предыдущая',
    color: 'bg-slate-100 text-slate-500 border-slate-200',
  },
};

// --- КОНФИГУРАЦИЯ ЭТАПОВ ПРОВЕРКИ ---
// lastStepIndex - индекс шага в STEPS_CONFIG, после которого нужно отправлять на проверку
export const WORKFLOW_STAGES = {
  // Этап 1: До инвентаризации подъездов (шаг 5) включительно
  1: { lastStepIndex: 5, label: 'Этап 1: Инвентаризация' },

  // Этап 2: Нумерация, МОП, Паркинг (до шага 8)
  2: { lastStepIndex: 8, label: 'Этап 2: Конфигурация' },

  // Этап 3: Реестры (до шага 11)
  3: { lastStepIndex: 11, label: 'Этап 3: Реестры' },

  // Этап 4: Финал (до конца списка)
  4: { lastStepIndex: 16, label: 'Финал: Интеграция' },
};

// --- 3. СТАТУСЫ ВНУТРЕННИХ ОБЪЕКТОВ (Зданий, помещений) ---
export const OBJECT_STATUS = {
  NEW: 'NEW', // Только создан
  EDITED: 'EDITED', // Изменен
  VERIFIED: 'VERIFIED', // Проверен контролером
};

// --- 4. ВНЕШНИЕ СИСТЕМЫ ---
export const EXTERNAL_SYSTEMS = {
  DXM: { id: 'DXM', label: 'ДХМ (Центры госуслуг)' },
  EPIGU: { id: 'EPIGU', label: 'ЕПИГУ (my.gov.uz)' },
  ESCROW: { id: 'ESCROW', label: 'ЭСКРОУ' },
  SHAFOF: { id: 'SHAFOF', label: 'Шаффоф Курилиш' },
};

// --- 5. КОНФИГУРАЦИЯ ШАГОВ ---
export const STEPS_CONFIG = [
  // --- 1. ВВОДНЫЕ ДАННЫЕ ---
  {
    id: 'passport',
    title: 'Паспорт жилого комплекса',
    description: 'Основные данные и участники',
    icon: FileText,
  },
  {
    id: 'composition',
    title: 'Здания и сооружения комплекса',
    description: 'Список зданий и сооружений',
    icon: Layout,
  },

  // --- 2. ВВОД ДАННЫХ: НЕЖИЛЫЕ ---
  {
    id: 'registry_nonres',
    title: 'Нежилые блоки и инфраструктура',
    description: 'Школы, сады, КПП',
    icon: Warehouse,
  },

  // --- 3. ВВОД ДАННЫХ: ЖИЛЬЕ ---
  {
    id: 'registry_res',
    title: 'Жилые блоки',
    description: 'Конфигурация корпусов',
    icon: Building2,
  },
  {
    id: 'floors',
    title: 'Внешняя инвентаризация',
    description: 'Высоты и площади этажей',
    icon: Ruler,
  },
  {
    id: 'entrances',
    title: 'Инвентаризация подъездов',
    description: 'Квартирография на этаже',
    icon: DoorOpen,
  }, // -> CHECKPOINT 1 (Индекс 5)

  // --- 2 ЭТАП ---
  {
    id: 'apartments',
    title: 'Нумерация квартир',
    description: 'Реестр помещений (Unit)',
    icon: Grid3X3,
  },
  {
    id: 'mop',
    title: 'Инвентаризация мест общего пользования',
    description: 'МОП и технические помещения',
    icon: PaintBucket,
  },
  {
    id: 'parking_config',
    title: 'Конфигурация паркинга',
    description: 'Уровни и машиноместа',
    icon: Car,
  }, // -> CHECKPOINT 2 (Индекс 8)

  // --- 3 ЭТАП (ФОРМИРОВАНИЕ РЕЕСТРОВ) ---
  {
    id: 'registry_apartments',
    title: 'Реестр квартир',
    description: 'Жилой фонд для регистрации',
    icon: Home,
  },
  {
    id: 'registry_commercial',
    title: 'Реестр нежилых помещений',
    description: 'Коммерция и офисы',
    icon: Briefcase,
  },
  {
    id: 'registry_parking',
    title: 'Реестр машиномест',
    description: 'Парковочные места',
    icon: Car,
  }, // -> CHECKPOINT 3 (Индекс 11)

  // --- 4 ЭТАП: ИНТЕГРАЦИЯ И ФИНАЛ ---

  // [ИЗМЕНЕНО] ИНТЕГРАЦИЯ С УЗКАД ТЕПЕРЬ ИДЕТ ПЕРВОЙ В 4-М ЭТАПЕ
  {
    id: 'integration_buildings',
    title: 'Регистрация зданий (УЗКАД)',
    description: 'Получение кадастровых номеров зданий',
    icon: Globe,
  },
  {
    id: 'integration_units',
    title: 'Регистрация помещений (УЗКАД)',
    description: 'Квартиры, коммерция, паркинг',
    icon: Database,
  },

  // [ИЗМЕНЕНО] СВОДНЫЕ ОТЧЕТЫ СДВИНУТЫ В КОНЕЦ
  {
    id: 'registry_nonres_view',
    title: 'Сводная по нежилым блокам и инфраструктуре',
    description: 'Ведомость сооружений',
    icon: Table2,
  },
  {
    id: 'registry_res_view',
    title: 'Сводная по жилым блокам',
    description: 'Ведомость жилых зданий',
    icon: Table2,
  },
  {
    id: 'summary',
    title: 'Сводная по Жилому комплексу',
    description: 'Аналитика и графики ТЭП',
    icon: BarChart3,
  },
];
