# Предложения по размещению UJ-идентификаторов в UI

## Текущее состояние ✅

### Уже реализовано:

1. **PassportEditor** — UJ-код проекта в заголовке
2. **CompositionEditor** — building_code рядом с названием здания
3. **ApartmentsRegistry** — unit_code под номером квартиры

---

## Предложения по дополнительному размещению

### 🎯 КРИТИЧНО (Высокий приоритет)

#### 1. **ApplicationsDashboard** — Главный дашборд проектов

**Где:** В списке проектов/заявок

**Предложение:**
```jsx
// В строке проекта добавить UJ-код перед названием или после него
<div className="flex items-center gap-2">
  {project.ujCode && (
    <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 
                     text-blue-700 text-xs font-mono font-bold">
      {project.ujCode}
    </span>
  )}
  <span className="font-bold">{project.name}</span>
</div>
```

**Обоснование:**
- Основная точка входа в систему
- Пользователь сразу видит идентификатор проекта
- Удобно для поиска и навигации
- Можно копировать для использования в других системах

**Макет:**
```
╔════════════════════════════════════════════════╗
║  UJ000001  | ЖК Солнечный                      ║
║  Статус: В работе | Тимур | Шаг 3 из 17       ║
╚════════════════════════════════════════════════╝
```

---

#### 2. **Sidebar** — Боковая навигация

**Где:** В блоке информации о проекте (под названием)

**Предложение:**
```jsx
<div className="p-6 pb-2">
  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
    Объект
  </div>
  <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">
    {complexInfo?.name || 'Новый проект'}
  </h2>
  
  {/* ДОБАВИТЬ */}
  {complexInfo?.ujCode && (
    <div className="mt-2 inline-flex px-2 py-1 rounded bg-blue-600/20 
                    border border-blue-400/30 text-blue-200 text-[10px] 
                    font-mono font-bold">
      {complexInfo.ujCode}
    </div>
  )}
  
  <div className="text-xs text-slate-500 mt-1 truncate">
    {complexInfo?.street || 'Адрес не указан'}
  </div>
</div>
```

**Обоснование:**
- Постоянно видимый элемент на всех шагах
- Контекст текущего проекта
- Не занимает много места

**Макет:**
```
┌─────────────────────┐
│ ОБЪЕКТ              │
│ ЖК Солнечный        │
│ [UJ000001]          │
│ ул. Навои, 12       │
│                     │
│ Прогресс: 35%       │
└─────────────────────┘
```

---

#### 3. **WorkflowBar** — Панель управления процессом

**Где:** В заголовке рядом с названием проекта

**Предложение:**
```jsx
<div className="flex items-center gap-3">
  <h1 className="text-lg font-bold text-slate-800">
    {complexInfo?.name}
  </h1>
  
  {/* ДОБАВИТЬ */}
  {complexInfo?.ujCode && (
    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 
                     text-slate-600 text-xs font-mono">
      {complexInfo.ujCode}
    </span>
  )}
</div>
```

**Обоснование:**
- Верхняя панель всегда видима
- Контекст для всех действий workflow
- Удобно для скриншотов и документации

---

#### 4. **CommercialRegistry** — Реестр коммерции

**Где:** В колонке с номером помещения (аналогично квартирам)

**Предложение:**
```jsx
<td className="p-4 text-center relative border-x border-emerald-100">
  <div className="flex flex-col items-center gap-0.5">
    <span className="font-black text-slate-800 text-lg">{item.number}</span>
    
    {/* ДОБАВИТЬ */}
    {item.unitCode && (
      <span className="text-[9px] font-mono font-bold text-emerald-600 
                       bg-emerald-100 px-1.5 py-0.5 rounded">
        {item.unitCode}
      </span>
    )}
  </div>
</td>
```

**Обоснование:**
- Единый стиль со всеми реестрами
- Идентификация коммерческих помещений
- Важно для интеграции и отчётности

---

#### 5. **ParkingRegistry** — Реестр паркинга

**Где:** В колонке с номером места (аналогично квартирам)

