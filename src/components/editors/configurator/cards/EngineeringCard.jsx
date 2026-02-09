import React from 'react';
import {
  Zap,
  Droplets,
  Thermometer,
  Flame,
  ArrowDownToLine,
  Fan,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { Card, SectionTitle, useReadOnly } from '@components/ui/UIKit';

export default function EngineeringCard({ details, updateDetail }) {
  const isReadOnly = useReadOnly();

  const systems = [
    {
      id: 'electricity',
      label: 'Электроснабжение',
      icon: Zap,
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200 ring-yellow-400',
    },
    {
      id: 'hvs',
      label: 'Холодная вода',
      icon: Droplets,
      color: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-400',
    },
    {
      id: 'gvs',
      label: 'Горячая вода',
      icon: Droplets,
      color: 'bg-cyan-50 text-cyan-700 border-cyan-200 ring-cyan-400',
    },
    {
      id: 'sewerage',
      label: 'Канализация',
      icon: ArrowDownToLine,
      color: 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-400',
    },
    {
      id: 'heating',
      label: 'Отопление',
      icon: Thermometer,
      color: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-400',
    },
    {
      id: 'ventilation',
      label: 'Вентиляция',
      icon: Fan,
      color: 'bg-teal-50 text-teal-700 border-teal-200 ring-teal-400',
    },
    {
      id: 'gas',
      label: 'Газификация',
      icon: Flame,
      color: 'bg-red-50 text-red-700 border-red-200 ring-red-400',
    },
    {
      id: 'firefighting',
      label: 'Пожаротушение',
      icon: ShieldCheck,
      color: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-400',
    },
    {
      id: 'lowcurrent',
      label: 'Слаботочка',
      icon: Wifi,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-400',
    },
  ];

  const toggleSystem = id => {
    if (isReadOnly) return;
    const current = details.engineering || {};
    updateDetail('engineering', { ...current, [id]: !current[id] });
  };

  return (
    <Card className="p-5 shadow-sm">
      <SectionTitle icon={Zap}>Инженерные системы</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        {systems.map(sys => {
          const isActive = details.engineering?.[sys.id];
          const Icon = sys.icon;

          return (
            <button
              key={sys.id}
              disabled={isReadOnly}
              onClick={() => toggleSystem(sys.id)}
              className={`
                                relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 group
                                ${
                                  isActive
                                    ? `${sys.color} border-transparent shadow-sm ring-1`
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                                }
                                ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                            `}
            >
              <Icon
                size={20}
                className={`mb-2 transition-transform duration-200 ${isActive ? 'scale-110' : 'grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-70'}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="text-[10px] font-bold text-center leading-tight">{sys.label}</span>

              {/* Индикатор активности */}
              {isActive && (
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current opacity-50"></div>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
