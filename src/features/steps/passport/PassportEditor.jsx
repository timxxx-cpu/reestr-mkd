import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  AlertTriangle,
  Users,
  Plus,
  Trash2,
  Briefcase,
  UserCog,
  Landmark,
  Layers,
  CalendarDays
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectProjectInfo } from '@hooks/api/useDirectProjectInfo';
import { Card, SectionTitle, Label, Input, Select, Button, useReadOnly } from '@components/ui/UIKit';
import { FullIdentifierCompact } from '@components/ui/IdentifierBadge';
import { useCatalog } from '@hooks/useCatalogs';
import { createVirtualComplexCadastre, formatComplexCadastre } from '@lib/cadastre';
import shp from 'shpjs';
import { ApiService } from '@lib/api-service';
import { GeometryPickerMap, BASEMAP_OPTIONS } from '@components/maps/GeometryPickerMap';
import { normalizeShpFeatures } from '@lib/geometry-utils';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_CONFIG = {
  Проектный: { color: 'bg-purple-500', text: 'Проектирование', icon: FileText },
  Строящийся: { color: 'bg-blue-500', text: 'Стройка идет', icon: Building },
  'Готовый к вводу': { color: 'bg-orange-500', text: 'Сдача ГК', icon: AlertCircle },
  Введенный: { color: 'bg-emerald-500', text: 'Объект сдан', icon: CheckCircle2 },
};

const PARTICIPANT_ROLES = [
  { key: 'developer', label: 'Застройщик', icon: Briefcase },
  { key: 'contractor', label: 'Подрядчик', icon: UserCog },
  { key: 'customer', label: 'Заказчик', icon: Landmark },
];

