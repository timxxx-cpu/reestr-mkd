import React, { useState } from 'react';
import { X, Check, Car, Ruler, Hash } from 'lucide-react';
import { Button, Input, Label } from '../ui/UIKit';

export default function ParkingEditModal({ unit, buildingLabel, onClose, onSave }) {
    const [number, setNumber] = useState(unit.number || '');
    const [area, setArea] = useState(unit.area || '');

    const handleSave = () => {
        onSave({
            ...unit,
            number,
            area
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                            <span className="font-bold uppercase">{buildingLabel}</span>
                            <span>•</span>
                            <span>{unit.floorLabel}</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Car className="text-indigo-500" size={24}/>
                            Машиноместо
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-200">
                        <X size={20} className="text-slate-400 hover:text-slate-700"/>
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-2">
                            <Hash size={14}/> Номер места
                        </Label>
                        <Input 
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            className="font-black text-lg h-12"
                            placeholder="№"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-2">
                            <Ruler size={14}/> Площадь (м²)
                        </Label>
                        <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            className="font-bold text-lg h-12"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Отмена</Button>
                    {/* [CHANGED] Кнопка переименована в Применить */}
                    <Button onClick={handleSave} className="px-8 shadow-lg shadow-indigo-200 bg-indigo-600 hover:bg-indigo-700">
                        <Check size={16} className="mr-2"/> Применить
                    </Button>
                </div>
            </div>
        </div>
    );
}