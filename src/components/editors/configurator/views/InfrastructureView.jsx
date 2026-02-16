import React from 'react';
import { Box, ArrowUp, Footprints } from 'lucide-react';

import { useProject } from '@context/ProjectContext';
import { Card, SectionTitle, Label, Input, useReadOnly } from '@components/ui/UIKit';
import { BuildingConfigSchema } from '@lib/schemas';
import { useValidation } from '@hooks/useValidation';

import ConstructiveCard from '../cards/ConstructiveCard';
import EngineeringCard from '../cards/EngineeringCard';

export default function InfrastructureView({ building }) {
  const { buildingDetails, setBuildingDetails } = useProject();
  const isReadOnly = useReadOnly();

  const blockId = building.blocks?.[0]?.id || 'main';
  const detailsKey = `${building.id}_${blockId}`;

  const defaultDetails = {
    foundation: '',
    walls: '',
    slabs: '',
    roof: '',
    seismicity: '',
    floorsCount: '',
    floorsFrom: 1,
    inputs: '',
    engineering: {
      hvs: false,
      gvs: false,
      heating: false,
      electricity: false,
      sewerage: false,
      ventilation: false,
      firefighting: false,
    },
  };

  const details = { ...defaultDetails, ...(buildingDetails[detailsKey] || {}) };
  const { errors } = useValidation(BuildingConfigSchema, details);

  const updateDetail = (key, val) => {
    if (isReadOnly) return;
    setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
  };

  const updateFloorsCount = e => {
    if (isReadOnly) return;
    const val = e.target.value;
    if (val === '') {
      updateDetail('floorsCount', '');
      return;
    }
    let num = parseInt(val, 10);
    if (num > 3) num = 3;
    setBuildingDetails(prev => ({
      ...prev,
      [detailsKey]: { ...details, floorsCount: num, floorsFrom: 1 },
    }));
  };

  const errorBorder = field =>
    errors[field] ? 'border-red-500 focus:border-red-500 bg-red-50' : '';

  const increment = (field, max = 100) =>
    updateDetail(field, Math.min(max, (details[field] === '' ? 0 : details[field]) + 1));

  const decrement = (field, min = 1) =>
    updateDetail(field, Math.max(min, (details[field] === '' ? min + 1 : details[field]) - 1));

  const renderCounterValue = val =>
    val === '' || val === undefined ? <span className="text-red-300">?</span> : val;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-4 space-y-6">
        <Card className="p-6 shadow-md border-t-4 border-t-emerald-500">
          <SectionTitle icon={Box}>Параметры объекта</SectionTitle>

          <div className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2" required>
                <ArrowUp size={16} className="text-emerald-600" /> Этажность (Надземная)
              </Label>
              <Input
                type="number"
                min="1"
                max="3"
                placeholder="1-3"
                value={details.floorsCount}
                onChange={updateFloorsCount}
                className={`font-bold text-lg h-12 ${errorBorder('floorsCount')}`}
                disabled={isReadOnly}
              />
              <p className="text-[10px] text-slate-400">Максимум 3 этажа для данного типа объектов</p>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Footprints size={16} className="text-slate-400" /> Количество входов
              </Label>
              <div className="flex items-center gap-3">
                <button
                  disabled={isReadOnly}
                  onClick={() => decrement('inputs', 1)}
                  className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  -
                </button>
                <span className="font-bold text-2xl w-10 text-center text-slate-700">
                  {renderCounterValue(details.inputs)}
                </span>
                <button
                  disabled={isReadOnly}
                  onClick={() => increment('inputs', 10)}
                  className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="xl:col-span-4 space-y-6">
        <EngineeringCard details={details} updateDetail={updateDetail} />
      </div>

      <div className="xl:col-span-4 space-y-6">
        <ConstructiveCard details={details} updateDetail={updateDetail} errors={errors} />
      </div>
    </div>
  );
}
