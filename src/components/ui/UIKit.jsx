import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// --- Контейнеры и Текст ---

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

export const SectionTitle = ({ children, icon: Icon, className = "" }) => (
  <h3 className={`text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${className}`}>
    {Icon && <Icon size={16} />} {children}
  </h3>
);

export const Label = ({ children, required, className = "" }) => (
  <label className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block ${className}`}>
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

export const Badge = ({ children, className = "" }) => (
  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border bg-slate-100 text-slate-500 border-slate-200 ${className}`}>
    {children}
  </span>
);

// --- Элементы ввода ---

// Базовый Input
export const Input = React.forwardRef(({ className = "", ...props }, ref) => (
  <input ref={ref} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed ${className}`} {...props} />
));

// Базовый Select
export const Select = React.forwardRef(({ className = "", children, ...props }, ref) => (
  <select ref={ref} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer disabled:opacity-60 ${className}`} {...props}>
    {children}
  </select>
));

// Input с задержкой (Для таблиц, чтобы не тормозило при вводе)
export const DebouncedInput = React.memo(({ value: initialValue, onChange, delay = 300, className = "", ...props }) => {
  const [value, setValue] = useState(initialValue || '');

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
  }, [value, delay]); // Убрали onChange из зависимостей

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={className}
    />
  );
});

// --- Кнопки ---

export const Button = ({ children, variant = 'primary', loading, className = "", ...props }) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200",
    secondary: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300",
    destructive: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    ghost: "text-slate-500 hover:bg-slate-100",
  };
  
  return (
    <button 
      className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin"/>}
      {children}
    </button>
  );
};

export const TabButton = ({ active, children, onClick, className = "" }) => (
  <button 
    onClick={onClick}
    className={`px-5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
      active 
        ? 'bg-white text-blue-600 shadow-sm' 
        : 'text-slate-500 hover:text-slate-800'
    } ${className}`}
  >
    {children}
  </button>
);