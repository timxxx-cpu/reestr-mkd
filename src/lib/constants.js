import { 
  FileText, Layout, Warehouse, 
  Ruler, DoorOpen, Grid3X3, BarChart3, 
  Table2, Car, PaintBucket, Building2,
  Home, Briefcase
} from 'lucide-react';

// --- 1. РОЛЕВАЯ МОДЕЛЬ ---
export const ROLES = {
    TECHNICIAN: 'technician', // Техник-инвентаризатор (Ввод данных)
    CONTROLLER: 'controller', // Бригадир-контроллер (Проверка)
    ADMIN: 'admin'            // Администратор (Полный доступ)
};

// --- 2. СТАТУСЫ ЗАЯВЛЕНИЯ (Жизненный цикл) ---
export const APP_STATUS = {
    NEW: 'NEW',           // Новая (пришла из внешней системы, еще не взята в работу)
    DRAFT: 'DRAFT',       // Черновик (в работе у Техника)
    REVIEW: 'REVIEW',     // На проверке (отправлена Бригадиру)
    APPROVED: 'APPROVED', // Утверждена (Бригадир принял, работа завершена)
    REJECTED: 'REJECTED', // Отклонена (Бригадир вернул на доработку)
    COMPLETED: 'COMPLETED' // Заявка полностью закрыта (финальный статус)
};

// Настройки отображения статусов (цвета, названия)
export const APP_STATUS_LABELS = {
    [APP_STATUS.NEW]: { label: 'Новая', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    [APP_STATUS.DRAFT]: { label: 'В работе', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    [APP_STATUS.REVIEW]: { label: 'На проверке', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    [APP_STATUS.APPROVED]: { label: 'Принято', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    [APP_STATUS.REJECTED]: { label: 'Возврат', color: 'bg-red-100 text-red-700 border-red-200' },
    [APP_STATUS.COMPLETED]: { label: 'Закрыта', color: 'bg-gray-800 text-white border-gray-900' },
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
    4: { lastStepIndex: 14, label: 'Финал: Закрытие' }        
};

// --- 3. СТАТУСЫ ВНУТРЕННИХ ОБЪЕКТОВ (Зданий, помещений) ---
export const OBJECT_STATUS = {
    NEW: 'NEW',         // Только создан
    EDITED: 'EDITED',   // Изменен
    VERIFIED: 'VERIFIED' // Проверен контролером
};

// --- 4. ВНЕШНИЕ СИСТЕМЫ ---
export const EXTERNAL_SYSTEMS = {
    DXM: { id: 'DXM', label: 'ДХМ (Центры госуслуг)' },
    EPIGU: { id: 'EPIGU', label: 'ЕПИГУ (my.gov.uz)' },
    ESCROW: { id: 'ESCROW', label: 'ЭСКРОУ' },
    SHAFOF: { id: 'SHAFOF', label: 'Шаффоф Курилиш' }
};

// --- 5. КОНФИГУРАЦИЯ ШАГОВ ---
export const STEPS_CONFIG = [
    // --- 1. ВВОДНЫЕ ДАННЫЕ ---
    { 
        id: 'passport', 
        title: 'Паспорт жилого комплекса', 
        description: 'Основные данные и участники',
        icon: FileText 
    },
    { 
        id: 'composition', 
        title: 'Здания и сооружения комплекса', 
        description: 'Список зданий и сооружений',
        icon: Layout 
    },

    // --- 2. ВВОД ДАННЫХ: НЕЖИЛЫЕ ---
    { 
        id: 'registry_nonres', 
        title: 'Нежилые блоки и инфраструктура', 
        description: 'Школы, сады, КПП',
        icon: Warehouse 
    },

    // --- 3. ВВОД ДАННЫХ: ЖИЛЬЕ ---
    { 
        id: 'registry_res', 
        title: 'Жилые блоки', 
        description: 'Конфигурация корпусов',
        icon: Building2 
    },
    { 
        id: 'floors', 
        title: 'Внешняя инвентаризация', 
        description: 'Высоты и площади этажей',
        icon: Ruler 
    },
    { 
        id: 'entrances', 
        title: 'Инвентаризация подъездов', 
        description: 'Квартирография на этаже',
        icon: DoorOpen 
    }, // -> CHECKPOINT 1 (Индекс 5)

    // --- 2 ЭТАП ---
    { 
        id: 'apartments', 
        title: 'Нумерация квартир', 
        description: 'Реестр помещений (Unit)',
        icon: Grid3X3 
    },
    { 
        id: 'mop', 
        title: 'Инвентаризация мест общего пользования', 
        description: 'МОП и технические помещения',
        icon: PaintBucket 
    },
    {
        id: 'parking_config', 
        title: 'Конфигурация паркинга',
        description: 'Уровни и машиноместа',
        icon: Car
    }, // -> CHECKPOINT 2 (Индекс 8)

    // --- 3 ЭТАП (ФОРМИРОВАНИЕ РЕЕСТРОВ) ---
    {
        id: 'registry_apartments',
        title: 'Реестр квартир',
        description: 'Жилой фонд для регистрации',
        icon: Home
    },
    {
        id: 'registry_commercial',
        title: 'Реестр нежилых помещений',
        description: 'Коммерция и офисы',
        icon: Briefcase
    },
    {
        id: 'registry_parking',
        title: 'Реестр машиномест',
        description: 'Парковочные места',
        icon: Car
    }, // -> CHECKPOINT 3 (Индекс 11)

    // --- 4 ЭТАП (ОТЧЕТНОСТЬ И ФИНАЛ) ---
    { 
        id: 'registry_nonres_view', 
        title: 'Сводная по нежилым блокам и инфраструктуре', 
        description: 'Ведомость сооружений',
        icon: Table2 
    },
    { 
        id: 'registry_res_view', 
        title: 'Сводная по жилым блокам', 
        description: 'Ведомость жилых зданий',
        icon: Table2 
    },
    { 
        id: 'summary', 
        title: 'Сводная по Жилому комплексу', 
        description: 'Аналитика и графики ТЭП',
        icon: BarChart3 
    } // -> CHECKPOINT 4 (Индекс 14)
];