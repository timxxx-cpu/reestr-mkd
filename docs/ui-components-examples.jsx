/**
 * ГОТОВЫЕ КОМПОНЕНТЫ ДЛЯ UI УЛУЧШЕНИЙ
 * Скопируйте и адаптируйте под ваш проект
 * 
 * Используемые библиотеки:
 * - React
 * - Lucide React (иконки)
 * - Tailwind CSS
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Loader2, CheckCircle2, AlertCircle, ArrowUp, ArrowDown, 
  Info, XCircle, AlertTriangle 
} from 'lucide-react';

// ============================================
// 1. УЛУЧШЕННЫЙ TOOLTIP
// ============================================

/**
 * Tooltip с плавной анимацией и автопозиционированием
 * 
 * @param {React.ReactNode} children - Элемент, для которого показывается tooltip
 * @param {string} content - Текст tooltip
 * @param {string} placement - Позиция: 'top' | 'bottom' | 'left' | 'right'
 */
export function Tooltip({ children, content, placement = 'top' }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const placements = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowPlacements = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800',
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children}
      {isOpen && (
        <div 
          className={`
            absolute ${placements[placement]} z-50
            bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl
            whitespace-nowrap pointer-events-none
            animate-in fade-in duration-200
          `}
        >
          {content}
          <div className={`absolute ${arrowPlacements[placement]} border-4 border-transparent`} />
        </div>
      )}
    </div>
  );
}

// ============================================
// 2. SKELETON LOADER ДЛЯ ТАБЛИЦ
// ============================================

