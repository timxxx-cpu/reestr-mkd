import React, { useState, useEffect } from 'react';
import { LayoutGrid } from 'lucide-react';
import BasementParamsCard from '../cards/BasementParamsCard';
import BasementCommunicationsCard from '../cards/BasementCommunicationsCard';

const DarkTabButton = ({ active, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`
      px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2
      ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400'
          : 'text-slate-400 hover:text-white hover:bg-slate-700'
      }
    `}
  >
    {Icon && <Icon size={14} className={active ? 'text-blue-200' : 'opacity-70'} />}
    {children}
  </button>
);

export default function BasementStandardView({
  basements,
  updateBasementField,
  isMultiblockResidential,
  blocks,
  toggleBlockLink,
  buildDefaultCommunications,
  toggleCommunication,
  isReadOnly,
  buildingGeometry,      // <-- Добавили прием пропсов
  saveProjectImmediate   // <-- Добавили прием пропсов
}) {
  const [activeTabId, setActiveTabId] = useState(() => basements[0]?.id || null);

  useEffect(() => {
    if (basements.length > 0 && !basements.some(b => b.id === activeTabId)) {
      setActiveTabId(basements[0].id);
    }
  }, [basements, activeTabId]);

  const currentBasement = basements.find(b => b.id === activeTabId);

  if (!currentBasement) return null;

  const communications = buildDefaultCommunications(currentBasement.communications || {});

  return (
    <div className="animate-in fade-in duration-300">
      {/* Переключатель табов */}
      {basements.length > 1 && (
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-max overflow-x-auto max-w-full mb-8 shadow-inner border border-slate-700">
          {basements.map((base, idx) => (
            <DarkTabButton
              key={base.id}
              active={activeTabId === base.id}
              onClick={() => setActiveTabId(base.id)}
              icon={LayoutGrid}
            >
              Подвал {idx + 1}
            </DarkTabButton>
          ))}
        </div>
      )}

      {/* Grid Layout для карточек */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          {/* Сюда передаем геометрию и функцию сохранения */}
          <BasementParamsCard
            basement={currentBasement}
            updateBasementField={updateBasementField}
            isMultiblockResidential={isMultiblockResidential}
            blocks={blocks}
            toggleBlockLink={toggleBlockLink}
            isReadOnly={isReadOnly}
            buildingGeometry={buildingGeometry}         // <-- Передаем в карточку
            saveProjectImmediate={saveProjectImmediate} // <-- Передаем в карточку
          />
        </div>

        <div className="xl:col-span-4 space-y-6">
          {/* Отсюда нужно было УБРАТЬ пропсы геометрии, если они случайно сюда попали */}
          <BasementCommunicationsCard
            basement={currentBasement}
            communications={communications}
            toggleCommunication={toggleCommunication}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
}