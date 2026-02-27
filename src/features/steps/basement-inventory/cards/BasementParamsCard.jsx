import React from 'react';
import { Archive, Link2 } from 'lucide-react';
import { Card, SectionTitle, Label } from '@components/ui/UIKit';

export default function BasementParamsCard({
  basement,
  updateBasementField,
  isMultiblockResidential,
  blocks,
  toggleBlockLink,
  isReadOnly
}) {
  const depth = Math.min(4, Math.max(1, parseInt(basement.depth, 10) || 1));
  const entrancesCount = Math.min(10, Math.max(1, parseInt(basement.entrancesCount, 10) || 1));
  const linkedBlocks = Array.isArray(basement.blocks) ? basement.blocks : [];

  return (
    <Card className="p-6 shadow-md border-t-4 border-t-blue-500">
      <SectionTitle icon={Archive}>Основные параметры</SectionTitle>
      
      <div className="space-y-6 mt-4">
        {/* Глубина */}
        <div className="space-y-2">
          <Label>Глубина (уровней вниз)</Label>
          <div className="flex items-center gap-3">
            <button
              disabled={isReadOnly}
              onClick={() => updateBasementField(basement.id, { depth: Math.max(1, depth - 1) })}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
            >
              -
            </button>
            <span className="font-bold text-2xl w-10 text-center text-slate-700">{depth}</span>
            <button
              disabled={isReadOnly}
              onClick={() => updateBasementField(basement.id, { depth: Math.min(4, depth + 1) })}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full" />

        {/* Входы */}
        <div className="space-y-2">
          <Label>Количество входов в подвал (макс. 10)</Label>
          <div className="flex items-center gap-3">
            <button
              disabled={isReadOnly}
              onClick={() => updateBasementField(basement.id, { entrancesCount: Math.max(1, entrancesCount - 1) })}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
            >
              -
            </button>
            <span className="font-bold text-2xl w-10 text-center text-slate-700">{entrancesCount}</span>
            <button
              disabled={isReadOnly}
              onClick={() => updateBasementField(basement.id, { entrancesCount: Math.min(10, entrancesCount + 1) })}
              className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Обслуживаемые блоки */}
        {isMultiblockResidential && (
          <>
            <div className="h-px bg-slate-100 w-full" />
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
              <Label className="text-blue-900 flex items-center gap-2 mb-3">
                <Link2 size={16} className="text-blue-500" /> Обслуживаемые блоки (обязательно)
              </Label>
              <div className="flex flex-wrap gap-2">
                {blocks.map(block => {
                  const active = linkedBlocks.includes(block.id);
                  return (
                    <button
                      key={block.id}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleBlockLink(basement.id, block.id)}
                      className={`
                        px-3 py-2 rounded-lg text-xs font-bold transition-all border 
                        ${active 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                          : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
                        } 
                        ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {block.tabLabel || block.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}