/**
 * Skeleton loader для строк таблицы
 * 
 * @param {number} rows - Количество строк
 * @param {number} cols - Количество колонок
 */
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <tbody>
      {[...Array(rows)].map((_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-slate-100">
          {[...Array(cols)].map((_, colIdx) => (
            <td key={colIdx} className="px-5 py-4">
              <div 
                className="h-4 bg-slate-200 rounded animate-pulse"
                style={{ 
                  width: `${60 + Math.random() * 40}%`,
                  animationDelay: `${rowIdx * 0.1 + colIdx * 0.05}s`
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// Пример использования:
// {isLoading ? <TableSkeleton rows={5} cols={6} /> : <tbody>{data.map(...)}</tbody>}

// ============================================
// 3. УЛУЧШЕННАЯ КНОПКА С СОСТОЯНИЯМИ
// ============================================

/**
 * Кнопка с индикатором загрузки и успеха
 * 
 * @param {string} variant - Стиль: 'primary' | 'secondary' | 'success' | 'danger'
 * @param {boolean} loading - Состояние загрузки
 * @param {boolean} success - Состояние успеха (показывает галочку на 2 сек)
 * @param {React.ReactNode} children - Содержимое кнопки
 */
export function SmartButton({ 
  variant = 'primary', 
  loading = false, 
  success = false,
  className = '',
  children,
  ...props 
}) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-900',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 
        px-4 py-2 rounded-xl font-bold text-sm
        transition-all duration-200 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${className}
      `}
      disabled={loading || showSuccess}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {showSuccess && <CheckCircle2 size={16} />}
      {!loading && !showSuccess && children}
      {loading && 'Сохранение...'}
      {showSuccess && 'Сохранено!'}
    </button>
  );
}

// ============================================
// 4. ИНДИКАТОР НЕСОХРАНЁННЫХ ИЗМЕНЕНИЙ
// ============================================

/**
 * Пульсирующий индикатор для кнопки сохранения
 */
export function SaveIndicator({ hasChanges }) {
  if (!hasChanges) return null;
  
  return (
    <span className="absolute -top-1 -right-1 flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
    </span>
  );
}

// Пример использования:
// <button className="relative">
//   <SaveIndicator hasChanges={hasUnsavedChanges} />
//   Сохранить
// </button>

// ============================================
// 5. SORTABLE TABLE HEADER
// ============================================

/**
 * Заголовок таблицы с сортировкой
 * 
 * @param {string} label - Название колонки
 * @param {string} field - Поле для сортировки
 * @param {string} currentSortBy - Текущее поле сортировки
 * @param {string} currentSortOrder - Текущий порядок: 'asc' | 'desc'
 * @param {function} onSort - Callback при клике
 */
export function SortableHeader({ 
  label, 
  field, 
  currentSortBy, 
  currentSortOrder, 
  onSort 
}) {
  const isActive = currentSortBy === field;
  
  return (
    <th 
      className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {label}
        {isActive && (
          <span className="text-blue-600">
            {currentSortOrder === 'asc' ? (
              <ArrowUp size={12} strokeWidth={3} />
            ) : (
              <ArrowDown size={12} strokeWidth={3} />
            )}
          </span>
        )}
        {!isActive && (
          <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUp size={12} />
          </span>
        )}
      </div>
    </th>
  );
}

// ============================================
// 6. УЛУЧШЕННЫЙ TOAST С ТИПАМИ
// ============================================

/**
 * Toast уведомление с типами и автозакрытием
 * 
 * @param {string} type - Тип: 'success' | 'error' | 'warning' | 'info'
 * @param {string} title - Заголовок
 * @param {string} message - Сообщение
 * @param {number} duration - Длительность показа (мс)
 * @param {function} onClose - Callback при закрытии
 */
export function Toast({ type = 'info', title, message, duration = 5000, onClose }) {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const styles = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-900',
      icon: <CheckCircle2 size={20} className="text-emerald-600" />,
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-900',
      icon: <XCircle size={20} className="text-red-600" />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-900',
      icon: <AlertTriangle size={20} className="text-amber-600" />,
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-900',
      icon: <Info size={20} className="text-blue-600" />,
    },
  };

  const config = styles[type];

  return (
    <div 
      className={`
        flex items-start gap-3 p-4 rounded-xl border shadow-lg
        ${config.bg} ${config.text}
        animate-in slide-in-from-top-2 duration-300
      `}
    >
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        {title && <div className="font-bold text-sm mb-0.5">{title}</div>}
        <div className="text-xs opacity-90 leading-relaxed">{message}</div>
      </div>
      <button 
        onClick={onClose}
        className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
      >
        <XCircle size={16} />
      </button>
    </div>
  );
}

// ============================================
// 7. ПРОГРЕСС-БАР С ЭТАПАМИ
// ============================================

/**
 * Прогресс-бар с визуализацией ключевых этапов
 * 
 * @param {number} current - Текущий шаг (0-based)
 * @param {number} total - Всего шагов
 * @param {array} milestones - Массив индексов ключевых этапов
 */
export function StageProgressBar({ current, total, milestones = [] }) {
  const percentage = ((current + 1) / total) * 100;
  
  return (
    <div className="relative">
      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 
                     transition-all duration-500 ease-out relative"
          style={{ width: `${percentage}%` }}
        >
          {/* Анимированный блик */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent 
                          animate-shimmer" />
        </div>
      </div>
      
      {/* Маркеры ключевых этапов */}
      {milestones.map((milestone, idx) => {
        const position = ((milestone + 1) / total) * 100;
        const isPassed = current >= milestone;
        
        return (
          <div
            key={idx}
            className={`
              absolute top-0 w-1 h-3 -translate-y-0.5 transition-colors
              ${isPassed ? 'bg-emerald-600' : 'bg-slate-400'}
            `}
            style={{ left: `${position}%` }}
            title={`Этап ${idx + 1}`}
          />
        );
      })}
      
      {/* Текущая позиция */}
      <div className="flex justify-between mt-1 text-[10px] text-slate-500">
        <span>Шаг {current + 1} из {total}</span>
        <span>{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

// ============================================
// 8. ВАЛИДАЦИЯ ПОЛЯ С ВИЗУАЛЬНЫМ FEEDBACK
// ============================================

/**
 * Обёртка для input с валидацией
 * 
 * @param {string} label - Метка поля
 * @param {string} error - Сообщение об ошибке
 * @param {boolean} required - Обязательное поле
 * @param {React.ReactNode} children - Input элемент
 */
export function ValidatedField({ label, error, required, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        {React.cloneElement(children, {
          className: `${children.props.className || ''} ${
            error ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : ''
          }`.trim(),
        })}
        
        {error && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
            <AlertCircle size={16} />
          </div>
        )}
      </div>
      
      {error && (
        <div className="text-xs text-red-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}

// Пример использования:
// <ValidatedField label="Название ЖК" error={errors.name} required>
//   <input type="text" value={name} onChange={e => setName(e.target.value)} />
// </ValidatedField>

// ============================================
// 9. HOVER CARD (УЛУЧШЕННАЯ МЕТРИКА)
// ============================================

/**
 * Карточка метрики с hover-эффектом
 * 
 * @param {string} label - Название метрики
 * @param {number|string} value - Значение
 * @param {React.Component} icon - Иконка
 * @param {string} color - Цвет (Tailwind класс)
 * @param {string} trend - Тренд: '+5%', '-2%' и т.д.
 * @param {boolean} isActive - Активная карточка
 * @param {function} onClick - Callback при клике
 */
export function MetricCard({ 
  label, 
  value, 
  icon: Icon, 
  color = 'text-blue-600', 
  trend,
  isActive,
  onClick 
}) {
  const trendUp = trend && trend.startsWith('+');
  const trendDown = trend && trend.startsWith('-');

  return (
    <div 
      onClick={onClick}
      className={`
        group p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer
        hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02]
        ${isActive 
          ? `ring-2 ring-offset-2 ring-${color.split('-')[1]}-500 border-${color.split('-')[1]}-500 bg-white` 
          : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300'
        }
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`
          w-14 h-14 rounded-xl flex items-center justify-center 
          bg-white shadow-sm border border-slate-100
          group-hover:scale-110 transition-transform ${color}
        `}>
          <Icon size={28} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-slate-800 leading-none">
              {value}
            </div>
            
            {trend && (
              <div className={`
                text-xs font-bold px-1.5 py-0.5 rounded-md
                ${trendUp ? 'bg-emerald-100 text-emerald-700' : ''}
                ${trendDown ? 'bg-red-100 text-red-700' : ''}
              `}>
                {trend}
              </div>
            )}
          </div>
          
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1.5">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 10. ESCAPE KEY HANDLER (HOC)
// ============================================

/**
 * Higher-Order Component для добавления обработки Escape
 * 
 * @param {React.Component} Component - Компонент модалки
 */
export function withEscapeKey(Component) {
  return function WrappedComponent({ onClose, ...props }) {
    useEffect(() => {
      const handleEsc = (e) => {
        if (e.key === 'Escape') onClose?.();
      };
      
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return <Component onClose={onClose} {...props} />;
  };
}

// Пример использования:
// export default withEscapeKey(function MyModal({ onClose }) {
//   return <div>...</div>;
// });

// ============================================
// 11. FOCUS TRAP ДЛЯ МОДАЛОК
// ============================================

/**
 * Hook для ограничения фокуса внутри модалки
 * 
 * @param {React.RefObject} containerRef - Ref контейнера модалки
 */
export function useFocusTrap(containerRef) {
  useEffect(() => {
    if (!containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    firstElement?.focus();
    document.addEventListener('keydown', handleTab);
    
    return () => document.removeEventListener('keydown', handleTab);
  }, [containerRef]);
}

// Пример использования:
// const modalRef = useRef(null);
// useFocusTrap(modalRef);
// return <div ref={modalRef}>...</div>;

// ============================================
// 12. STICKY TABLE HEADER
// ============================================

/**
 * Компонент липкого заголовка таблицы
 */
export function StickyTableHeader({ children, className = '' }) {
  return (
    <thead 
      className={`
        bg-slate-50/95 border-b border-slate-200 
        sticky top-0 z-10 backdrop-blur-md shadow-sm
        ${className}
      `}
    >
      {children}
    </thead>
  );
}

// Пример использования:
// <table>
//   <StickyTableHeader>
//     <tr>
//       <th>Название</th>
//       <th>Адрес</th>
//     </tr>
//   </StickyTableHeader>
//   <tbody>...</tbody>
// </table>

// ============================================
// 13. BULK ACTIONS TOOLBAR
// ============================================

/**
 * Плавающая панель для массовых действий
 * 
 * @param {array} selectedItems - Массив выбранных элементов
 * @param {function} onClear - Очистить выделение
 * @param {array} actions - Массив действий { label, icon, onClick, variant }
 */
export function BulkActionsBar({ selectedItems = [], onClear, actions = [] }) {
  if (selectedItems.length === 0) return null;

  return (
    <div className="
      fixed bottom-6 left-1/2 -translate-x-1/2 z-50
      bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl
      flex items-center gap-4
      animate-in slide-in-from-bottom-4 duration-300
    ">
      <span className="text-sm font-bold">
        {selectedItems.length} выбрано
      </span>
      
      <div className="h-6 w-px bg-slate-700" />
      
      <div className="flex items-center gap-2">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => action.onClick(selectedItems)}
            className={`
              px-4 py-1.5 rounded-full text-xs font-bold
              transition-all hover:scale-105 active:scale-95
              flex items-center gap-1.5
              ${action.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {action.icon && <action.icon size={14} />}
            {action.label}
          </button>
        ))}
      </div>
      
      <button 
        onClick={onClear}
        className="ml-2 text-slate-400 hover:text-white transition-colors"
      >
        <XCircle size={20} />
      </button>
    </div>
  );
}

// Пример использования:
// <BulkActionsBar
//   selectedItems={selectedRows}
//   onClear={() => setSelectedRows([])}
//   actions={[
//     { label: 'Экспорт', icon: FileDown, onClick: handleExport },
//     { label: 'Удалить', icon: Trash2, onClick: handleDelete, variant: 'danger' },
//   ]}
// />

// ============================================
// CSS АНИМАЦИИ (добавить в index.css)
// ============================================

/*
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-in-from-top-1 {
  from { 
    opacity: 0;
    transform: translateY(-0.25rem);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-in-from-bottom-4 {
  from { 
    opacity: 0;
    transform: translateY(1rem);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation-duration: 0.3s;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

.fade-in {
  animation-name: fade-in;
}

.slide-in-from-top-1 {
  animation-name: slide-in-from-top-1;
}

.slide-in-from-bottom-4 {
  animation-name: slide-in-from-bottom-4;
}
*/

// ============================================
// ПРИМЕР ИНТЕГРАЦИИ В СУЩЕСТВУЮЩИЙ КОД
// ============================================

/*
// ДО: ApplicationsDashboard.jsx
<MetricCard label="В работе" value={counts.work} icon={HardHat} color="text-blue-600" />

// ПОСЛЕ:
<MetricCard 
  label="В работе" 
  value={counts.work} 
  icon={HardHat} 
  color="text-blue-600"
  trend="+12%"
  isActive={activeFilter === 'work'}
  onClick={() => setActiveFilter('work')}
/>
*/

/*
// ДО: WorkflowBar.jsx
<Button onClick={handleSave} disabled={isLoading}>
  {isLoading ? <Loader2 className="animate-spin"/> : <Save/>}
  Сохранить
</Button>

// ПОСЛЕ:
<SmartButton 
  variant="primary"
  loading={isLoading}
  success={saveSuccess}
  onClick={handleSave}
>
  <Save size={16}/> Сохранить
</SmartButton>
*/

/*
// ДО: Input без валидации
<Input value={name} onChange={e => setName(e.target.value)} />

// ПОСЛЕ:
<ValidatedField label="Название ЖК" error={errors.name} required>
  <Input 
    value={name} 
    onChange={e => setName(e.target.value)}
    placeholder="Введите название комплекса"
  />
</ValidatedField>
*/
