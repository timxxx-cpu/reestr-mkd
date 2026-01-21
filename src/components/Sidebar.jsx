import React from 'react';
import { 
  LayoutDashboard, FileText, Layers, ParkingSquare, 
  ArrowLeftRight, Grid, LogOut, Building2, 
  ChevronLeft, ChevronRight, Settings 
} from 'lucide-react';
import { STEPS_CONFIG } from '../lib/constants';

export default function Sidebar({ currentStep, onStepChange, isOpen, onToggle, onBackToDashboard }) {
  
  // Иконки для меню
  const getIcon = (id) => {
    switch (id) {
      case 'passport': return <FileText size={20} />;
      case 'composition': return <Layers size={20} />;
      case 'parking_config': return <ParkingSquare size={20} />; // Исправил иконку на ParkingSquare
      case 'registry_res': return <Building2 size={20} />;
      case 'registry_nonres': return <Building2 size={20} />;
      case 'floors': return <Layers size={20} />;
      case 'entrances': return <ArrowLeftRight size={20} />;
      case 'mop': return <Grid size={20} />;
      case 'apartments': return <Grid size={20} />;
      case 'parking': return <ParkingSquare size={20} />;
      case 'summary': return <LayoutDashboard size={20} />;
      case 'history': return <Settings size={20} />; // Для истории
      default: return <FileText size={20} />;
    }
  };

  return (
    <aside 
      className={`
        fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-50 shadow-2xl flex flex-col
        ${isOpen ? 'w-72' : 'w-20'}
      `}
    >
      {/* --- ЛОГОТИП И НАЗВАНИЕ --- */}
      <div className="p-4 border-b border-slate-700 flex items-center gap-3 min-h-[80px]">
        <div className="w-10 h-10 min-w-[40px] bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 text-white font-bold text-xl">
          Р
        </div>
        
        {/* Показываем текст только если меню открыто */}
        {isOpen && (
          <div className="animate-in fade-in duration-300 overflow-hidden">
            <h1 className="font-bold text-xs leading-tight text-slate-100 uppercase tracking-wide mb-1">
              Реестр Жилых Комплексов <br/> и МКД
            </h1>
            <div className="inline-block bg-slate-800 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-slate-700 font-mono">
              прототип v1.0
            </div>
          </div>
        )}
      </div>

      {/* --- НАВИГАЦИЯ --- */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <nav className="space-y-1 px-2">
          {STEPS_CONFIG.map((step, idx) => {
            const isActive = idx === currentStep;
            return (
              <button
                key={step.id}
                onClick={() => onStepChange(idx)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }
                `}
                title={!isOpen ? step.title : ''}
              >
                <div className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                  {getIcon(step.id)}
                </div>
                
                {isOpen && (
                  <span className="text-sm font-medium text-left truncate animate-in fade-in duration-200">
                    {step.title}
                  </span>
                )}

                {/* Индикатор активного пункта (полоска слева) */}
                {isActive && !isOpen && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* --- ПОДВАЛ (Кнопки) --- */}
      <div className="p-4 border-t border-slate-700 bg-slate-900/50 space-y-2">
        <button 
          onClick={onBackToDashboard}
          className={`
            w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl transition-all border border-slate-700
            ${!isOpen && 'px-0'}
          `}
          title="Выйти к проектам"
        >
          <LogOut size={18} />
          {isOpen && <span className="text-xs font-bold uppercase">Выход</span>}
        </button>

        <button 
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 text-slate-500 hover:text-white transition-colors"
        >
          {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
    </aside>
  );
}