**Предложение:**
```jsx
<td className="p-4 text-center relative border-x border-blue-100">
  <div className="flex flex-col items-center gap-0.5">
    <span className="font-black text-slate-800 text-lg">{item.number}</span>
    
    {/* ДОБАВИТЬ */}
    {item.unitCode && (
      <span className="text-[9px] font-mono font-bold text-blue-600 
                       bg-blue-100 px-1.5 py-0.5 rounded">
        {item.unitCode}
      </span>
    )}
  </div>
</td>
```

**Обоснование:**
- Единообразие с другими реестрами
- Учёт машиномест для отчётности
- Важно для договоров и регистрации

---

### 📊 ПОЛЕЗНО (Средний приоритет)

#### 6. **ConfigHeader** — Заголовок конфигуратора здания

**Где:** В шапке конфигуратора рядом с названием здания

**Предложение:**
```jsx
<div className="flex items-center gap-3">
  <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
    <BuildingIcon size={28} className="text-blue-600" />
    {building.label}
    
    {/* ДОБАВИТЬ */}
    {building.buildingCode && (
      <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 
                       text-blue-700 text-sm font-mono">
        {building.buildingCode}
      </span>
    )}
  </h1>
</div>
```

**Обоснование:**
- Контекст при работе с конкретным зданием
- Удобно при переключении между зданиями
- Визуальная идентификация

**Макет:**
```
╔═══════════════════════════════════════╗
║ 🏢 Корпус А  [ZR01]                  ║
║ Жилой дом | 10 этажей | 2 подъезда   ║
╚═══════════════════════════════════════╝
```

---

#### 7. **Breadcrumbs** — Хлебные крошки

**Где:** В навигационной цепочке

**Предложение:**
```jsx
<Breadcrumbs>
  <span>Проекты</span>
  <span>{projectName} ({ujCode})</span>
  <span>Здание {buildingLabel} ({buildingCode})</span>
</Breadcrumbs>
```

**Обоснование:**
- Полный путь с идентификаторами
- Удобно для навигации
- Понятная иерархия

**Макет:**
```
Проекты > ЖК Солнечный (UJ000001) > Корпус А (ZR01) > Конфигурация
```

---

#### 8. **IntegrationBuildings/Units** — Шаги интеграции

**Где:** В списках объектов на интеграцию

**Предложение:**
```jsx
// В списке зданий для интеграции
<div className="flex items-center justify-between p-4 border rounded-lg">
  <div>
    <div className="font-bold">{building.label}</div>
    <div className="text-xs text-slate-500">{building.buildingCode}</div>
  </div>
  <StatusBadge />
</div>

// В списке помещений
<div className="flex items-center justify-between p-4 border rounded-lg">
  <div>
    <div className="font-bold">Квартира {unit.number}</div>
    <div className="text-xs text-slate-500">
      {formatFullIdentifier(projectCode, buildingCode, unit.unitCode)}
    </div>
  </div>
  <StatusBadge />
</div>
```

**Обоснование:**
- Критично для интеграции с внешними системами
- Полный идентификатор для отправки в УЗКАД
- Отслеживание статуса регистрации

---

#### 9. **SummaryDashboard** — Итоговая сводная

**Где:** В карточках статистики и графиках

**Предложение:**
```jsx
// В заголовке дашборда
<div className="mb-6">
  <h1 className="text-2xl font-bold">
    Сводная по проекту {complexInfo.name}
  </h1>
  <div className="text-sm text-slate-500 mt-1">
    Идентификатор проекта: <span className="font-mono font-bold">{complexInfo.ujCode}</span>
  </div>
</div>

// В экспорте/печати
<button onClick={() => exportReport(complexInfo.ujCode)}>
  Экспорт отчёта
</button>
```

**Обоснование:**
- Идентификация в отчётах
- Экспорт данных с привязкой к проекту
- Печать документации

---

### 💡 ОПЦИОНАЛЬНО (Низкий приоритет)

#### 10. **HistoryModal** — История изменений

**Где:** В заголовке модального окна

