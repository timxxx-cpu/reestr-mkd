import React from 'react';
import { ChevronRight, Home, LayoutGrid } from 'lucide-react';

/**
 * @param {Object} props
 * @param {string} [props.projectName]
 * @param {string} [props.stepTitle]
 * @param {string} [props.buildingName]
 * @param {function(): void} [props.onBackToStep]
 */
export default function Breadcrumbs({ projectName, stepTitle, buildingName, onBackToStep }) {
    return (
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 bg-white/50 p-2 rounded-xl backdrop-blur-sm w-max border border-slate-200/50">
            {/* 1. Название проекта */}
            <div className="flex items-center gap-1 font-bold text-slate-400">
                <Home size={14} />
                <span className="max-w-[150px] truncate">{projectName || 'Новый проект'}</span>
            </div>

            <ChevronRight size={14} className="text-slate-300" />

            {/* 2. Название шага (Раздела) */}
            <div className={`flex items-center gap-1 font-bold ${!buildingName ? 'text-slate-800' : 'text-slate-400 hover:text-blue-600 transition-colors cursor-pointer'}`}
                 onClick={buildingName ? onBackToStep : undefined}
                 title={buildingName ? "Вернуться к выбору дома" : ""}
            >
                <LayoutGrid size={14} />
                <span>{stepTitle}</span>
            </div>

            {/* 3. Название здания (если мы внутри редактора) */}
            {buildingName && (
                <>
                    <ChevronRight size={14} className="text-slate-300" />
                    <div className="flex items-center gap-1 font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        <span>{buildingName}</span>
                    </div>
                </>
            )}
        </div>
    );
}