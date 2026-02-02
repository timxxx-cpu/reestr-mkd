import React from 'react';
import { ArrowLeft, Car, Box, Building2 } from 'lucide-react';
import { Button } from '../../ui/UIKit';
import { getStageColor } from '../../../lib/utils';

const PARKING_TYPE_LABELS = {
    capital: "Капитальный",
    light: "Легкие конструкции",
    open: "Открытый"
};

export default function ConfigHeader({ building, isParking, isInfrastructure, isUnderground, onBack }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                {isParking ? <Car size={140}/> : isInfrastructure ? <Box size={140}/> : <Building2 size={140}/>}
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
                <div className="flex gap-5">
                    <button onClick={onBack} className="mt-1 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors h-min">
                        <ArrowLeft size={24}/>
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStageColor(building.stage)}`}>
                                {building.stage || 'Проектный'}
                            </span>
                            <span className="text-xs font-bold text-slate-400">ID: {building.id.slice(-6)}</span>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">{building.label}</h1>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Дом №</span><span className="font-bold bg-slate-100 px-2 py-0.5 rounded">{building.houseNumber}</span></div>
                            <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Тип</span><span className="font-medium">{building.type}</span></div>
                            {isParking && <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Вид</span><span className="font-medium">{isUnderground ? 'Подземный' : 'Наземный'} {building.constructionType && ` • ${PARKING_TYPE_LABELS[building.constructionType] || building.constructionType}`}</span></div>}
                            {isInfrastructure && <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Вид</span><span className="font-medium">{building.infraType || 'Не указан'}</span></div>}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onBack}>Закрыть</Button>
                </div>
            </div>
        </div>
    );
}