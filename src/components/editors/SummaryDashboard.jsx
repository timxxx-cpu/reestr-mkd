import React, { useMemo } from 'react';
import { 
  Building2, Home, Car, Layers, PieChart, 
  ArrowRight, CheckCircle2, Ruler 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Button } from '../ui/UIKit';

// Вспомогательная функция для форматирования чисел
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
const fmtFloat = (n) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);

export default function SummaryDashboard() {
    const { 
        complexInfo, composition, 
        flatMatrix, parkingPlaces, mopData, floorData 
    } = useProject();

    // --- РАСЧЕТ СТАТИСТИКИ ---
    const stats = useMemo(() => {
        let totalFlats = 0;
        let totalFlatArea = 0;
        let totalParking = 0;
        let totalParkingArea = 0;
        let totalMopArea = 0;
        
        // Считаем Квартиры
        Object.values(flatMatrix).forEach(flat => {
            totalFlats++;
            totalFlatArea += parseFloat(flat.area || 0);
        });

        // Считаем Паркинг
        // Исключаем мета-ключи (которые заканчиваются на _meta)
        Object.keys(parkingPlaces).forEach(key => {
            if (!key.endsWith('_meta')) {
                totalParking++;
                totalParkingArea += parseFloat(parkingPlaces[key]?.area || 0);
            }
        });

        // Считаем МОП
        Object.values(mopData).forEach(floorMops => {
            // floorMops содержит ключи типов (lk, corridor, etc.) или mop0, mop1...
            // В нашей последней версии структура: key -> { name, area, height ... }
            if (floorMops.area) {
                totalMopArea += parseFloat(floorMops.area || 0);
            } else {
                // Если старая структура (по типам)
                Object.values(floorMops).forEach(mop => {
                    if (mop.s) totalMopArea += parseFloat(mop.s || 0); // s - это площадь
                    if (mop.area) totalMopArea += parseFloat(mop.area || 0);
                });
            }
        });

        return { totalFlats, totalFlatArea, totalParking, totalParkingArea, totalMopArea };
    }, [flatMatrix, parkingPlaces, mopData]);

    // Статистика по зданиям
    const buildingStats = useMemo(() => {
        return composition.map(b => {
            let bFlats = 0;
            let bFlatArea = 0;
            
            // Ищем ключи, относящиеся к этому зданию
            Object.keys(flatMatrix).forEach(key => {
                if (key.startsWith(`${b.id}_`)) {
                    bFlats++;
                    bFlatArea += parseFloat(flatMatrix[key]?.area || 0);
                }
            });

            return { ...b, bFlats, bFlatArea };
        });
    }, [composition, flatMatrix]);

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
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Общая площадь (S продаваемая)</div>
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

                            <div className="flex gap-8 text-right">
                                {b.category.includes('residential') && (
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Квартир</div>
                                        <div className="font-bold text-slate-800">{b.bFlats}</div>
                                    </div>
                                )}
                                {b.category.includes('residential') && (
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Площадь жилая</div>
                                        <div className="font-bold text-blue-600">{fmtFloat(b.bFlatArea)} м²</div>
                                    </div>
                                )}
                                {!b.category.includes('residential') && (
                                    <div className="flex items-center text-slate-400 text-sm italic">
                                        <CheckCircle2 size={16} className="mr-2"/> Объект сконфигурирован
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