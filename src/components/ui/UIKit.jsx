import React, { useState, useEffect, createContext, useContext } from 'react';
import { Loader2 } from 'lucide-react';

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
    const baseStyles = "inline-flex items-center justify-center rounded-xl text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 h-10 px-6 py-2.5 active:scale-95 shadow-md gap-2";
    
    const variants = {
        primary: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 border border-input",
        ghost: "hover:bg-accent hover:text-accent-foreground shadow-none",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
    };

    return (
        <button 
            className={cn(baseStyles, variants[variant] || variants.primary, className)}
            disabled={loading || disabled}
            {...props}
        >
            {loading && <Loader2 size={14} className="animate-spin"/>}
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
                "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground ring-offset-background",
                "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
                "disabled:cursor-not-allowed disabled:opacity-50 transition-all",
                className
            )}
            {...props}
        />
    );
});

// --- DEBOUNCED INPUT ---
export const DebouncedInput = React.memo(React.forwardRef((/** @type {any} */ { value: initialValue, onChange, delay = 300, className = "", ...props }, ref) => {
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
    const handleBlur = (e) => {
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
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur} // [FIX] Добавлено
        className={cn(
            "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground ring-offset-background",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50 transition-all",
            className
        )}
      />
    );
}));

// --- ВЫПАДАЮЩИЙ СПИСОК (SELECT) ---
export const Select = React.forwardRef((/** @type {any} */ { className = '', children, ...props }, ref) => {
    const isReadOnly = useReadOnly();
    const isDisabled = props.disabled || isReadOnly;

    return (
        <div className="relative">
            <select
                ref={ref}
                disabled={isDisabled}
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground ring-offset-background",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
                    "disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer transition-all",
                    className
                )}
                {...props}
            >
                {children}
            </select>
            {/* Стрелочка */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-foreground">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
        </div>
    );
});

// --- КАРТОЧКА (CARD) ---
export const Card = ({ className = '', children, ...props }) => {
    return (
        <div 
            className={cn(
                "rounded-2xl border-2 border-border bg-card text-card-foreground shadow-md overflow-hidden", 
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
                "text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block", 
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
    <h3 className={cn("text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2", className)}>
        {Icon && <Icon size={16} />} {children}
    </h3>
);

// --- КНОПКА ТАБА (TAB BUTTON) ---
export const TabButton = ({ active, onClick, children, className = '' }) => (
    <button
        onClick={onClick}
        className={cn(
            "px-5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2",
            active 
                ? "bg-background text-primary shadow-sm ring-1 ring-border" 
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            className
        )}
    >
        {children}
    </button>
);

// --- БЕЙДЖ (BADGE) ---
export const Badge = ({ variant = 'secondary', className, children }) => {
    const variants = {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
    }
    return (
        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)}>
            {children}
        </span>
    )
}