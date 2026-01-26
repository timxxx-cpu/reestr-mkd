import { 
  FileText, Layout, Warehouse, 
  Ruler, DoorOpen, Grid3X3, BarChart3, 
  Table2, Car, PaintBucket, Building2
} from 'lucide-react';

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
    },
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

    // --- 4. ВВОД ДАННЫХ: ПАРКИНГ ---
    {
        id: 'parking_config', 
        title: 'Конфигурация паркинга',
        description: 'Уровни и машиноместа',
        icon: Car
    },

    // --- 5. ОТЧЕТНОСТЬ ---
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
    }
];