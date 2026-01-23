import React, { useMemo } from 'react';
import { ArrowRight, Building2, Search } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { STEPS_CONFIG } from '../../lib/constants';
import { calculateProgress, getStageColor } from '../../lib/utils';

const PARKING_CONSTRUCTION_NAMES = {
    capital: "Капитальный",
    light: "Из легких конструкций",
    open: "Открытый"
};

/**
 * @param {{ stepId: string, onSelect: (id: string) => void }} props
 */
export default function BuildingSelector({ stepId, onSelect }) {
    const { composition } = useProject();

    const filteredItems = useMemo(() => {
        return composition.filter(item => {
            if (stepId === 'registry_nonres') {
                if (item.category === 'residential') return false; 
                return item.category === 'infrastructure' || 
                       item.category === 'parking_separate' || 
                       (item.category === 'residential_multiblock' && item.nonResBlocks > 0);
            }
            
            if (stepId === 'registry_res') {
                return item.category.includes('residential');
            }
            
            if (['floors', 'entrances', 'mop', 'apartments'].includes(stepId)) {
                 if (stepId === 'apartments') return item.category.includes('residential');
            }
            return true; 
        });
    }, [composition, stepId]);

    // ИСПРАВЛЕНИЕ: Безопасный доступ к конфигу шага
    const currentStepConfig = STEPS_CONFIG.find(s => s.id === stepId);
    const StepIcon = currentStepConfig?.icon || Building2;

    return (
        <div className="w-full px-6 pb-20 animate-in fade-in duration-500">
             <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                        <StepIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{currentStepConfig?.title || 'Выбор объекта'}</h1>
                        <p className="text-slate-500 text-sm mt-1">Выберите объект для настройки</p>
                    </div>
                </div>
                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 uppercase tracking-wide">
                    Доступно объектов: {filteredItems.length}
                </div>
             </div>

             <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[300px]">
                 <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-200 py-4 px-6 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-1 text-center">Дом №</div>
                    <div className="col-span-4">Наименование</div>
                    <div className="col-span-3">Тип / Характеристики</div>
                    <div className="col-span-2">Статус / Прогресс</div>
                    <div className="col-span-1 text-right"></div>
                 </div>

                 {filteredItems.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300"><Search size={32}/></div>
                        <h3 className="text-sm font-bold text-slate-700">Нет подходящих объектов</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">В этом разделе пока нет объектов. Создайте их на этапе "Состав комплекса".</p>
                     </div>
                 )}

                 <div className="divide-y divide-slate-100">
                     {filteredItems.map((item, idx) => {
                         const isRes = item.category.includes('residential');
                         const progress = calculateProgress(item.dateStart, item.dateEnd);
                         
                         let detailsBadge = null;
                         if (item.category === 'parking_separate') {
                             const pType = item.parkingType === 'ground' ? 'Наземный' : 'Подземный';
                             const pConstName = PARKING_CONSTRUCTION_NAMES[item.constructionType] || item.constructionType;
                             detailsBadge = `${pType} • ${pConstName}`;
                         }

                         return (
                             <div key={item.id} onClick={() => onSelect(item.id)} className="grid grid-cols-12 items-center py-4 px-6 hover:bg-blue-50/50 cursor-pointer transition-colors group even:bg-slate-50/50">
                                 <div className="col-span-1 text-xs font-bold text-slate-400 text-center group-hover:text-blue-400">{idx + 1}</div>
                                 <div className="col-span-1 flex justify-center">
                                     <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs shadow-sm border ${isRes ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-amber-700'}`}>{item.houseNumber || '?'}</div>
                                 </div>
                                 <div className="col-span-4 pr-4"><div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors line-clamp-1">{item.label}</div></div>
                                 <div className="col-span-3 pr-4">
                                     <div className="text-xs font-medium text-slate-600 line-clamp-1 mb-1" title={item.type}>{item.type}</div>
                                     <div className="flex flex-wrap gap-1">
                                        {(item.resBlocks > 0 || item.nonResBlocks > 0) && (<span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-[9px] font-bold text-slate-600">{item.resBlocks} жил. / {item.nonResBlocks} нежил.</span>)}
                                        {item.hasNonResPart && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[9px] font-bold">+Коммерция</span>}
                                        {item.category === 'infrastructure' && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-bold">{item.infraType}</span>}
                                        {detailsBadge && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-bold">{detailsBadge}</span>}
                                     </div>
                                 </div>
                                 <div className="col-span-2 pr-6">
                                     <div className="flex items-center justify-between mb-1.5">
                                         <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${getStageColor(item.stage)}`}>{item.stage || 'Проект'}</span>
                                         <span className="text-[10px] font-bold text-slate-400">{Math.round(progress)}%</span>
                                     </div>
                                     <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} /></div>
                                 </div>
                                 <div className="col-span-1 flex justify-end">
                                     <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-300 shadow-sm group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white transition-all"><ArrowRight size={14} /></div>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>
        </div>
    );
}