import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  FileText,
  Clock,
  Loader2,
  Save,
  Wand2,
  Building,
  CheckCircle2,
  AlertCircle,
  Users,
  Plus,
  Trash2,
  Briefcase,
  UserCog,
  Landmark
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDirectProjectInfo } from '../../hooks/api/useDirectProjectInfo';
import { Card, SectionTitle, Label, Input, Button, useReadOnly } from '../ui/UIKit';
import { calculateProgress } from '../../lib/utils';
import { useCatalog } from '../../hooks/useCatalogs';
import { createVirtualComplexCadastre, formatComplexCadastre } from '../../lib/cadastre';

const STATUS_CONFIG = {
  'Проектный': { color: 'bg-purple-500', text: 'Проектирование', icon: FileText },
  'Строящийся': { color: 'bg-blue-500', text: 'Стройка идет', icon: Building },
  'Готовый к вводу': { color: 'bg-orange-500', text: 'Сдача ГК', icon: AlertCircle },
  'Введенный': { color: 'bg-emerald-500', text: 'Объект сдан', icon: CheckCircle2 }
};

const PARTICIPANT_ROLES = [
  { key: 'developer', label: 'Застройщик', icon: Briefcase },
  { key: 'contractor', label: 'Подрядчик', icon: UserCog },
  { key: 'customer', label: 'Заказчик', icon: Landmark }
];

