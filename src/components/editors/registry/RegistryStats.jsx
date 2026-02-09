// src/components/editors/registry/RegistryStats.jsx
import React from 'react';
import { LayoutGrid, FileText, CheckCircle2 } from 'lucide-react';

const StatCard = ({ label, value, icon: _Icon, colorClass, iconBgClass }) => (
  <div
    className={`p-4 rounded-xl border flex items-center justify-between shadow-sm bg-white ${colorClass}`}
  >
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
    <div className={`p-2 rounded-lg ${iconBgClass || 'bg-slate-100'}`}>
      <_Icon size={20} className="opacity-80" />
    </div>
  </div>
);

export default function RegistryStats({ stats, mode = 'default' }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 md:px-0">
      <StatCard
        label="Всего объектов"
        value={stats.total}
        icon={LayoutGrid}
        colorClass="border-slate-200 text-slate-800"
        iconBgClass="bg-slate-100"
      />

      <StatCard
        label="Общая площадь"
        value={`${stats.totalArea.toLocaleString(undefined, { maximumFractionDigits: 1 })} м²`}
        icon={FileText}
        colorClass="border-blue-100 bg-blue-50 text-blue-700"
        iconBgClass="bg-blue-200"
      />

      {mode === 'parking' && (
        <StatCard
          label="Свободно мест"
          value={stats.free}
          icon={CheckCircle2}
          colorClass="border-emerald-100 bg-emerald-50 text-emerald-700"
          iconBgClass="bg-emerald-200"
        />
      )}
    </div>
  );
}
