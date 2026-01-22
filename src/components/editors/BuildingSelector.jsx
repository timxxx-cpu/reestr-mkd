import React, { useMemo } from 'react';
import { ArrowRight, Building2, Search } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { STEPS_CONFIG } from '../../lib/constants';

// Хелпер для цветов статуса
const getStageStyle = (stage) => {
    switch(stage) {
        case 'Введенный': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'Строящийся': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Проектный': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'Архив': return 'bg-slate-100 text-slate-500 border-slate-200';
        default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
};

// !!! ВОТ ЗДЕСЬ ОБЯЗАТЕЛЬНО ДОЛЖНО БЫТЬ "export default" !!!
export default function BuildingSelector({ stepId, onSelect }) {
    const { composition } = useProject();

    // Фильтруем список зданий в зависимости от текущего шага
    const filteredItems = useMemo(() => {
        return composition.filter(item => {
            if (stepId === 'registry_nonres') {
                // ЛОГИКА ФИЛЬТРАЦИИ ДЛЯ НЕЖИЛЫХ:
                
                // 1. Сразу исключаем обычные жилые дома (категория 'residential')
                // Даже если там есть галочка "коммерция", они настраиваются в разделе Жилые.
                if (item.category === 'residential') return false; 

                // 2. Оставляем: Инфраструктуру, Паркинги, и Многоблочные (если есть нежилые блоки)
                return item.category === 'infrastructure' || 
                       item.category === 'parking_separate' || 
                       (item.category === 'residential_multiblock' && item.nonResBlocks > 0);
            }
            
            if (stepId === 'registry_res') {
                // Для шага "Жилые": только жилые (одиночные и многоблочные)
                return item.category.includes('residential');
            }
            
            // Для остальных шагов
            if (['floors', 'entrances', 'mop', 'apartments'].includes(stepId)) {
                 if (stepId === 'apartments') return item.category.includes('residential');
            }
            return true; 
        });
    }, [composition, stepId]);

    // Получаем конфиг текущего шага для заголовка
    const currentStepConfig = STEPS_CONFIG.find(s => s.id === stepId) || {};
    const StepIcon = currentStepConfig.icon || Building2;

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
             {/* Хедер */}
             <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                        <StepIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{currentStepConfig.title}</h1>
                        <p className="text-slate-500 text-sm mt-1">Выберите объект для настройки</p>
                    </div>
                </div>
                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 uppercase tracking-wide">
                    Доступно объектов: {filteredItems.length}
                </div>
             </div>

             {/* ТАБЛИЦА */}
             <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[300px]">
                 {/* Заголовки таблицы */}
                 <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 py-3 px-6 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <div className="col-span-1">#</div>
                    <div className="col-span-1">Дом №</div>
                    <div className="col-span-4">Наименование</div>
                    <div className="col-span-3">Тип</div>
                    <div className="col-span-2">Статус</div>
                    <div className="col-span-1 text-right"></div>
                 </div>

                 {/* Пустое состояние */}
                 {filteredItems.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                            <Search size={32}/>
                        </div>
                        <h3 className="text-sm font-bold text-slate-700">Нет подходящих объектов</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                            В этом разделе пока нет объектов. Создайте их на этапе "Состав комплекса".
                        </p>
                     </div>
                 )}

                 {/* Список */}
                 <div className="divide-y divide-slate-100">
                     {filteredItems.map((item, idx) => {
                         const isRes = item.category.includes('residential');
                         
                         return (
                             <div 
                                key={item.id} 
                                onClick={() => onSelect(item.id)}
                                className="grid grid-cols-12 items-center py-3 px-6 hover:bg-blue-50/40 cursor-pointer transition-colors group"
                             >
                                 {/* Индекс */}
                                 <div className="col-span-1 text-xs font-bold text-slate-300 group-hover:text-blue-300">{idx + 1}</div>
                                 
                                 {/* Номер дома */}
                                 <div className="col-span-1">
                                     <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs shadow-sm border ${isRes ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-amber-700'}`}>
                                         {item.houseNumber || '?'}
                                     </div>
                                 </div>

                                 {/* Наименование (БЕЗ ID) */}
                                 <div className="col-span-4 pr-4">
                                     <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors line-clamp-1">{item.label}</div>
                                 </div>

                                 {/* Тип */}
                                 <div className="col-span-3 pr-4">
                                     <div className="text-xs font-medium text-slate-600 line-clamp-1" title={item.type}>
                                         {item.type}
                                     </div>
                                     {item.category === 'residential_multiblock' && (
                                         <span className="text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 mt-1 inline-block">
                                             {item.resBlocks} жил. / {item.nonResBlocks} нежил.
                                         </span>
                                     )}
                                 </div>

                                 {/* Статус */}
                                 <div className="col-span-2">
                                     <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase border ${getStageStyle(item.stage)}`}>
                                         {item.stage || 'Проект'}
                                     </span>
                                 </div>

                                 {/* Стрелка */}
                                 <div className="col-span-1 flex justify-end">
                                     <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-300 shadow-sm group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white transition-all">
                                         <ArrowRight size={14} />
                                     </div>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>
        </div>
    );
}