import React from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@context/ToastContext';

/**
 * Компонент для отображения UJ-идентификаторов
 * 
 * @param {Object} props
 * @param {string} props.code - Код идентификатора (UJ000001, ZR01, EF001)
 * @param {'project'|'building'|'unit'} props.type - Тип идентификатора
 * @param {'compact'|'default'|'large'} props.variant - Размер бейджа
 * @param {boolean} props.showCopy - Показывать возможность копирования
 * @param {string} props.className - Дополнительные CSS классы
 */
export const IdentifierBadge = ({ 
  code, 
  type = 'project', 
  variant = 'default',
  showCopy = true,
  className = ''
}) => {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  if (!code) return null;

  // Стили по типу
  const typeStyles = {
    project: 'bg-blue-50 border-blue-200 text-blue-700',
    building: 'bg-blue-50 border-blue-200 text-blue-700',
    unit: 'bg-blue-100 border-blue-200 text-blue-600',
  };

  // Размеры
  const sizeStyles = {
    compact: 'text-[9px] px-1.5 py-0.5',
    default: 'text-[10px] px-2 py-0.5',
    large: 'text-xs px-2.5 py-1',
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast?.success?.('Код скопирован');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast?.error?.('Не удалось скопировать');
    });
  };

  return (
    <span 
      onClick={showCopy ? handleCopy : undefined}
      className={`
        inline-flex items-center gap-1 rounded border font-mono font-bold
        ${typeStyles[type]} 
        ${sizeStyles[variant]}
        ${showCopy ? 'cursor-pointer hover:scale-105 hover:shadow-sm active:scale-95 transition-all duration-150' : ''}
        ${className}
      `}
      title={showCopy ? 'Нажмите, чтобы скопировать' : code}
    >
      {code}
      {showCopy && variant !== 'compact' && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? <Check size={10} /> : <Copy size={10} />}
        </span>
      )}
    </span>
  );
};

/**
 * Компонент для отображения полного идентификатора (с иерархией)
 */
export const FullIdentifier = ({ projectCode, buildingCode, unitCode, className = '' }) => {
  const parts = [];
  
  if (projectCode) parts.push({ code: projectCode, type: 'project' });
  if (buildingCode) parts.push({ code: buildingCode, type: 'building' });
  if (unitCode) parts.push({ code: unitCode, type: 'unit' });
  
  if (parts.length === 0) return null;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {parts.map((part, idx) => (
        <React.Fragment key={part.code}>
          <IdentifierBadge code={part.code} type={part.type} variant="compact" />
          {idx < parts.length - 1 && (
            <span className="text-slate-300 text-xs">→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * Компонент для отображения полного идентификатора в виде одной строки
 * @param {string} fullCode - Полный код вида UJ000001-ZR01-EF001
 */
export const FullIdentifierCompact = ({ fullCode, variant = 'default', className = '' }) => {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  if (!fullCode) return null;

  const sizeStyles = {
    compact: 'text-[9px] px-1.5 py-0.5',
    default: 'text-[10px] px-2 py-0.5',
    large: 'text-xs px-2.5 py-1',
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullCode).then(() => {
      setCopied(true);
      toast?.success?.('Код скопирован');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast?.error?.('Не удалось скопировать');
    });
  };

  return (
    <span 
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-1 rounded border font-mono font-bold
        bg-blue-50 border-blue-200 text-blue-700
        ${sizeStyles[variant]}
        cursor-pointer hover:scale-105 hover:shadow-sm active:scale-95 transition-all duration-150
        ${className}
      `}
      title="Нажмите, чтобы скопировать"
    >
      {fullCode}
      {variant !== 'compact' && (
        <span className={`transition-opacity ${copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {copied ? <Check size={10} /> : <Copy size={10} />}
        </span>
      )}
    </span>
  );
};

export default IdentifierBadge;
