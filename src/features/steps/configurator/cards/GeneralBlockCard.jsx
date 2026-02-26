import React from 'react';
import { Settings2, MapPin, AlertCircle, Building } from 'lucide-react';
import { Card, SectionTitle, Label, Input, useReadOnly } from '@components/ui/UIKit';

export default function GeneralBlockCard({
  details,
  updateDetail,
  building,
  currentBlock,
  hasElevatorIssue,
  _errorBorder,
}) {
  const isReadOnly = useReadOnly();
  const isResidential = currentBlock?.type === 'Ж';
  const canEditBlockAddress = String(building?.category || '').includes('residential');

  // ВАЖНО: Разделяем поля! Для жилых пишем в entrances, для котельных/паркингов в inputs
  const entrancesField = isResidential ? 'entrances' : 'inputs';

  const increment = (field, max = 100) => {
    const val = parseInt(details[field]) || 0;
    updateDetail(field, Math.min(max, val + 1));
  };
  const decrement = (field, min = 1) => {
    const val = parseInt(details[field]) || 0;
    updateDetail(field, Math.max(min, val - 1));
  };
  const renderCounterValue = val =>
    val === '' || val === undefined ? <span className="text-red-300">?</span> : val;

  const fullHouseAddress = [
    building.region,
    building.district,
    building.address,
    building.houseNumber ? `Дом № ${building.houseNumber}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6 shadow-sm">
        <SectionTitle icon={Settings2}>Общие</SectionTitle>
        <div className="space-y-4">
          {/* Входы / Подъезды */}
          <div className="space-y-1">
            <Label>{isResidential ? 'Подъездов' : 'Входов'} (макс. 30)</Label>
            <div className="flex items-center gap-3">
              <button
                disabled={isReadOnly}
                onClick={() => decrement(entrancesField, 1)}
                className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                -
              </button>
              <span className="font-bold text-lg w-8 text-center">
                {renderCounterValue(details[entrancesField])}
              </span>
              <button
                disabled={isReadOnly}
                onClick={() => increment(entrancesField, 30)}
                className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Лифты */}
          <div className="space-y-1">
            <Label>Лифтов</Label>
            <div className="flex items-center gap-3">
              <button
                disabled={isReadOnly}
                onClick={() => decrement('elevators', 0)}
                className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                -
              </button>
              <span className="font-bold text-lg w-8 text-center">
                {renderCounterValue(details.elevators)}
              </span>
              <button
                disabled={isReadOnly}
                onClick={() => increment('elevators')}
                className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                +
              </button>
            </div>
            {hasElevatorIssue && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-red-500 font-bold animate-in fade-in">
                <AlertCircle size={10} />
                <span>Лифт обязателен &gt; 5 этажей</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Адрес блока */}
      {canEditBlockAddress && (
        <Card className="p-6 shadow-sm flex flex-col">
          <SectionTitle icon={MapPin}>Адрес</SectionTitle>

          <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Building size={10} />
              <span className="font-bold uppercase tracking-wider">Адрес дома</span>
            </div>
            <div className="text-slate-700 font-medium">{fullHouseAddress}</div>
          </div>

          <div className="space-y-4 mt-auto">
            <label
              className={`flex items-start gap-3 group ${isReadOnly ? 'opacity-50' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                checked={details.hasCustomAddress || false}
                onChange={e => updateDetail('hasCustomAddress', e.target.checked)}
                disabled={isReadOnly}
                className="mt-1 rounded text-blue-600 w-4 h-4 disabled:cursor-not-allowed"
              />
              <div>
                <span className="text-sm font-bold text-slate-700">Указать отдельный адрес блока</span>
                <p className="text-[10px] text-slate-400">
                  Используйте, если блок имеет отдельный номер дома/корпуса
                </p>
              </div>
            </label>

            {details.hasCustomAddress && (
              <div className="animate-in slide-in-from-top-2 fade-in duration-300 flex items-center gap-2">
                <span className="text-slate-500 font-bold text-sm">Корпус №</span>
                <Input
                  value={details.customHouseNumber || ''}
                  onChange={e => updateDetail('customHouseNumber', e.target.value)}
                  placeholder="1"
                  className="w-24"
                  disabled={isReadOnly}
                />
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}