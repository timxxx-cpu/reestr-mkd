import React from 'react';
import { Hammer, Activity } from 'lucide-react';
import { Card, SectionTitle, Label, Select, useReadOnly } from '../../../ui/UIKit';

export default function ConstructiveCard({ details, updateDetail, errorBorder }) {
    const isReadOnly = useReadOnly();

    const fields = [
        { key: 'foundation', label: 'Фундамент', options: 'Монолитная плита,Свайный,Ленточный' },
        { key: 'walls', label: 'Стены', options: 'Монолитный ж/б,Кирпич,Газоблок,Панель' },
        { key: 'slabs', label: 'Перекрытия', options: 'Монолитные ж/б,Сборные плиты,Деревянные' },
        { key: 'roof', label: 'Крыша', options: 'Плоская рулонная,Скатная,Эксплуатируемая' }
    ];

    return (
        <Card className="p-5 shadow-sm">
            <SectionTitle icon={Hammer}>Конструктив</SectionTitle>
            
            <div className="space-y-4 mt-2">
                {/* Основные элементы в гриде */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {fields.map(({ key, label, options }) => (
                        <div key={key} className="space-y-1.5">
                            <Label className="text-slate-500">{label}</Label>
                            <Select 
                                className={`w-full text-sm py-2 font-medium bg-slate-50 border-slate-200 focus:bg-white transition-colors ${errorBorder(key)}`} 
                                value={details[key] || ''} 
                                onChange={(e) => updateDetail(key, e.target.value)}
                                disabled={isReadOnly}
                            >
                                <option value="" disabled>Не выбрано</option>
                                {options.split(',').map(o => <option key={o}>{o}</option>)}
                            </Select>
                        </div>
                    ))}
                </div>

                {/* Сейсмичность отдельным блоком */}
                <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity size={16} className="text-rose-500"/>
                        <Label className="text-slate-700 font-bold">Сейсмостойкость</Label>
                    </div>
                    <div className="flex gap-2">
                        {[7, 8, 9, 10].map(ball => {
                            const isSelected = parseInt(details.seismicity) === ball;
                            return (
                                <button
                                    key={ball}
                                    disabled={isReadOnly}
                                    onClick={() => updateDetail('seismicity', ball)}
                                    className={`
                                        flex-1 py-2 rounded-lg border text-sm font-bold transition-all
                                        ${isSelected 
                                            ? 'bg-rose-50 border-rose-200 text-rose-700 ring-1 ring-rose-400' 
                                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                        }
                                        ${errorBorder('seismicity') && !details.seismicity ? 'border-red-300 bg-red-50' : ''}
                                    `}
                                >
                                    {ball}
                                </button>
                            );
                        })}
                    </div>
                    {errorBorder('seismicity') && <p className="text-[10px] text-red-500 mt-1">Выберите значение</p>}
                </div>
            </div>
        </Card>
    );
}