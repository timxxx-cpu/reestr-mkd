import React from 'react';

export default function VisualProgress({ current, total }) {
  const segments = Array.from({ length: total }, (_, i) => i);
  return (
    <div className="flex gap-0.5 h-1.5 w-full max-w-[200px] mt-1.5" title={`Шаг ${current + 1} из ${total}`}>
      {segments.map(i => {
        let color = 'bg-slate-200';
        if (i < current) color = 'bg-blue-500';
        if (i === current) color = 'bg-blue-600 animate-pulse';
        return <div key={i} className={`flex-1 rounded-full ${color}`} />;
      })}
    </div>
  );
}