**Предложение:**
```jsx
<div className="text-sm text-slate-500">
  История заявки <span className="font-mono">{applicationInfo.ujCode}</span>
</div>
```

---

#### 11. **Tooltip при наведении**

**Где:** При наведении на любой идентификатор

**Предложение:**
```jsx
<Tooltip content={
  <div>
    <div>Полный идентификатор:</div>
    <div className="font-mono mt-1">{fullIdentifier}</div>
    <div className="text-xs mt-2 text-slate-400">
      Нажмите, чтобы скопировать
    </div>
  </div>
}>
  <button onClick={() => copyToClipboard(fullIdentifier)}>
    {identifierCode}
  </button>
</Tooltip>
```

**Обоснование:**
- Удобство копирования
- Показ полного идентификатора
- Улучшенный UX

---

#### 12. **Поле поиска** — Расширенный поиск

**Где:** В главном дашборде и реестрах

**Предложение:**
```jsx
<Input 
  placeholder="Поиск по номеру, названию или коду (UJ000001, ZR01, EF001)..."
  value={searchTerm}
  onChange={handleSearch}
/>

// Логика поиска
const filtered = items.filter(item => {
  const searchLower = searchTerm.toLowerCase();
  return (
    item.name?.toLowerCase().includes(searchLower) ||
    item.ujCode?.toLowerCase().includes(searchLower) ||
    item.buildingCode?.toLowerCase().includes(searchLower) ||
    item.unitCode?.toLowerCase().includes(searchLower)
  );
});
```

**Обоснование:**
- Быстрый поиск по идентификаторам
- Удобство работы с большими проектами
- Интеграция с внешними системами

---

## Цветовая схема и стили

### Рекомендуемые стили для идентификаторов:

```css
/* UJ-коды проектов (голубой) */
.uj-code {
  background: rgb(239 246 255); /* bg-blue-50 */
  border: 1px solid rgb(191 219 254); /* border-blue-200 */
  color: rgb(29 78 216); /* text-blue-700 */
}

/* Building-коды (синий) */
.building-code {
  background: rgb(239 246 255); /* bg-blue-50 */
  border: 1px solid rgb(191 219 254); /* border-blue-200 */
  color: rgb(29 78 216); /* text-blue-700 */
}

/* Unit-коды квартир (голубой) */
.unit-code-flat {
  background: rgb(239 246 255); /* bg-blue-100 */
  color: rgb(37 99 235); /* text-blue-600 */
}

/* Unit-коды коммерции (зелёный) */
.unit-code-commercial {
  background: rgb(236 253 245); /* bg-emerald-100 */
  color: rgb(5 150 105); /* text-emerald-600 */
}

/* Unit-коды паркинга (синий) */
.unit-code-parking {
  background: rgb(239 246 255); /* bg-blue-100 */
  color: rgb(37 99 235); /* text-blue-600 */
}

/* Общие стили */
.identifier {
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.625rem; /* 10px */
  letter-spacing: 0.025em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}

.identifier:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

---

## Приоритизация внедрения

### Фаза 1: Критичные элементы (1-2 дня)
- ✅ PassportEditor (готово)
- ✅ CompositionEditor (готово)
- ✅ ApartmentsRegistry (готово)
- 🔲 ApplicationsDashboard
- 🔲 Sidebar
- 🔲 WorkflowBar

### Фаза 2: Реестры (1 день)
- 🔲 CommercialRegistry
- 🔲 ParkingRegistry
- 🔲 IntegrationBuildings
- 🔲 IntegrationUnits

### Фаза 3: Дополнительные места (1 день)
- 🔲 ConfigHeader
- 🔲 SummaryDashboard
- 🔲 Breadcrumbs
- 🔲 Поиск по кодам

### Фаза 4: UX улучшения (опционально)
- 🔲 Tooltip с копированием
- 🔲 HistoryModal
- 🔲 Расширенный поиск

---

## Технические рекомендации

### 1. Создать переиспользуемый компонент

```jsx
// src/components/ui/IdentifierBadge.jsx
export const IdentifierBadge = ({ 
  code, 
  type = 'project', // 'project' | 'building' | 'unit'
  variant = 'default', // 'default' | 'compact' | 'large'
  showCopy = true 
}) => {
  const styles = {
    project: 'bg-blue-50 border-blue-200 text-blue-700',
    building: 'bg-blue-50 border-blue-200 text-blue-700',
    unit: 'bg-blue-100 text-blue-600',
  };
  
  const sizes = {
    compact: 'text-[9px] px-1.5 py-0.5',
    default: 'text-[10px] px-2 py-0.5',
    large: 'text-xs px-2.5 py-1',
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success('Код скопирован');
  };
  
  return (
    <span 
      onClick={showCopy ? handleCopy : undefined}
      className={`
        inline-flex items-center rounded border font-mono font-bold
        ${styles[type]} ${sizes[variant]}
        ${showCopy && 'cursor-pointer hover:scale-105 transition-transform'}
      `}
      title={showCopy ? 'Нажмите, чтобы скопировать' : code}
    >
      {code}
    </span>
  );
};

