import React from 'react';
import { PanelLeft, FolderOpen, Layout } from 'lucide-react';
import { STEPS_CONFIG } from '../lib/constants';

export default function Sidebar({ currentStep, onStepChange, isOpen, onToggle, onBackToDashboard }) {
    return (
        <aside className={`${isOpen ? 'w-72' : 'w-20'} bg-white border-r border-slate-200 flex flex-col shadow-2xl shadow-slate-200/50 z-[60] transition-all duration-300 flex-shrink-0`}>
             {/* Хедер */}
             <div className="p-6 border-b border-slate-100 flex items-center justify-between h-[73px]">
                 <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={onBackToDashboard} title="Вернуться к проектам">
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                        <Layout size={18}/>
                    </div>
                    <span className={`font-bold text-lg tracking-tight text-slate-800 transition-opacity whitespace-nowrap ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                        РЕЕСТР МКД
                    </span>
                 </div>
                 <button onClick={onToggle} className="text-slate-400 hover:text-slate-600">
                    <PanelLeft size={18}/>
                 </button>
             </div>

             {/* Навигация */}
             <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                 {/* Кнопка "Мои проекты" */}
                 <button 
                    onClick={onBackToDashboard} 
                    className={`w-full flex items-center ${!isOpen ? 'justify-center px-2' : 'gap-3 px-4'} py-3 mb-4 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all border border-dashed border-slate-200 hover:border-slate-300`}
                 >
                     <FolderOpen size={20} />
                     {isOpen && <span className="text-xs font-bold uppercase tracking-wide">Мои проекты</span>}
                 </button>

                 {/* Список шагов */}
                 {STEPS_CONFIG.map((step, idx) => {
                     const Icon = step.icon;
                     const active = currentStep === idx;
                     return (
                        <div 
                            key={step.id} 
                            onClick={() => onStepChange(idx)} 
                            className={`group flex items-center ${!isOpen ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-xl cursor-pointer transition-all duration-200 mb-1 ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`} 
                            title={!isOpen ? step.title : ''}
                        >
                            <div className={`relative flex items-center justify-center ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                                <Icon size={20} />
                                {(step.id === 'registry_res' || step.id === 'registry_nonres') && !isOpen && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white" />}
                            </div>
                            {isOpen && (
                                <div className="flex-1 flex items-center justify-between overflow-hidden">
                                    <div>
                                        <div className={`text-xs font-bold leading-none ${active ? 'text-slate-800' : 'text-slate-600'}`}>{step.title}</div>
                                        <div className="text-[10px] opacity-60 mt-1 truncate max-w-[140px]">{step.desc}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                     );
                 })}
             </nav>
        </aside>
    );
}