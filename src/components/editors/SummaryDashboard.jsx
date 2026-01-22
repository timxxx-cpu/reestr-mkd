import React, { useMemo } from 'react';
import { 
  Building2, Home, Car, Layers, PieChart, 
  ArrowRight, CheckCircle2 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Button } from '../ui/UIKit';

// Вспомогательная функция для форматирования чисел
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
const fmtFloat = (n) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);

export default function SummaryDashboard() {
    const { 
        complexInfo, composition, 
        flatMatrix, parkingPlaces, mopData 
    } = useProject();

    // --- РАСЧЕТ ОБЩЕЙ СТАТИСТИКИ ---
    const stats = useMemo(() => {
        let totalFlats = 0;
        let totalFlatArea = 0;
        let totalParking = 0;
        let totalParkingArea = 0;
        let totalMopArea = 0;
        
        // 1. Считаем Квартиры
        if (flatMatrix) {
            Object.values(flatMatrix).forEach(flat => {
                if (flat && flat.area) {
                    totalFlats++;
                    totalFlatArea += parseFloat(flat.area || 0);
                }
            });
        }

        // 2. Считаем Паркинг (ТОЛЬКО МЕСТА)
        if (parkingPlaces) {
            Object.keys(parkingPlaces).forEach(key => {
                // Считаем только ключи, содержащие '_place' (это сами места)
                // Пример ключа: buildingId_main_floor_1_place0
                if (key.includes('_place')) {
                    const place = parkingPlaces[key];
                    if (place) {
                        totalParking++;
                        totalParkingArea += parseFloat(place.area || 0);
                    }
                }
            });
        }

        // 3. Считаем МОП
        if (mopData) {
            Object.values(mopData).forEach(floorMops => {
                if (Array.isArray(floorMops)) {
                    // Новый формат (массив)
                    floorMops.forEach(mop => {
                        if (mop && mop.area) {
                            totalMopArea += parseFloat(mop.area || 0);
                        }
                    });
                } else if (typeof floorMops === 'object') {
                    // Старый формат
                    Object.values(floorMops).forEach(mop => {
                        if (mop && (mop.area || mop.s)) {
                            totalMopArea += parseFloat(mop.area || mop.s || 0);
                        }
                    });
                }
            });
        }

        return { totalFlats, totalFlatArea, totalParking, totalParkingArea, totalMopArea };
    }, [flatMatrix, parkingPlaces, mopData]);

    // --- РАСЧЕТ СТАТИСТИКИ ПО ЗДАНИЯМ ---
    const buildingStats = useMemo(() => {
        return composition.map(b => {
            let bFlats = 0;
            let bFlatArea = 0;
            let bParking = 0;
            let bParkingArea = 0;
            
            // 1. Квартиры здания
            if (flatMatrix) {
                Object.keys(flatMatrix).forEach(key => {
                    if (key.startsWith(`${b.id}_`)) {
                        bFlats++;
                        bFlatArea += parseFloat(flatMatrix[key]?.area || 0);
                    }
                });
            }

            // 2. Паркинг здания
            if (parkingPlaces) {
                Object.keys(parkingPlaces).forEach(key => {
                    // Проверяем, что ключ относится к этому зданию (начинается с ID) и является местом
                    if (key.startsWith(`${b.id}_`) && key.includes('_place')) {
                        bParking++;
                        bParkingArea += parseFloat(parkingPlaces[key]?.area || 0);
                    }
                });
            }

            return { ...b, bFlats, bFlatArea, bParking, bParkingArea };
        });
    }, [composition, flatMatrix, parkingPlaces]);

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">
            {/* Заголовок */}
            <div className="mb-8 border-b border-slate-200 pb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">{complexInfo.name || "Новый проект"}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-emerald-200">
                            {complexInfo.status}
                        </span>
                        <span className="text-slate-400 text-sm">
                            • {composition.length} строений
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Общая площадь (Кв + Паркинг)</div>
                    <div className="text-2xl font-bold text-blue-600">{fmtFloat(stats.totalFlatArea + stats.totalParkingArea)} м²</div>
                </div>
            </div>

            {/* Карточки верхнего уровня */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="p-6 border-l-4 border-l-blue-500 hover:-translate-y-1 transition-transform">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Home size={24}/></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Квартиры</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{fmt(stats.totalFlats)}</div>
                    <div className="text-sm text-slate-500 mt-1 font-medium">{fmtFloat(stats.totalFlatArea)} м²</div>
                </Card>

                <Card className="p-6 border-l-4 border-l-indigo-500 hover:-translate-y-1 transition-transform">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Car size={24}/></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Паркинг</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{fmt(stats.totalParking)}</div>
                    <div className="text-sm text-slate-500 mt-1 font-medium">{fmtFloat(stats.totalParkingArea)} м²</div>
                </Card>

                <Card className="p-6 border-l-4 border-l-amber-500 hover:-translate-y-1 transition-transform">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Layers size={24}/></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">МОП</span>
                    </div>
                    {/* МОПы не считаются по штукам */}
                    <div className="text-3xl font-bold text-slate-800">-</div>
                    <div className="text-sm text-slate-500 mt-1 font-medium">{fmtFloat(stats.totalMopArea)} м²</div>
                </Card>

                <Card className="p-6 border-l-4 border-l-slate-500 hover:-translate-y-1 transition-transform">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-xl"><Building2 size={24}/></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Корпусов</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{composition.length}</div>
                    <div className="text-sm text-slate-500 mt-1 font-medium">В составе ЖК</div>
                </Card>
            </div>

            {/* Детализация по корпусам */}
            <div className="space-y-6">
                <SectionTitle icon={PieChart}>Детализация по объектам</SectionTitle>
                <div className="grid grid-cols-1 gap-4">
                    {buildingStats.map((b, idx) => (
                        <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center font-bold text-slate-400 text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    {idx + 1}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{b.label}</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{b.type}</p>
                                </div>
                            </div>

                            <div className="flex gap-8 text-right items-center">
                                {/* БЛОК КВАРТИР */}
                                {b.category.includes('residential') && b.bFlats > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Квартир</div>
                                        <div className="font-bold text-slate-800">{b.bFlats} <span className="text-xs text-slate-400 font-normal">({fmtFloat(b.bFlatArea)} м²)</span></div>
                                    </div>
                                )}

                                {/* БЛОК ПАРКИНГА (показываем, если есть места) */}
                                {b.bParking > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Паркинг</div>
                                        <div className="font-bold text-indigo-600">{b.bParking} <span className="text-xs text-indigo-400 font-normal">({fmtFloat(b.bParkingArea)} м²)</span></div>
                                    </div>
                                )}

                                {/* ЕСЛИ НИЧЕГО НЕТ */}
                                {!b.bFlats && !b.bParking && (
                                    <div className="flex items-center text-slate-400 text-sm italic">
                                        <CheckCircle2 size={16} className="mr-2"/> Нет данных
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Заглушка для следующего шага */}
            <div className="mt-12 p-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl text-white text-center shadow-xl">
                <h2 className="text-2xl font-bold mb-2">Проект полностью заполнен! 🚀</h2>
                <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                    Вы внесли данные по этажности, квартирографии, паркингам и МОП.
                    Теперь данные готовы к экспорту или версионированию.
                </p>
                <Button className="bg-white text-slate-900 hover:bg-slate-100 border-none px-8">
                    Перейти к Экспорту <ArrowRight size={16}/>
                </Button>
            </div>
        </div>
    );
}