import React from 'react';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { STEPS_CONFIG } from '../lib/constants';
import { AuthService } from '../lib/auth-service';

export default function Sidebar({ currentStep, onStepChange, isOpen, onToggle, onBackToDashboard }) {
  
  const handleLogout = async () => {
      // ИСПРАВЛЕНО: Просто вызываем выход. App.jsx сам переключит экран благодаря подписке.
      await AuthService.logout();
  };

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300 z-50 flex flex-col ${isOpen ? 'w-72' : 'w-20'}`}
    >
      <div className={`h-16 flex items-center border-b border-slate-800 ${isOpen ? 'px-6 justify-between' : 'justify-center'}`}>
        {isOpen ? (
            <div className="font-bold text-base leading-tight text-white cursor-pointer uppercase tracking-tight" onClick={onBackToDashboard}>
              Реестр <span className="text-blue-500">Многоквартирных домов</span>
            </div>
        ) : (
            <div className="font-black text-xl text-blue-500 cursor-pointer" onClick={onToggle}>Р</div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
        {STEPS_CONFIG.map((step, index) => {
          const isActive = currentStep === index;
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              onClick={() => onStepChange(index)}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative min-h-[48px] h-auto
                ${isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }
              `}
            >
              <div className={`shrink-0 ${!isOpen && 'mx-auto'}`}>
                  <Icon size={20} className={isActive ? 'text-white' : 'group-hover:text-white transition-colors'} />
              </div>

              {isOpen && (
                <div className="flex flex-col items-start text-left">
                  <span className="text-xs font-bold uppercase tracking-wide whitespace-normal break-words leading-tight">
                    {step.title}
                  </span>
                  <span className={`text-[10px] font-medium mt-1 leading-none ${isActive ? 'text-blue-200' : 'text-slate-600 group-hover:text-slate-400'}`}>
                     {step.description}
                  </span>
                </div>
              )}

              {!isOpen && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity border border-slate-700">
                  {step.title}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <button 
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-slate-500 hover:bg-red-900/20 hover:text-red-500 transition-colors ${!isOpen && 'justify-center'}`}
            title="Выйти из системы"
          >
              <LogOut size={18} />
              {isOpen && <span className="text-xs font-bold uppercase">Выйти</span>}
          </button>
          
          <button 
            onClick={onToggle} 
            className={`
                flex items-center justify-center p-2 rounded-lg text-slate-600 hover:bg-slate-800 hover:text-white transition-colors
                ${isOpen ? 'self-end' : 'mx-auto w-full'}
            `}
            title={isOpen ? "Свернуть меню" : "Развернуть меню"}
          >
              {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
      </div>
    </aside>
  );
}