// Использование
<IdentifierBadge code="UJ000001" type="project" />
<IdentifierBadge code="ZR01" type="building" variant="compact" />
<IdentifierBadge code="EF001" type="unit" showCopy={false} />
```

### 2. Добавить хелпер для форматирования

```jsx
// src/lib/ui-formatters.js
import { formatFullIdentifier } from './uj-identifier';

export const formatDisplayIdentifier = (project, building, unit) => {
  if (unit?.unitCode) {
    return formatFullIdentifier(
      project?.ujCode, 
      building?.buildingCode, 
      unit.unitCode
    );
  }
  if (building?.buildingCode) {
    return formatFullIdentifier(project?.ujCode, building.buildingCode);
  }
  return project?.ujCode || '';
};
```

### 3. Обновить типы (TypeScript/JSDoc)

```javascript
/**
 * @typedef {Object} ProjectIdentifier
 * @property {string} ujCode - UJ-код проекта (UJ000000)
 */

/**
 * @typedef {Object} BuildingIdentifier
 * @property {string} buildingCode - Код здания (ZR01, ZM01, ZP01, ZI01)
 */

/**
 * @typedef {Object} UnitIdentifier
 * @property {string} unitCode - Код помещения (EF001, EO001, EP001)
 */
```

---

## Примеры интеграции

### Пример 1: ApplicationsDashboard

```jsx
// В списке проектов
{projects.map(project => (
  <div key={project.id} className="p-4 border rounded-lg hover:bg-blue-50">
    <div className="flex items-center gap-3">
      {/* UJ-код */}
      {project.ujCode && (
        <IdentifierBadge 
          code={project.ujCode} 
          type="project" 
          variant="default" 
        />
      )}
      
      {/* Название */}
      <h3 className="font-bold text-lg">{project.name}</h3>
    </div>
    
    <div className="mt-2 text-sm text-slate-600">
      {project.complexInfo.street}
    </div>
  </div>
))}
```

### Пример 2: Sidebar

```jsx
// В блоке информации о проекте
<div className="p-6 pb-2">
  <div className="flex items-center justify-between mb-2">
    <span className="text-[10px] font-bold text-slate-500 uppercase">
      Объект
    </span>
    {complexInfo?.ujCode && (
      <IdentifierBadge 
        code={complexInfo.ujCode} 
        type="project" 
        variant="compact" 
      />
    )}
  </div>
  
  <h2 className="text-sm font-bold text-white">
    {complexInfo?.name}
  </h2>
</div>
```

---

## Итого

### Всего предложено мест: **12**
### Критичных: **6**
### Полезных: **4**
### Опциональных: **2**

### Оценка трудозатрат:
- Фаза 1 (критичные): **1-2 дня**
- Фаза 2 (реестры): **1 день**
- Фаза 3 (дополнительные): **1 день**
- Фаза 4 (UX): **0.5-1 день**

**Общая оценка: 3.5-5 дней разработки**

---

**Автор:** AI Assistant  
**Дата:** 9 февраля 2026  
**Версия:** 1.0
