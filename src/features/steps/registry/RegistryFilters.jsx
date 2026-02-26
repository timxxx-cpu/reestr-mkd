import React from 'react';
import { Search, Filter, Layers, Activity, Building2, LayoutGrid } from 'lucide-react';
import { Input, TabButton } from '@components/ui/UIKit';
import { useProject } from '@context/ProjectContext';

const FilterSelect = ({ value, onChange, options, placeholder, icon: Icon }) => (
  <div className="relative w-full md:w-36 lg:w-40">
    {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full h-10 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 appearance-none cursor-pointer ${Icon ? 'pl-9' : 'pl-3'} pr-8 truncate transition-all`}
    >
      <option value="all">{placeholder}</option>
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M1 1L5 5L9 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  </div>
);

// Кастомная кнопка для темной панели (локальная копия стиля)
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

export default function RegistryFilters({
  filters,
  setFilters,
  options,
  searchTerm,
  setSearchTerm,
  showEntranceFilter = true,
}) {
  const { composition } = useProject();

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 px-4 md:px-0">
      {/* Выбор здания (Tabs) */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-full xl:w-max overflow-x-auto shadow-inner border border-slate-700 custom-scrollbar">
        <DarkTabButton
          active={filters.building === 'all'}
          onClick={() => handleFilterChange('building', 'all')}
          icon={LayoutGrid}
        >
          Все объекты
        </DarkTabButton>
        <div className="w-px h-5 bg-slate-700 mx-1 shrink-0"></div>
        {composition.map(b => (
          <DarkTabButton
            key={b.id}
            active={filters.building === b.id}
            onClick={() => handleFilterChange('building', b.id)}
            icon={Building2}
          >
            {b.label} <span className="opacity-50 text-[10px] ml-1">#{b.houseNumber}</span>
          </DarkTabButton>
        ))}
      </div>

      {/* Селекты и Поиск */}
      <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
        {showEntranceFilter && (
          <FilterSelect
            icon={Filter}
            value={filters.entrance}
            onChange={val => handleFilterChange('entrance', val)}
            options={options.entrances || []}
            placeholder="Все подъезды"
          />
        )}

        <FilterSelect
          icon={Layers}
          value={filters.floor}
          onChange={val => handleFilterChange('floor', val)}
          options={options.floors || []}
          placeholder="Все этажи"
        />

        <FilterSelect
          icon={Activity}
          value={filters.status}
          onChange={val => handleFilterChange('status', val)}
          options={['Готов', 'Не готов']}
          placeholder="Любой статус"
        />

        <div className="relative w-full md:w-48 lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Поиск по номеру..."
            className="pl-9 h-10 text-xs font-bold w-full"
          />
        </div>
      </div>
    </div>
  );
}
