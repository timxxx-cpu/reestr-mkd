import React from 'react';

// Простая утилита для объединения классов
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Компонент-заглушка для состояний загрузки
 * Использует переменную --muted из вашей темы
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-slate-700', className)}
      {...props}
    />
  );
}
