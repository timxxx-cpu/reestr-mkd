import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDirectProjectInfo } from '../../hooks/api/useDirectProjectInfo';
import { Card, SectionTitle, Label, Input, Button, useReadOnly } from '../ui/UIKit';
import { calculateProgress } from '../../lib/utils';
import { useCatalog } from '../../hooks/useCatalogs';

const STATUS_CONFIG = {
  'Проектный': { color: 'bg-purple-500', text: 'Проектирование', icon: FileText },
  'Строящийся': { color: 'bg-blue-500', text: 'Стройка идет', icon: Building },
  'Готовый к вводу': { color: 'bg-orange-500', text: 'Сдача ГК', icon: AlertCircle },
  'Введенный': { color: 'bg-emerald-500', text: 'Объект сдан', icon: CheckCircle2 }
};

export default function PassportEditor() {
  const { projectId } = useProject();
  const isReadOnly = useReadOnly();

  const {
    complexInfo,
    cadastre,
    isLoading,
    updateProjectInfo,
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

  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && complexInfo && Object.keys(complexInfo).length > 0 && !dataLoadedRef.current) {
      setLocalInfo((prev) => ({
        ...prev,
        ...complexInfo,
        name: complexInfo.name || '',
        status: complexInfo.status || 'Проектный',
        region: complexInfo.region || '',
        district: complexInfo.district || '',
        street: complexInfo.street || '',
        landmark: complexInfo.landmark || '',
        dateStartProject: complexInfo.dateStartProject || '',
        dateEndProject: complexInfo.dateEndProject || '',
        dateStartFact: complexInfo.dateStartFact || '',
        dateEndFact: complexInfo.dateEndFact || ''
      }));

      if (cadastre) {
        setLocalCadastre((prev) => ({
          ...prev,
          ...cadastre,
          number: cadastre.number || '',
          address: cadastre.address || '',
          area: cadastre.area || ''
        }));
      }

      dataLoadedRef.current = true;
    }
  }, [complexInfo, cadastre, isLoading]);

  useEffect(() => {
    if (!dataLoadedRef.current || isReadOnly) return;

    const timer = setTimeout(() => {
      updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
    }, 1500);

    return () => clearTimeout(timer);
  }, [localInfo, localCadastre, updateProjectInfo, isReadOnly]);

  const handleInfoChange = (field, value) => setLocalInfo((prev) => ({ ...prev, [field]: value }));
  const handleCadastreChange = (field, value) => setLocalCadastre((prev) => ({ ...prev, [field]: value }));

  const handleManualSave = async () => {
    await updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
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
    setLocalCadastre((prev) => ({ ...prev, number: '11:05:04:02:0099', area: '2.5' }));
  };

  const { options: projectStatusOptions } = useCatalog('dict_project_statuses', Object.keys(STATUS_CONFIG));
  const statusConfig = STATUS_CONFIG[localInfo.status] || STATUS_CONFIG['Проектный'];
  const StatusIcon = statusConfig?.icon || LayoutDashboard;
  const progress = calculateProgress(localInfo.dateStartProject, localInfo.dateEndProject);

  if (isLoading && !dataLoadedRef.current) {
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

              <Button
                onClick={handleManualSave}
                disabled={isReadOnly || isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin mr-1" /> : <Save size={15} className="mr-1" />}
                Сохранить
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs text-slate-300 mb-2">Статус проекта</div>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusConfig.color}`} />
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
                  <Input
                    value={localInfo.name}
                    onChange={(e) => handleInfoChange('name', e.target.value)}
                    placeholder="Название ЖК"
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label>Кадастровый номер</Label>
                  <Input
                    value={localCadastre.number}
                    onChange={(e) => handleCadastreChange('number', e.target.value)}
                    placeholder="00:00:00:00:0000"
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label>Адрес</Label>
                  <Input
                    value={localInfo.street}
                    onChange={(e) => handleInfoChange('street', e.target.value)}
                    placeholder="Улица, дом"
                    disabled={isReadOnly}
                  />
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
                  <Input
                    type="date"
                    value={localInfo.dateStartProject || ''}
                    onChange={(e) => handleInfoChange('dateStartProject', e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label>Окончание (План)</Label>
                  <Input
                    type="date"
                    value={localInfo.dateEndProject || ''}
                    onChange={(e) => handleInfoChange('dateEndProject', e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div>
                  <Label className="text-slate-400">Начало (Факт)</Label>
                  <Input
                    type="date"
                    value={localInfo.dateStartFact || ''}
                    onChange={(e) => handleInfoChange('dateStartFact', e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Окончание (Факт)</Label>
                  <Input
                    type="date"
                    value={localInfo.dateEndFact || ''}
                    onChange={(e) => handleInfoChange('dateEndFact', e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs bg-slate-50"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
