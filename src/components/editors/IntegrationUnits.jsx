import React, { useState, useMemo } from 'react';
import {
  Database,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Home,
  Car,
  Briefcase,
  RefreshCw,
  Hash,
  ArrowRight,
  Building2,
  FileText,
  School,
  Filter, // [FIX] Building2 здесь
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { Card, Button, Badge, useReadOnly, TabButton } from '@components/ui/UIKit';
import { useToast } from '@context/ToastContext';
import {
  createVirtualApartmentCadastre,
  createVirtualCommercialCadastre,
  createVirtualParkingCadastre,
} from '@lib/cadastre';
import { FullIdentifierCompact } from '@components/ui/IdentifierBadge';
import { formatFullIdentifier } from '@lib/uj-identifier';

const SYNC_STATUS = {
  IDLE: 'IDLE',
  SENDING: 'SENDING',
  WAITING: 'WAITING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
};

const getTypeConfig = type => {
  switch (type) {
    case 'flat':
      return { label: 'Квартира', icon: Home, color: 'text-blue-600 bg-blue-50 border-blue-200' };
    case 'duplex_up':
    case 'duplex_down':
      return {
        label: 'Дуплекс',
        icon: Home,
        color: 'text-purple-600 bg-purple-50 border-purple-200',
      };
    case 'office':
      return {
        label: 'Офис',
        icon: Briefcase,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      };
    case 'office_inventory':
      return {
        label: 'Нежилое (Инв.)',
        icon: FileText,
        color: 'text-teal-600 bg-teal-50 border-teal-200',
      };
    case 'non_res_block':
      return {
        label: 'Нежилой блок',
        icon: Building2,
        color: 'text-amber-600 bg-amber-50 border-amber-200',
      };
    case 'infrastructure':
      return {
        label: 'Инфраструктура',
        icon: School,
        color: 'text-orange-600 bg-orange-50 border-orange-200',
      };
    case 'parking_place':
      return {
        label: 'Машиноместо',
        icon: Car,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      };
    default:
      return { label: type, icon: FileText, color: 'text-slate-600 bg-slate-50 border-slate-200' };
  }
};

export default function IntegrationUnits() {
  const { projectId, complexInfo } = useProject();
  const isReadOnly = useReadOnly();
  const toast = useToast();

  const {
    integrationStatus,
    fullRegistry,
    loadingRegistry,
    setIntegrationStatus,
    setUnitCadastre,
  } = useDirectIntegration(projectId);

  const [activeTab, setActiveTab] = useState('living');

  const status = integrationStatus.unitsStatus || SYNC_STATUS.IDLE;
  const updateStatus = st => setIntegrationStatus({ field: 'unitsStatus', status: st });

  // Обработка данных из fullRegistry (приведение к плоскому списку)
  const allObjects = useMemo(() => {
    if (!fullRegistry || !fullRegistry.units) return [];

    const list = [];
    const { buildings, units } = fullRegistry;
    const bMap = {};
    buildings.forEach(b => (bMap[b.id] = b.label));

    // Квартиры и офисы
    units.forEach(u => {
      const buildingLabel = bMap[u.buildingId] || 'Объект';

      let category = 'nonres';
      if (['flat', 'duplex_up', 'duplex_down'].includes(u.type)) category = 'living';
      else if (u.type === 'parking_place') category = 'parking';

      list.push({
        ...u,
        category,
        buildingLabel,
        buildingCode: u.buildingCode,
        cadastreNumber: u.cadastreNumber,
      });
    });

    return list;
  }, [fullRegistry]);

  const stats = useMemo(() => {
    const s = { living: { total: 0 }, nonres: { total: 0 }, parking: { total: 0 } };
    allObjects.forEach(obj => {
      if (s[obj.category]) s[obj.category].total++;
    });
    return s;
  }, [allObjects]);

  const filteredList = useMemo(
    () => allObjects.filter(o => o.category === activeTab),
    [allObjects, activeTab]
  );

  const handleSendToUzkad = async () => {
    if (isReadOnly) return;
    updateStatus(SYNC_STATUS.SENDING);
    setTimeout(() => {
      updateStatus(SYNC_STATUS.WAITING);
      toast.info('Реестр отправлен. Ожидание присвоения номеров...');
    }, 1500);
  };

  const handleSimulateResponse = async () => {
    if (isReadOnly) return;

    let processedCount = 0;
    const promises = [];

    for (const obj of allObjects) {
      if (!obj.cadastreNumber) {
        let generatedCadastre = createVirtualCommercialCadastre();
        if (obj.category === 'living') generatedCadastre = createVirtualApartmentCadastre();
        if (obj.category === 'parking') generatedCadastre = createVirtualParkingCadastre();

        promises.push(setUnitCadastre({ id: obj.id, cadastre: generatedCadastre }));
        processedCount++;
      }
    }

    await Promise.all(promises);
    updateStatus(SYNC_STATUS.COMPLETED);
    toast.success(`Получено ${processedCount} новых кадастровых номеров!`);
  };

  const handleReset = () => {
    if (isReadOnly) return;
    if (!confirm('Сбросить статус интеграции?')) return;
    updateStatus(SYNC_STATUS.IDLE);
  };

  if (loadingRegistry)
    return (
      <div className="p-12 text-center">
        <Loader2 className="animate-spin text-indigo-600 mx-auto" />
      </div>
    );

  return (
    <div className="w-full pb-24 animate-in fade-in duration-500 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Регистрация помещений</h1>
            <p className="text-slate-500 text-sm">
              Отправка реестров в УЗКАД и получение кадастровых номеров
            </p>
          </div>
        </div>

        <div
          className={`px-4 py-2 rounded-xl text-sm font-bold border flex items-center gap-2 shadow-sm ${
            status === SYNC_STATUS.COMPLETED
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : status === SYNC_STATUS.WAITING
                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <RefreshCw size={16} className={status === SYNC_STATUS.SENDING ? 'animate-spin' : ''} />
          {status === SYNC_STATUS.IDLE && 'Готов к отправке'}
          {status === SYNC_STATUS.SENDING && 'Отправка...'}
          {status === SYNC_STATUS.WAITING && 'Ожидание ответа УЗКАД'}
          {status === SYNC_STATUS.COMPLETED && 'Все данные получены'}
        </div>
      </div>

      {/* ACTIONS */}
      <Card className="p-6 bg-slate-50/50 border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex -space-x-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 border-4 border-white flex items-center justify-center text-blue-600 z-30">
                <Home size={20} />
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 border-4 border-white flex items-center justify-center text-emerald-600 z-20">
                <Briefcase size={20} />
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 border-4 border-white flex items-center justify-center text-indigo-600 z-10">
                <Car size={20} />
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-700">Единый пакет данных</div>
              <div className="text-xs text-slate-500 mt-1">
                Всего объектов:{' '}
                <span className="font-bold text-slate-900">{allObjects.length}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            {status === SYNC_STATUS.IDLE && (
              <Button
                onClick={handleSendToUzkad}
                disabled={isReadOnly || allObjects.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 w-full md:w-auto"
              >
                <Send size={16} className="mr-2" /> Отправить реестр
              </Button>
            )}
            {status === SYNC_STATUS.WAITING && (
              <Button
                onClick={handleSimulateResponse}
                disabled={isReadOnly}
                variant="secondary"
                className="border-dashed border-slate-300 w-full md:w-auto"
              >
                <RefreshCw size={16} className="mr-2" /> Получить ответ (Эмуляция)
              </Button>
            )}
            {status !== SYNC_STATUS.IDLE && !isReadOnly && (
              <button
                onClick={handleReset}
                className="px-4 text-xs font-bold text-slate-400 hover:text-red-500"
              >
                Сброс
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* TABLE */}
      <div className="space-y-4">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-max">
          <TabButton active={activeTab === 'living'} onClick={() => setActiveTab('living')}>
            <Home size={16} className="mr-2 opacity-70" /> Квартиры{' '}
            <Badge className="ml-2 bg-white text-slate-700 shadow-sm">{stats.living.total}</Badge>
          </TabButton>
          <TabButton active={activeTab === 'nonres'} onClick={() => setActiveTab('nonres')}>
            <Briefcase size={16} className="mr-2 opacity-70" /> Нежилые{' '}
            <Badge className="ml-2 bg-white text-slate-700 shadow-sm">{stats.nonres.total}</Badge>
          </TabButton>
          <TabButton active={activeTab === 'parking'} onClick={() => setActiveTab('parking')}>
            <Car size={16} className="mr-2 opacity-70" /> Паркинг{' '}
            <Badge className="ml-2 bg-white text-slate-700 shadow-sm">{stats.parking.total}</Badge>
          </TabButton>
        </div>

        <Card className="overflow-hidden border border-slate-200 shadow-md bg-white min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 w-12 text-center">#</th>
                  <th className="px-6 py-4">Номер / Имя</th>
                  <th className="px-6 py-4">Тип</th>
                  <th className="px-6 py-4 text-right">Площадь</th>
                  <th className="px-6 py-4">Кадастровый номер</th>
                  <th className="px-6 py-4 text-center">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      Нет объектов в этой категории
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item, idx) => {
                    const typeConf = getTypeConfig(item.type);
                    const TypeIcon = typeConf.icon;
                    const hasCadastre = !!item.cadastreNumber;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-center text-slate-400 text-xs">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-700 mb-0.5">{item.number}</div>
                          {item.unitCode && item.buildingCode && complexInfo?.ujCode && (
                            <FullIdentifierCompact 
                              fullCode={formatFullIdentifier(
                                complexInfo.ujCode,
                                item.buildingCode,
                                item.unitCode
                              )}
                              variant="compact"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase border ${typeConf.color}`}
                          >
                            <TypeIcon size={12} /> {typeConf.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-600">
                          {item.area ? `${parseFloat(item.area).toFixed(2)} м²` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          {hasCadastre ? (
                            <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                              {item.cadastreNumber}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasCadastre ? (
                            <CheckCircle2 size={18} className="text-emerald-500 mx-auto" />
                          ) : (
                            <div
                              className={`w-2 h-2 rounded-full mx-auto ${status === SYNC_STATUS.WAITING ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'}`}
                            ></div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
