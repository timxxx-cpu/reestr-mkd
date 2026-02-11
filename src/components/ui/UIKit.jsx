import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const cn = (...classes) => classes.filter(Boolean).join(' ');

// --- КОНТЕКСТ READ-ONLY ---
const ReadOnlyContext = createContext(false);
export const useReadOnly = () => useContext(ReadOnlyContext);
export const ReadOnlyProvider = ({ value, children }) => (
  <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>
);

// --- КНОПКА (BUTTON) ---
export const Button = ({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled = false,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-xl text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 h-10 px-6 py-2.5 active:scale-95 shadow-md gap-2';

  const variants = {
    primary: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    secondary:
      'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 border border-input',
    ghost: 'hover:bg-accent hover:text-accent-foreground shadow-none',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    outline:
      'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant] || variants.primary, className)}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
};

// --- ПОЛЕ ВВОДА (INPUT) ---
export const Input = React.forwardRef((/** @type {any} */ { className = '', ...props }, ref) => {
  const isReadOnly = useReadOnly();
  const isDisabled = props.disabled || isReadOnly;

  return (
    <input
      ref={ref}
      disabled={isDisabled}
      className={cn(
        'flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground ring-offset-background',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50 transition-all',
        className
      )}
      {...props}
    />
  );
});

// --- DEBOUNCED INPUT ---
export const DebouncedInput = React.memo(
  React.forwardRef(
    (
      /** @type {any} */ { value: initialValue, onChange, delay = 300, className = '', ...props },
      ref
    ) => {
      const [value, setValue] = useState(initialValue || '');
      const isReadOnly = useReadOnly();
      const isDisabled = props.disabled || isReadOnly;

      useEffect(() => {
        setValue(initialValue || '');
      }, [initialValue]);

      useEffect(() => {
        const handler = setTimeout(() => {
          if (String(value) !== String(initialValue || '')) {
            onChange(value);
          }
        }, delay);

        return () => clearTimeout(handler);
      }, [value, delay, initialValue, onChange]);

      // [FIX] Принудительное сохранение при потере фокуса
      const handleBlur = e => {
        if (String(value) !== String(initialValue || '')) {
          onChange(value);
        }
        if (props.onBlur) props.onBlur(e);
      };

      return (
        <input
          ref={ref}
          {...props}
          disabled={isDisabled}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={handleBlur} // [FIX] Добавлено
          className={cn(
            'flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50 transition-all',
            className
          )}
        />
      );
    }
  )
);

// --- ВЫПАДАЮЩИЙ СПИСОК (SELECT) ---
export const Select = React.forwardRef(
  (/** @type {any} */ { className = '', children, ...props }, ref) => {
    const isReadOnly = useReadOnly();
    const isDisabled = props.disabled || isReadOnly;

    return (
      <div className="relative">
        <select
          ref={ref}
          disabled={isDisabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer transition-all',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {/* Стрелочка */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-foreground">
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    );
  }
);

// --- КАРТОЧКА (CARD) ---
export const Card = ({ className = '', children, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-border bg-card text-card-foreground shadow-md overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// --- МЕТКА ПОЛЯ (LABEL) ---
export const Label = ({ className = '', children, required = false, ...props }) => {
  return (
    <label
      className={cn(
        'text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block',
        className
      )}
      {...props}
    >
      {children} {required && <span className="text-destructive">*</span>}
    </label>
  );
};

// --- ЗАГОЛОВОК СЕКЦИИ ---
export const SectionTitle = ({ icon: Icon, children, className = '' }) => (
  <h3
    className={cn(
      'text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2',
      className
    )}
  >
    {Icon && <Icon size={16} />} {children}
  </h3>
);

// --- КНОПКА ТАБА (TAB BUTTON) ---
export const TabButton = ({ active, onClick, children, className = '' }) => (
  <button
    onClick={onClick}
    className={cn(
      'px-5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2',
      active
        ? 'bg-background text-primary shadow-sm ring-1 ring-border'
        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      className
    )}
  >
    {children}
  </button>
);

// --- БЕЙДЖ (BADGE) ---
export const Badge = ({ variant = 'secondary', className, children }) => {
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive:
      'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'text-foreground',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

// ============================================
// НОВЫЕ УЛУЧШЕННЫЕ КОМПОНЕНТЫ
// ============================================

// --- TOOLTIP ---
export function Tooltip({ children, content, placement = 'top' }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!content) return children;

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
          className={cn(
            'absolute z-50 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl',
            'whitespace-nowrap pointer-events-none animate-in fade-in duration-200',
            placements[placement]
          )}
        >
          {content}
          <div className={cn('absolute border-4 border-transparent', arrowPlacements[placement])} />
        </div>
      )}
    </div>
  );
}

// --- TABLE SKELETON LOADER ---
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
                  animationDelay: `${rowIdx * 0.1 + colIdx * 0.05}s`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// --- SAVE INDICATOR (для кнопки сохранения) ---
export function SaveIndicator({ hasChanges }) {
  if (!hasChanges) return null;

  return (
    <span className="absolute -top-1 -right-1 flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
    </span>
  );
}

// --- VALIDATED FIELD (поле с валидацией) ---
export function ValidatedField({ label, error, required, children, className = '' }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label required={required}>{label}</Label>}

      <div className="relative">
        {React.cloneElement(children, {
          className: cn(
            children.props.className || '',
            error ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-300' : ''
          ),
        })}

        {error && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
            <AlertCircle size={16} />
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}

// --- SMART BUTTON (с состояниями загрузки и успеха) ---
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
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm',
        'transition-all duration-200 active:scale-95 shadow-md',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
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

// --- MODAL ---
export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
  const modalRef = useRef(null);
  useEscapeKey(isOpen ? onClose : null);
  useFocusTrap(modalRef);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className={cn(
          'w-full bg-background rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh]',
          maxWidth
        )}
      >
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-background rounded-t-2xl z-10">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full p-1 transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
// --- BLOCKING LOADER ---
export function BlockingLoader({ isOpen, message = 'Сохранение...' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 cursor-wait">
      <div className="bg-background p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-border min-w-[240px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-base font-bold text-foreground">{message}</p>
      </div>
    </div>
  );
}
// ============================================
// ХУКИ (HOOKS)
// ============================================

// --- ESCAPE KEY HANDLER ---
export function useEscapeKey(onEscape) {
  useEffect(() => {
    if (!onEscape) return;

    const handleEsc = e => {
      if (e.key === 'Escape') onEscape();
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onEscape]);
}

// --- FOCUS TRAP (для модалок) ---
export function useFocusTrap(containerRef) {
  useEffect(() => {
    if (!containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = e => {
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
