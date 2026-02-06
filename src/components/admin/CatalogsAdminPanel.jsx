import React, { useMemo, useState } from 'react';
import { Settings2, Plus, Save, Power, PowerOff, ArrowLeft, Home } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CatalogService, CATALOG_TABLES } from '../../lib/catalog-service';

const TITLES = {
  dict_project_statuses: 'Статусы проекта',
  dict_application_statuses: 'Статусы заявок',
  dict_external_systems: 'Внешние системы',
  dict_foundations: 'Фундамент',
  dict_wall_materials: 'Материал стен',
  dict_slab_types: 'Перекрытия',
  dict_roof_types: 'Кровля',
  dict_light_structure_types: 'Легкие конструкции',
  dict_parking_types: 'Тип паркинга',
  dict_parking_construction_types: 'Конструкция паркинга',
  dict_infra_types: 'Типы инфраструктуры',
  dict_mop_types: 'Типы МОП',
  dict_unit_types: 'Типы помещений',
  dict_room_types: 'Типы комнат'
};

export default function CatalogsAdminPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [active, setActive] = useState(CATALOG_TABLES[0]);
  const [draft, setDraft] = useState({ code: '', label: '', sort_order: 100, is_active: true });

  const { data = [], isLoading } = useQuery({
    queryKey: ['catalog-admin', active],
    queryFn: () => CatalogService.getCatalogAll(active)
  });

  const rows = useMemo(() => data, [data]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['catalog-admin', active] });
    await qc.invalidateQueries({ queryKey: ['catalog', active] });
  };

  const save = async (item) => {
    await CatalogService.upsertCatalogItem(active, item);
    await refresh();
  };

  const toggle = async (item) => {
    await CatalogService.setCatalogItemActive(active, item.id, !item.is_active);
    await refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800 font-black text-xl">
            <Settings2 size={20} /> Админка справочников
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Назад
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-semibold inline-flex items-center gap-2"
            >
              <Home size={16} /> На рабочий стол
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATALOG_TABLES.map((t) => (
            <button key={t} onClick={() => setActive(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${active === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
              {TITLES[t] || t}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">code</th>
                <th className="text-left p-2">label</th>
                <th className="text-left p-2">sort</th>
                <th className="text-left p-2">active</th>
                <th className="text-left p-2">actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-3 text-slate-400">Загрузка...</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.code}</td>
                  <td className="p-2">{r.label}</td>
                  <td className="p-2">{r.sort_order}</td>
                  <td className="p-2">{r.is_active ? 'yes' : 'no'}</td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => save(r)} className="px-2 py-1 text-xs rounded border"><Save size={12}/></button>
                    <button onClick={() => toggle(r)} className="px-2 py-1 text-xs rounded border">{r.is_active ? <PowerOff size={12}/> : <Power size={12}/>}</button>
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-slate-50">
                <td className="p-2"><input className="border rounded px-2 py-1 w-full" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} /></td>
                <td className="p-2"><input className="border rounded px-2 py-1 w-full" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} /></td>
                <td className="p-2"><input className="border rounded px-2 py-1 w-24" type="number" value={draft.sort_order} onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))} /></td>
                <td className="p-2"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))} /></td>
                <td className="p-2">
                  <button
                    onClick={async () => {
                      await save(draft);
                      setDraft({ code: '', label: '', sort_order: 100, is_active: true });
                    }}
                    className="px-2 py-1 text-xs rounded border flex items-center gap-1"
                  ><Plus size={12}/>Добавить</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
