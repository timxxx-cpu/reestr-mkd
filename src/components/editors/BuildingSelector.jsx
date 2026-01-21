import React from 'react';
import { ArrowRight, Building2, Warehouse, Car, Box } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle } from '../ui/UIKit';
import { STEPS_CONFIG } from '../../lib/constants';

export default function BuildingSelector({ stepId, onSelect }) {
    const { composition } = useProject();

    // Фильтруем список зданий в зависимости от текущего шага
    const filteredItems = composition.filter(item => {
        if (stepId === 'registry_nonres') {
            // Для шага "Нежилые" показываем паркинги, инфру и дома с нежилыми блоками
            return item.category === 'infrastructure' || 
                   item.category === 'parking_separate' || 
                   item.nonResBlocks > 0;
        }
        if (stepId === 'registry_res') {
            // Для шага "Жилые" показываем только жилые дома
            return item.category.includes('residential');
        }
        return true; 
    });

    // Получаем иконку и заголовок текущего шага
    const currentStepConfig = STEPS_CONFIG.find(s => s.id === stepId) || {};
    const StepIcon = currentStepConfig.icon || Building2;

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
             <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{currentStepConfig.title}</h1>
                    <p className="text-slate-500 text-sm mt-1">Выберите объект для настройки</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                 {filteredItems.length === 0 && (
                     <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                        <div className="text-slate-300 mb-2"><StepIcon size={48} className="mx-auto"/></div>
                        <p className="text-slate-500 font-medium">Нет объектов для настройки в этой категории.</p>
                        <p className="text-slate-400 text-xs mt-1">Вернитесь в "Состав ЖК" и добавьте здания.</p>
                     </div>
                 )}

                 {filteredItems.map(item => (
                     <Card 
                        key={item.id} 
                        className="p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group border-l-4 border-l-transparent hover:border-l-blue-500"
                     >
                         <div className="flex justify-between items-start mb-4" onClick={() => onSelect(item.id)}>
                             <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <StepIcon size={24}/>
                             </div>
                             <ArrowRight size={20} className="text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"/>
                         </div>
                         <h3 className="text-lg font-bold text-slate-800 mb-2" onClick={() => onSelect(item.id)}>{item.label}</h3>
                         <div className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wide group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                            {item.type}
                         </div>
                     </Card>
                 ))}
             </div>
        </div>
    );
}