const PassportEditor = () => {
  const { projectId } = useProject();
  const isReadOnly = useReadOnly();
  const queryClient = useQueryClient();

  const [activeCandidateId, setActiveCandidateId] = useState(null);

  const {
    complexInfo,
    cadastre,
    landPlot,
    participants,
    documents,
    isLoading,
    updateProjectInfo,
    updateParticipant,
    upsertDocument,
    deleteDocument,
    isSaving,
  } = useDirectProjectInfo(projectId);

  const [localInfo, setLocalInfo] = useState({
    name: '',
    ujCode: '',
    status: 'Проектный',
    region: '',
    district: '',
    street: '',
    addressId: null,
    regionSoato: '',
    districtSoato: '',
    streetId: '',
    mahallaId: '',
    mahalla: '',
    buildingNo: '',
    landmark: '',
    dateStartProject: '',
    dateEndProject: '',
    dateStartFact: '',
    dateEndFact: '',
  });

  const [localCadastre, setLocalCadastre] = useState({
    number: '',
    address: '',
    area: '',
  });

  const [participantDrafts, setParticipantDrafts] = useState({});
  const [newDoc, setNewDoc] = useState({ name: '', type: '', number: '', date: '', url: '' });
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const [geometryCandidates, setGeometryCandidates] = useState([]);
  const [selectedLandPlotCandidateId, setSelectedLandPlotCandidateId] = useState(null);
  const [isImportingGeometry, setIsImportingGeometry] = useState(false);
  const [geometryError, setGeometryError] = useState('');
  const [basemap, setBasemap] = useState('osm');
  const [isDrawingGeometry, setIsDrawingGeometry] = useState(false);
  const [draftPolygonPoints, setDraftPolygonPoints] = useState([]);
  const shpInputRef = useRef(null);

  useEffect(() => {
    const safeComplexInfo = /** @type {any} */ (complexInfo || {});
    const safeCadastre = /** @type {any} */ (cadastre || {});

    if (!isLoading && Object.keys(safeComplexInfo).length > 0 && !isInitialDataLoaded) {
      setLocalInfo(prev => ({
        ...prev,
        ...safeComplexInfo,
        name: safeComplexInfo.name || '',
        status: safeComplexInfo.status || 'Проектный',
        region: safeComplexInfo.region || '',
        district: safeComplexInfo.district || '',
        street: safeComplexInfo.street || '',
        addressId: safeComplexInfo.addressId || null,
        regionSoato: safeComplexInfo.regionSoato || '',
        districtSoato: safeComplexInfo.districtSoato || '',
        streetId: safeComplexInfo.streetId || '',
        mahallaId: safeComplexInfo.mahallaId || '',
        mahalla: safeComplexInfo.mahalla || '',
        buildingNo: safeComplexInfo.buildingNo || '',
        landmark: safeComplexInfo.landmark || '',
        dateStartProject: safeComplexInfo.dateStartProject || '',
        dateEndProject: safeComplexInfo.dateEndProject || '',
        dateStartFact: safeComplexInfo.dateStartFact || '',
        dateEndFact: safeComplexInfo.dateEndFact || '',
      }));

      if (Object.keys(safeCadastre).length > 0) {
        setLocalCadastre(prev => ({
          ...prev,
          ...safeCadastre,
          number: formatComplexCadastre(safeCadastre.number || ''),
        }));
      }

      setIsInitialDataLoaded(true);
    }
  }, [complexInfo, cadastre, isLoading, isInitialDataLoaded]);

  useEffect(() => {
    setParticipantDrafts(participants || {});
  }, [participants]);

  const reloadCandidates = async () => {
    if (!projectId) return;
    try {
      const items = await ApiService.getProjectGeometryCandidates(projectId);
      setGeometryCandidates(Array.isArray(items) ? items : []);
      const selected = (items || []).find(item => item.isSelectedLandPlot);
      setSelectedLandPlotCandidateId(selected?.id || null);
    } catch (err) {
      setGeometryError('Не удалось загрузить геометрию участка');
    }
  };

  useEffect(() => {
    reloadCandidates();
  }, [projectId]);

  useEffect(() => {
    if (!isInitialDataLoaded || isReadOnly) return;

    let isActive = true;
    const timer = setTimeout(async () => {
      try {
        setIsAutoSaving(true);
        setSaveError('');
        await updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
        if (isActive) setLastSavedAt(new Date());
      } catch (err) {
        if (isActive) setSaveError(err?.message || 'Не удалось выполнить автосохранение');
      } finally {
        if (isActive) setIsAutoSaving(false);
      }
    }, 1500);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [localInfo, localCadastre, updateProjectInfo, isReadOnly, isInitialDataLoaded]);

  const handleInfoChange = (field, value) => setLocalInfo(prev => ({ ...prev, [field]: value }));
  const handleCadastreChange = (field, value) =>
    setLocalCadastre(prev => ({
      ...prev,
      [field]: field === 'number' ? formatComplexCadastre(value) : value,
    }));

  const handleManualSave = async () => {
    try {
      setSaveError('');
      await updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
      setLastSavedAt(new Date());
    } catch (err) {
      setSaveError(err?.message || 'Не удалось сохранить изменения');
    }
  };

  const handleParticipantChange = (role, field, value) => {
    setParticipantDrafts(prev => ({
      ...prev,
      [role]: { ...(prev[role] || {}), role, [field]: value },
    }));
  };

  const handleParticipantSave = async role => {
    await updateParticipant({ role, data: participantDrafts[role] || {} });
  };

  const handleAddDocument = async () => {
    if (!newDoc.name?.trim()) return;
    await upsertDocument(newDoc);
    setNewDoc({ name: '', type: '', number: '', date: '', url: '' });
  };

  const handleImportGeometryZip = async event => {
    const file = event.target.files?.[0];
    if (!file || !projectId) return;
    setGeometryError('');
    setIsImportingGeometry(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const geojson = await shp(arrayBuffer);
      const candidates = normalizeShpFeatures(geojson);
      if (!candidates.length) throw new Error('В SHP ZIP не найдено Polygon/MultiPolygon геометрий');
      await ApiService.importProjectGeometryCandidates(projectId, candidates);
      await reloadCandidates();
    } catch (err) {
      setGeometryError(err?.message || 'Ошибка импорта геометрии');
    } finally {
      setIsImportingGeometry(false);
      event.target.value = '';
    }
  };


  const handleStartDrawGeometry = () => {
    setGeometryError('');
    setActiveCandidateId(null);
    setDraftPolygonPoints([]);
    setIsDrawingGeometry(true);
  };

  const handleCancelDrawGeometry = () => {
    setIsDrawingGeometry(false);
    setDraftPolygonPoints([]);
  };

  const handleAddDraftPoint = point => {
    setDraftPolygonPoints(prev => [...prev, point]);
  };

  const handleSaveDrawnGeometry = async () => {
    if (!projectId) return;
    if (draftPolygonPoints.length < 3) {
      setGeometryError('Для создания полигона укажите минимум 3 точки');
      return;
    }

    try {
      setGeometryError('');
      const maxSourceIndex = geometryCandidates.reduce((max, item) => {
        const val = Number(item?.sourceIndex ?? item?.source_index ?? 0);
        return Number.isFinite(val) ? Math.max(max, val) : max;
      }, 0);
      const candidate = {
        sourceIndex: maxSourceIndex + 1,
        label: 'Нарисованный контур ЖК',
        properties: { source: 'manual-draw', scope: 'project' },
        geometry: {
          type: 'Polygon',
          coordinates: [[...draftPolygonPoints, draftPolygonPoints[0]]],
        },
      };
      await ApiService.importProjectGeometryCandidates(projectId, [candidate]);
      await reloadCandidates();
      setIsDrawingGeometry(false);
      setDraftPolygonPoints([]);
    } catch (err) {
      setGeometryError(err?.message || 'Не удалось сохранить нарисованный контур');
    }
  };

  const handleAttachToProject = async () => {
    if (!activeCandidateId) return;
    try {
      await ApiService.selectProjectLandPlot(projectId, activeCandidateId);
      await reloadCandidates();
      queryClient.invalidateQueries({ queryKey: ['project-info', projectId] });
      setActiveCandidateId(null);
    } catch (err) {
      setGeometryError(err?.message || 'Не удалось прикрепить геометрию');
    }
  };

  const handleDeleteGeometry = async () => {
    if (!activeCandidateId) return;
    if (!window.confirm('Уверены, что хотите удалить этот контур?')) return;
    
    try {
      await ApiService.deleteProjectGeometryCandidate(projectId, activeCandidateId);
      setActiveCandidateId(null);
      await reloadCandidates();
    } catch (err) {
      setGeometryError(err?.message || 'Не удалось удалить геометрию');
    }
  };

  const handleDetachGeometry = async () => {
    if (!window.confirm('Уверены, что хотите открепить текущую границу от ЖК?')) return;
    
    try {
      await ApiService.unselectProjectLandPlot(projectId);
      setActiveCandidateId(null);
      await reloadCandidates(); 
      queryClient.invalidateQueries({ queryKey: ['project-info', projectId] }); 
    } catch (err) {
      setGeometryError(err?.message || 'Не удалось открепить геометрию');
    }
  };

  const autoFill = () => {
    if (isReadOnly) return;
    setLocalInfo(prev => ({
      ...prev,
      status: 'Строящийся',
      region: 'Ташкент',
      district: 'Мирзо-Улугбекский',
      dateStartProject: '2024-01-01',
      dateEndProject: '2026-12-31',
    }));
    setLocalCadastre(prev => ({ ...prev, number: createVirtualComplexCadastre(), area: '2.5' }));
  };

  const { options: projectStatusOptions } = useCatalog('dict_project_statuses');
  const { options: regionsOptions } = useCatalog('regions');
  const { options: districtsOptions } = useCatalog('districts');
  const { options: streetsOptions } = useCatalog('streets');
  const { options: makhallasOptions } = useCatalog('makhallas');

  const selectedRegion = useMemo(
    () => (regionsOptions || []).find(r => String(r.soato || '') === String(localInfo.regionSoato || '')) || null,
    [regionsOptions, localInfo.regionSoato]
  );
  const availableDistricts = useMemo(
    () => (districtsOptions || []).filter(d => !selectedRegion || d.region_id === selectedRegion.id),
    [districtsOptions, selectedRegion]
  );
  const availableStreets = useMemo(
    () => (streetsOptions || []).filter(s => !localInfo.districtSoato || String(s.district_soato || '') === String(localInfo.districtSoato || '')),
    [streetsOptions, localInfo.districtSoato]
  );
  const availableMakhallas = useMemo(
    () => (makhallasOptions || []).filter(m => !localInfo.districtSoato || String(m.district_soato || '') === String(localInfo.districtSoato || '')),
    [makhallasOptions, localInfo.districtSoato]
  );

  useEffect(() => {
    const regionName = selectedRegion?.name_ru || selectedRegion?.name_uz || localInfo.region || '';
    const selectedDistrict = availableDistricts.find(d => String(d.soato || '') === String(localInfo.districtSoato || ''));
    const districtName = selectedDistrict?.name_ru || selectedDistrict?.name_uz || localInfo.district || '';
    const selectedStreet = availableStreets.find(s => String(s.id || '') === String(localInfo.streetId || ''));
    const streetName = selectedStreet?.name || '';
    const selectedMahalla = availableMakhallas.find(m => String(m.id || '') === String(localInfo.mahallaId || ''));
    const mahallaName = selectedMahalla?.name || localInfo.mahalla || '';
    const fullStreet = [regionName, districtName, mahallaName, streetName, localInfo.buildingNo ? `д. ${localInfo.buildingNo}` : null].filter(Boolean).join(', ');
    setLocalInfo(prev => {
      const nextStreet = fullStreet || prev.street;
      if (prev.region === regionName && prev.district === districtName && prev.mahalla === mahallaName && prev.street === nextStreet) return prev;
      return { ...prev, region: regionName, district: districtName, mahalla: mahallaName, street: nextStreet };
    });
  }, [selectedRegion, availableDistricts, availableStreets, availableMakhallas, localInfo.districtSoato, localInfo.streetId, localInfo.mahallaId, localInfo.buildingNo]);
  const statusConfig = STATUS_CONFIG[localInfo.status] || STATUS_CONFIG['Проектный'];
  
  const saveStatusLabel = useMemo(() => {
    if (isReadOnly) return 'Режим просмотра';
    if (isSaving || isAutoSaving) return 'Сохранение...';
    if (saveError) return 'Ошибка';
    if (lastSavedAt) return `Сохранено: ${lastSavedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    return 'Автосохранение';
  }, [isReadOnly, isSaving, isAutoSaving, saveError, lastSavedAt]);

  const dateWarnings = useMemo(() => {
    const warnings = [];
    if (localInfo.dateStartProject && localInfo.dateEndProject && localInfo.dateStartProject > localInfo.dateEndProject) {
      warnings.push('Плановые даты заполнены некорректно: дата начала позже даты окончания.');
    }
    if (localInfo.dateStartFact && localInfo.dateEndFact && localInfo.dateStartFact > localInfo.dateEndFact) {
      warnings.push('Фактические даты заполнены некорректно: дата начала позже даты окончания.');
    }
    return warnings;
  }, [localInfo.dateStartProject, localInfo.dateEndProject, localInfo.dateStartFact, localInfo.dateEndFact]);

  if (isLoading && !isInitialDataLoaded) {
    return (
      <div className="p-20 flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 lg:px-8 pb-24 animate-in fade-in duration-500 space-y-4 max-w-[1600px] mx-auto">
      
      {/* СЖАТЫЙ HEADER HERO */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white shadow-md border border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900/40" />
        
        <div className="relative z-10 p-4 md:px-6 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200 bg-blue-500/20 rounded border border-blue-400/20">
                Паспорт Объекта
              </span>
              {complexInfo?.ujCode && (
                <div className="scale-90 origin-left">
                  <FullIdentifierCompact 
                    fullCode={complexInfo.ujCode}
                    variant="default"
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {localInfo.name || 'Новый жилой комплекс'}
            </h1>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-300 font-medium">
              <MapPin size={14} className="text-blue-400" />
              <span>{localInfo.street || 'Адрес не указан'}</span>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end">
            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-lg border border-white/10 backdrop-blur-sm">
              <Button
                onClick={autoFill}
                disabled={isReadOnly}
                variant="ghost"
                className="text-slate-300 hover:text-white hover:bg-white/10 h-8 px-3 text-xs"
              >
                <Wand2 size={14} className="mr-1.5" />
                Автозаполнение
              </Button>
              <div className="w-px h-4 bg-white/10 mx-0.5" />
              <Button
                onClick={handleManualSave}
                disabled={isReadOnly || isSaving || isAutoSaving}
                className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-4 text-xs shadow"
              >
                {isSaving || isAutoSaving ? (
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                ) : (
                  <Save size={14} className="mr-1.5" />
                )}
                Сохранить
              </Button>
            </div>
            <div className={`mt-1.5 text-[10px] font-medium flex items-center gap-1.5 ${saveError ? 'text-red-400' : 'text-slate-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isAutoSaving ? 'bg-blue-400 animate-pulse' : saveError ? 'bg-red-400' : 'bg-emerald-400'}`} />
              {saveStatusLabel}
            </div>
          </div>
        </div>
      </div>

      {/* ERRORS / WARNINGS */}
      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2 shadow-sm">
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <div>{saveError}</div>
        </div>
      )}
      {dateWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2 shadow-sm">
          <AlertTriangle className="shrink-0 mt-0.5" size={16} />
          <div className="space-y-1">
            {dateWarnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        </div>
      )}

      {/* MAIN 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pt-2">
        
        {/* ================= LEFT COLUMN: DATA ================= */}
        <div className="xl:col-span-7 space-y-6">
          
          <Card className="p-5 md:p-6 shadow-sm border-slate-200/60">
            <SectionTitle icon={MapPin}>Основные данные</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div className="space-y-4">
                <div>
                  <Label>Наименование <span className="text-red-500">*</span></Label>
                  <Input
                    value={localInfo.name}
                    onChange={e => handleInfoChange('name', e.target.value)}
                    placeholder="Название ЖК"
                    disabled={isReadOnly}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Кадастровый номер <span className="text-red-500">*</span></Label>
                  <Input
                    value={localCadastre.number}
                    onChange={e => handleCadastreChange('number', e.target.value)}
                    placeholder="10:09:03:02:01:0021"
                    disabled={isReadOnly}
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div>
                  <Label>Регион</Label>
                  <Select value={localInfo.regionSoato || ''} onChange={e => handleInfoChange('regionSoato', e.target.value)} disabled={isReadOnly} className="mt-1">
                    <option value="">Выберите регион</option>
                    {(regionsOptions || []).map(r => <option key={r.id} value={r.soato}>{r.name_ru || r.name_uz || r.name_en || r.name_uk}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Район</Label>
                  <Select value={localInfo.districtSoato || ''} onChange={e => handleInfoChange('districtSoato', e.target.value)} disabled={isReadOnly} className="mt-1">
                    <option value="">Выберите район</option>
                    {availableDistricts.map(d => <option key={d.id} value={d.soato}>{d.name_ru || d.name_uz || d.name_en || d.name_uk}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Махалля</Label>
                  <Select value={localInfo.mahallaId || ''} onChange={e => handleInfoChange('mahallaId', e.target.value)} disabled={isReadOnly} className="mt-1">
                    <option value="">Выберите махаллю</option>
                    {availableMakhallas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Улица</Label>
                  <Select value={localInfo.streetId || ''} onChange={e => handleInfoChange('streetId', e.target.value)} disabled={isReadOnly} className="mt-1">
                    <option value="">Выберите улицу</option>
                    {availableStreets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Дом</Label>
                  <Input value={localInfo.buildingNo || ''} onChange={e => handleInfoChange('buildingNo', e.target.value)} placeholder="Номер дома" disabled={isReadOnly} className="mt-1" />
                </div>
                <div>
                  <Label>Адрес (сформированный)</Label>
                  <Input value={localInfo.street} onChange={e => handleInfoChange('street', e.target.value)} placeholder="Адрес" disabled={isReadOnly} className="mt-1" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Регион (текст)</Label>
                  <Input value={localInfo.region} disabled className="mt-1" />
                </div>
                <div>
                  <Label>Район (текст)</Label>
                  <Input value={localInfo.district} disabled className="mt-1" />
                </div>
                <div>
                  <Label>Ориентир</Label>
                  <Input
                    value={localInfo.landmark}
                    onChange={e => handleInfoChange('landmark', e.target.value)}
                    placeholder="Рядом с..."
                    disabled={isReadOnly}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 md:p-6 shadow-sm border-slate-200/60">
            <SectionTitle icon={Users}>Участники проекта</SectionTitle>
            <div className="mt-5 space-y-3">
              {PARTICIPANT_ROLES.map(roleItem => {
                const { key, label, icon: Icon } = roleItem;
                const row = participantDrafts[key] || { role: key, name: '', inn: '' };
                return (
                  <div key={key} className="flex flex-col sm:flex-row items-start gap-3 p-4 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="sm:w-1/3 flex items-center gap-2.5 pt-1.5">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <Icon size={16} />
                      </div>
                      <div className="font-bold text-slate-800 text-sm">{label}</div>
                    </div>
                    <div className="sm:w-2/3 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Наименование организации *"
                          value={row.name || ''}
                          onChange={e => handleParticipantChange(key, 'name', e.target.value)}
                          disabled={isReadOnly}
                          className="bg-white text-sm"
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="ИНН (9 цифр)"
                          value={row.inn || ''}
                          onChange={e => handleParticipantChange(key, 'inn', e.target.value)}
                          disabled={isReadOnly}
                          className="bg-white font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Button
                          onClick={() => handleParticipantSave(key)}
                          disabled={isReadOnly || isSaving}
                          className="w-full bg-slate-800 text-white hover:bg-slate-700 h-[38px] text-sm"
                        >
                          {isSaving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                          Зафиксировать
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 md:p-6 shadow-sm border-slate-200/60 overflow-hidden">
            <SectionTitle icon={FileText}>Документы проекта</SectionTitle>
            <div className="overflow-x-auto mt-5 rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100/80 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Название</th>
                    <th className="p-3">Тип</th>
                    <th className="p-3">Номер / Дата</th>
                    <th className="p-3">Ссылка</th>
                    <th className="p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(documents || []).map(doc => (
                    <tr key={doc.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-800">{doc.name}</td>
                      <td className="p-3 text-slate-600 text-xs">{doc.type || '—'}</td>
                      <td className="p-3 text-slate-600">
                        <div className="font-mono text-xs">{doc.number || '—'}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{doc.date || '—'}</div>
                      </td>
                      <td className="p-3">
                        {doc.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline max-w-[150px] truncate block text-xs" title={doc.url}>
                            Открыть ссылку
                          </a>
                        ) : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          disabled={isReadOnly}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-blue-50/30">
                    <td className="p-2">
                      <Input
                        value={newDoc.name}
                        onChange={e => setNewDoc(d => ({ ...d, name: e.target.value }))}
                        placeholder="Название..."
                        disabled={isReadOnly}
                        className="bg-white text-xs h-8"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={newDoc.type}
                        onChange={e => setNewDoc(d => ({ ...d, type: e.target.value }))}
                        placeholder="Тип..."
                        disabled={isReadOnly}
                        className="bg-white text-xs h-8"
                      />
                    </td>
                    <td className="p-2 space-y-1">
                      <Input
                        value={newDoc.number}
                        onChange={e => setNewDoc(d => ({ ...d, number: e.target.value }))}
                        placeholder="№ док-та"
                        disabled={isReadOnly}
                        className="bg-white text-xs h-8 font-mono"
                      />
                      <Input
                        type="date"
                        value={newDoc.date}
                        onChange={e => setNewDoc(d => ({ ...d, date: e.target.value }))}
                        disabled={isReadOnly}
                        className="bg-white text-xs h-8"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={newDoc.url}
                        onChange={e => setNewDoc(d => ({ ...d, url: e.target.value }))}
                        placeholder="https://..."
                        disabled={isReadOnly}
                        className="bg-white text-xs h-8"
                      />
                    </td>
                    <td className="p-2 text-right align-top">
                      <Button
                        onClick={handleAddDocument}
                        disabled={isReadOnly || !newDoc.name.trim()}
                        className="bg-blue-600 text-white hover:bg-blue-500 h-8 w-8 p-0 flex items-center justify-center rounded-md"
                        title="Добавить документ"
                      >
                        <Plus size={14} />
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

        </div>

        {/* ================= RIGHT COLUMN: CONTEXT & MAP ================= */}
        <div className="xl:col-span-5 space-y-6 flex flex-col">
          
          {/* MAP HERO CARD */}
          <Card className="flex flex-col shadow-sm border-slate-200/60 overflow-hidden min-h-[450px]">
            <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
               <SectionTitle icon={Layers} className="mb-0 text-base">Расположение жилого комплекса</SectionTitle>
            </div>
            
            <div className="p-4 bg-slate-50/50 flex flex-col gap-3 flex-1">
              
              {/* Map Controls */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => shpInputRef.current?.click()} 
                    disabled={isReadOnly || isImportingGeometry || isDrawingGeometry}
                    className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 shadow-sm h-8 px-3 text-xs"
                  >
                    {isImportingGeometry ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Plus size={14} className="mr-1.5 text-blue-500" />}
                    Импорт границ
                  </Button>

                  {!isReadOnly && !isDrawingGeometry && (
                    <Button
                      onClick={handleStartDrawGeometry}
                      className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 shadow-sm h-8 px-3 text-xs"
                    >
                      Нарисовать полигон
                    </Button>
                  )}

                  {!isReadOnly && isDrawingGeometry && (
                    <>
                      <Button
                        onClick={handleSaveDrawnGeometry}
                        disabled={draftPolygonPoints.length < 3}
                        className="bg-blue-600 text-white hover:bg-blue-500 shadow-sm h-8 px-3 text-xs"
                      >
                        Сохранить контур
                      </Button>
                      <Button
                        onClick={() => setDraftPolygonPoints([])}
                        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm h-8 px-3 text-xs"
                      >
                        Очистить
                      </Button>
                      <Button
                        onClick={handleCancelDrawGeometry}
                        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm h-8 px-3 text-xs"
                      >
                        Отмена
                      </Button>
                    </>
                  )}
                  
                  {landPlot?.geometry && !isReadOnly && (
                    <Button 
                      onClick={handleDetachGeometry} 
                      className="bg-white border-red-100 text-red-600 hover:bg-red-50 shadow-sm h-8 px-2.5"
                      title="Открепить геометрию от ЖК"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                  <input ref={shpInputRef} type="file" accept=".zip" className="hidden" onChange={handleImportGeometryZip} />
                </div>
                
                <select 
                  value={basemap} 
                  onChange={e => setBasemap(e.target.value)} 
                  className="bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-600 shadow-sm outline-none focus:border-blue-500"
                >
                  {BASEMAP_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {geometryError && (
                <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded border border-red-100">
                  {geometryError}
                </div>
              )}

              {/* Action Banner when polygon is clicked */}
              {activeCandidateId && !isReadOnly && !isDrawingGeometry && (
                <div className="flex items-center justify-between gap-3 p-2 px-3 bg-blue-600 rounded-lg shadow-md text-white animate-in slide-in-from-top-1">
                  <div className="text-xs font-medium">Контур выбран</div>
                  <div className="flex items-center gap-1.5">
                    <Button 
                      onClick={handleAttachToProject} 
                      className="bg-white text-blue-700 hover:bg-blue-50 h-7 px-3 text-[11px] font-bold"
                    >
                      Прикрепить
                    </Button>
                    <button 
                      onClick={handleDeleteGeometry} 
                      className="h-7 w-7 flex items-center justify-center rounded border border-blue-400 hover:bg-red-500 hover:border-red-500 transition-colors"
                      title="Удалить из загрузок"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* MAP */}
              <div className="flex-1 rounded-lg overflow-hidden border border-slate-200 shadow-inner bg-slate-100 relative min-h-[300px]">
                <GeometryPickerMap
                  candidates={geometryCandidates}
                  selectedId={selectedLandPlotCandidateId}
                  activeId={activeCandidateId}
                  savedGeometry={landPlot?.geometry}
                  onSelect={setActiveCandidateId}
                  basemap={basemap}
                  isDrawing={isDrawingGeometry}
                  draftPoints={draftPolygonPoints}
                  onDraftPointAdd={handleAddDraftPoint}
                  height={400}
                />
              </div>
              
              <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-4">
                 {isDrawingGeometry && <div className="text-sky-600 font-semibold">Режим рисования: точек {draftPolygonPoints.length}</div>}
                 <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500/80"></span> Сохранено</div>
                 <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500/80"></span> Выбрано</div>
                 <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500/80"></span> Занято</div>
              </div>

            </div>
          </Card>

          {/* STATUS & SCHEDULE COMBINED */}
          <Card className="p-5 md:p-6 shadow-sm border-slate-200/60 bg-gradient-to-b from-white to-slate-50/50">
            <SectionTitle icon={CalendarDays} className="text-base">Статус и График</SectionTitle>
            
            <div className="mt-5 space-y-5">
              <div>
                <Label className="text-[11px] text-slate-500 mb-1.5 block uppercase tracking-wide">Строительный статус</Label>
                <div className="flex items-center gap-2 p-1 pl-3 pr-1 border border-slate-200 rounded-lg bg-white shadow-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.color} shadow-sm`} />
                  <select
                    value={localInfo.status || 'Проектный'}
                    onChange={e => handleInfoChange('status', e.target.value)}
                    disabled={isReadOnly}
                    className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none h-8 cursor-pointer"
                  >
                    {projectStatusOptions.map(s => (
                      <option key={s.code} value={s.label}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">План</div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Начало работ</Label>
                    <Input
                      type="date"
                      value={localInfo.dateStartProject || ''}
                      onChange={e => handleInfoChange('dateStartProject', e.target.value)}
                      disabled={isReadOnly}
                      className="mt-0.5 h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Окончание (ввод)</Label>
                    <Input
                      type="date"
                      value={localInfo.dateEndProject || ''}
                      onChange={e => handleInfoChange('dateEndProject', e.target.value)}
                      disabled={isReadOnly}
                      className="mt-0.5 h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">Факт</div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Начало работ</Label>
                    <Input
                      type="date"
                      value={localInfo.dateStartFact || ''}
                      onChange={e => handleInfoChange('dateStartFact', e.target.value)}
                      disabled={isReadOnly}
                      className="mt-0.5 h-8 text-xs bg-slate-50 border-dashed"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Окончание (ввод)</Label>
                    <Input
                      type="date"
                      value={localInfo.dateEndFact || ''}
                      onChange={e => handleInfoChange('dateEndFact', e.target.value)}
                      disabled={isReadOnly}
                      className="mt-0.5 h-8 text-xs bg-slate-50 border-dashed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default React.memo(PassportEditor);