export default function PassportEditor() {
  const { projectId } = useProject();
  const isReadOnly = useReadOnly();

  const {
    complexInfo,
    cadastre,
    participants,
    documents,
    isLoading,
    updateProjectInfo,
    updateParticipant,
    upsertDocument,
    deleteDocument,
    isSaving
  } = useDirectProjectInfo(projectId);

  const [localInfo, setLocalInfo] = useState({
    name: '',
    status: 'Проектный',
    region: '',
    district: '',
    street: '',
    landmark: '',
    dateStartProject: '',
    dateEndProject: '',
    dateStartFact: '',
    dateEndFact: ''
  });

  const [localCadastre, setLocalCadastre] = useState({
    number: '',
    address: '',
    area: ''
  });

  const [participantDrafts, setParticipantDrafts] = useState({});
  const [newDoc, setNewDoc] = useState({ name: '', type: '', number: '', date: '', url: '' });
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);

  useEffect(() => {
    const safeComplexInfo = /** @type {any} */ (complexInfo || {});
    const safeCadastre = /** @type {any} */ (cadastre || {});

    if (!isLoading && Object.keys(safeComplexInfo).length > 0 && !isInitialDataLoaded) {
      setLocalInfo((prev) => ({
        ...prev,
        ...safeComplexInfo,
        name: safeComplexInfo.name || '',
        status: safeComplexInfo.status || 'Проектный',
        region: safeComplexInfo.region || '',
        district: safeComplexInfo.district || '',
        street: safeComplexInfo.street || '',
        landmark: safeComplexInfo.landmark || '',
        dateStartProject: safeComplexInfo.dateStartProject || '',
        dateEndProject: safeComplexInfo.dateEndProject || '',
        dateStartFact: safeComplexInfo.dateStartFact || '',
        dateEndFact: safeComplexInfo.dateEndFact || ''
      }));

      if (Object.keys(safeCadastre).length > 0) {
        setLocalCadastre((prev) => ({
          ...prev,
          ...safeCadastre,
          number: formatComplexCadastre(safeCadastre.number || '')
        }));
      }

      setIsInitialDataLoaded(true);
    }
  }, [complexInfo, cadastre, isLoading, isInitialDataLoaded]);

  useEffect(() => {
    setParticipantDrafts(participants || {});
  }, [participants]);

  useEffect(() => {
    if (!isInitialDataLoaded || isReadOnly) return;

    const timer = setTimeout(() => {
      updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
    }, 1500);

    return () => clearTimeout(timer);
  }, [localInfo, localCadastre, updateProjectInfo, isReadOnly, isInitialDataLoaded]);

  const handleInfoChange = (field, value) => setLocalInfo((prev) => ({ ...prev, [field]: value }));
  const handleCadastreChange = (field, value) => setLocalCadastre((prev) => ({
    ...prev,
    [field]: field === 'number' ? formatComplexCadastre(value) : value
  }));

  const handleManualSave = async () => {
    await updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
  };

  const handleParticipantChange = (role, field, value) => {
    setParticipantDrafts((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        role,
        [field]: value
      }
    }));
  };

  const handleParticipantSave = async (role) => {
    await updateParticipant({ role, data: participantDrafts[role] || {} });
  };

  const handleAddDocument = async () => {
    if (!newDoc.name?.trim()) return;
    await upsertDocument(newDoc);
    setNewDoc({ name: '', type: '', number: '', date: '', url: '' });
  };

  const autoFill = () => {
    if (isReadOnly) return;
    setLocalInfo((prev) => ({
      ...prev,
      status: 'Строящийся',
      region: 'Ташкент',
      district: 'Мирзо-Улугбекский',
      dateStartProject: '2024-01-01',
      dateEndProject: '2026-12-31'
    }));
    setLocalCadastre((prev) => ({ ...prev, number: createVirtualComplexCadastre(), area: '2.5' }));
  };

  const { options: projectStatusOptions } = useCatalog('dict_project_statuses');
  const statusConfig = STATUS_CONFIG[localInfo.status] || STATUS_CONFIG['Проектный'];
  const StatusIcon = statusConfig?.icon || LayoutDashboard;
  const progress = calculateProgress(localInfo.dateStartProject, localInfo.dateEndProject);

  if (isLoading && !isInitialDataLoaded) {
    return (
      <div className="p-20 text-center">
        <Loader2 className="animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full px-6 pb-20 animate-in fade-in duration-500 space-y-6">
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900/60" />

        <div className="relative z-10 p-6 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-blue-200/80 font-semibold">Паспорт объекта</div>
              <h1 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
                {localInfo.name || 'Новый жилой комплекс'}
              </h1>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                <MapPin size={14} />
                <span>{localInfo.street || 'Адрес не указан'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start">
              <Button
                onClick={autoFill}
                disabled={isReadOnly}
                variant="secondary"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Wand2 size={15} className="mr-1" />
                Автозаполнение
              </Button>
              <Button onClick={handleManualSave} disabled={isReadOnly || isSaving} className="bg-blue-500 hover:bg-blue-400 text-white">
                {isSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                Сохранить
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs text-slate-300 mb-2">Статус</div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.color}`} />
                <StatusIcon size={16} className="text-blue-200" />
                <select
                  value={localInfo.status || 'Проектный'}
                  onChange={(e) => handleInfoChange('status', e.target.value)}
                  disabled={isReadOnly}
                  className="bg-transparent text-sm font-semibold text-white outline-none w-full"
                >
                  {projectStatusOptions.map((s) => (
                    <option key={s.code} value={s.label} className="text-slate-900">
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs text-slate-300 mb-2">Кадастровый номер</div>
              <div className="text-sm font-semibold truncate">{localCadastre.number || 'Не указан'}</div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs text-slate-300 mb-2">Прогресс (план)</div>
              <div className="text-sm font-semibold">{progress}%</div>
              <div className="h-2 rounded-full bg-white/15 mt-2 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6 shadow-sm">
            <SectionTitle icon={MapPin}>Основные данные</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-4">
                <div>
                  <Label>Наименование</Label>
                  <Input value={localInfo.name} onChange={(e) => handleInfoChange('name', e.target.value)} placeholder="Название ЖК" disabled={isReadOnly} />
                </div>
                <div>
                  <Label>Кадастровый номер</Label>
                  <Input value={localCadastre.number} onChange={(e) => handleCadastreChange('number', e.target.value)} placeholder="10:09:03:02:01:0021" disabled={isReadOnly} />
                </div>
                <div>
                  <Label>Адрес</Label>
                  <Input value={localInfo.street} onChange={(e) => handleInfoChange('street', e.target.value)} placeholder="Улица, дом" disabled={isReadOnly} />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Регион</Label>
                  <Input value={localInfo.region} onChange={(e) => handleInfoChange('region', e.target.value)} disabled={isReadOnly} />
                </div>
                <div>
                  <Label>Район</Label>
                  <Input value={localInfo.district} onChange={(e) => handleInfoChange('district', e.target.value)} disabled={isReadOnly} />
                </div>
                <div>
                  <Label>Ориентир</Label>
                  <Input value={localInfo.landmark} onChange={(e) => handleInfoChange('landmark', e.target.value)} disabled={isReadOnly} />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6 shadow-sm">
            <SectionTitle icon={Clock}>График реализации</SectionTitle>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Начало (План)</Label>
                  <Input type="date" value={localInfo.dateStartProject || ''} onChange={(e) => handleInfoChange('dateStartProject', e.target.value)} disabled={isReadOnly} className="text-xs" />
                </div>
                <div>
                  <Label>Окончание (План)</Label>
                  <Input type="date" value={localInfo.dateEndProject || ''} onChange={(e) => handleInfoChange('dateEndProject', e.target.value)} disabled={isReadOnly} className="text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div>
                  <Label className="text-slate-400">Начало (Факт)</Label>
                  <Input type="date" value={localInfo.dateStartFact || ''} onChange={(e) => handleInfoChange('dateStartFact', e.target.value)} disabled={isReadOnly} className="text-xs bg-slate-50" />
                </div>
                <div>
                  <Label className="text-slate-400">Окончание (Факт)</Label>
                  <Input type="date" value={localInfo.dateEndFact || ''} onChange={(e) => handleInfoChange('dateEndFact', e.target.value)} disabled={isReadOnly} className="text-xs bg-slate-50" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-6 shadow-sm">
        <SectionTitle icon={Users}>Участники проекта</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {PARTICIPANT_ROLES.map((roleItem) => {
            const { key, label } = roleItem;
            const row = participantDrafts[key] || { role: key, name: '', inn: '' };
            return (
              <div key={key} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  {React.createElement(roleItem.icon, { size: 14, className: 'text-blue-600' })} {label}
                </div>
                <div>
                  <Label>Наименование</Label>
                  <Input value={row.name || ''} onChange={(e) => handleParticipantChange(key, 'name', e.target.value)} disabled={isReadOnly} />
                </div>
                <div>
                  <Label>ИНН</Label>
                  <Input value={row.inn || ''} onChange={(e) => handleParticipantChange(key, 'inn', e.target.value)} disabled={isReadOnly} />
                </div>
                <Button onClick={() => handleParticipantSave(key)} disabled={isReadOnly || isSaving} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                  <Save size={14} className="mr-2" /> Сохранить
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <SectionTitle icon={FileText}>Документы проекта</SectionTitle>
        <div className="overflow-x-auto mt-4 border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-3 text-left">Название</th>
                <th className="p-3 text-left">Тип</th>
                <th className="p-3 text-left">Номер</th>
                <th className="p-3 text-left">Дата</th>
                <th className="p-3 text-left">URL</th>
                <th className="p-3 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {(documents || []).map((doc) => (
                <tr key={doc.id} className="border-t border-slate-100">
                  <td className="p-3">{doc.name}</td>
                  <td className="p-3">{doc.type || '-'}</td>
                  <td className="p-3">{doc.number || '-'}</td>
                  <td className="p-3">{doc.date || '-'}</td>
                  <td className="p-3 truncate max-w-[260px]">{doc.url || '-'}</td>
                  <td className="p-3">
                    <button onClick={() => deleteDocument(doc.id)} disabled={isReadOnly} className="px-2 py-1 rounded border text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}

              <tr className="border-t border-slate-200 bg-slate-50/70">
                <td className="p-2"><Input value={newDoc.name} onChange={(e) => setNewDoc((d) => ({ ...d, name: e.target.value }))} placeholder="Название документа" disabled={isReadOnly} /></td>
                <td className="p-2"><Input value={newDoc.type} onChange={(e) => setNewDoc((d) => ({ ...d, type: e.target.value }))} placeholder="Тип" disabled={isReadOnly} /></td>
                <td className="p-2"><Input value={newDoc.number} onChange={(e) => setNewDoc((d) => ({ ...d, number: e.target.value }))} placeholder="Номер" disabled={isReadOnly} /></td>
                <td className="p-2"><Input type="date" value={newDoc.date} onChange={(e) => setNewDoc((d) => ({ ...d, date: e.target.value }))} disabled={isReadOnly} /></td>
                <td className="p-2"><Input value={newDoc.url} onChange={(e) => setNewDoc((d) => ({ ...d, url: e.target.value }))} placeholder="https://..." disabled={isReadOnly} /></td>
                <td className="p-2">
                  <Button onClick={handleAddDocument} disabled={isReadOnly || !newDoc.name.trim()} className="bg-blue-600 text-white hover:bg-blue-500 whitespace-nowrap">
                    <Plus size={14} className="mr-2" /> Добавить
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
