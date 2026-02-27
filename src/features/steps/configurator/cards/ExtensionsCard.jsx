import React, { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Card, Input, Label, Button, useReadOnly } from '@components/ui/UIKit';

const EXTENSION_TYPES = [
  { value: 'CANOPY', label: 'Навес' },
  { value: 'TAMBUR', label: 'Тамбур' },
  { value: 'VESTIBULE', label: 'Вестибюль' },
  { value: 'PASSAGE', label: 'Переход' },
  { value: 'UTILITY', label: 'Подсобка' },
  { value: 'OTHER', label: 'Прочее' },
];

const VERTICAL_ANCHORS = [
  { value: 'GROUND', label: 'От земли' },
  { value: 'BLOCK_FLOOR', label: 'От этажа блока' },
  { value: 'ROOF', label: 'На кровле' },
];

const CONSTRUCTION_KINDS = [
  { value: 'capital', label: 'Капитальная' },
  { value: 'light', label: 'Легкая' },
];

const createDraft = () => ({
  label: '',
  extensionType: 'OTHER',
  constructionKind: 'capital',
  floorsCount: 1,
  startFloorIndex: 1,
  verticalAnchorType: 'GROUND',
  anchorFloorKey: '',
});

export default function ExtensionsCard({ extensions = [], onCreate, onUpdate, onDelete, disabled = false }) {
  const isReadOnly = useReadOnly();
  const isDisabled = isReadOnly || disabled;
  const [draft, setDraft] = useState(createDraft());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editingDraft, setEditingDraft] = useState(createDraft());

  const resetDraft = () => {
    setDraft(createDraft());
  };

  const handleCreate = async () => {
    if (isDisabled || !draft.label.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        ...draft,
        label: draft.label.trim(),
        floorsCount: Number.parseInt(draft.floorsCount, 10) || 1,
        startFloorIndex: Number.parseInt(draft.startFloorIndex, 10) || 1,
        anchorFloorKey: draft.verticalAnchorType === 'GROUND' ? null : draft.anchorFloorKey || null,
      });
      resetDraft();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = extension => {
    setEditingId(extension.id);
    setEditingDraft({
      label: extension.label || '',
      extensionType: extension.extensionType || 'OTHER',
      constructionKind: extension.constructionKind || 'capital',
      floorsCount: extension.floorsCount || 1,
      startFloorIndex: extension.startFloorIndex || 1,
      verticalAnchorType: extension.verticalAnchorType || 'GROUND',
      anchorFloorKey: extension.anchorFloorKey || '',
    });
  };

  const handleUpdate = async () => {
    if (isDisabled || !editingId || !editingDraft.label.trim()) return;
    setSaving(true);
    try {
      await onUpdate(editingId, {
        ...editingDraft,
        label: editingDraft.label.trim(),
        floorsCount: Number.parseInt(editingDraft.floorsCount, 10) || 1,
        startFloorIndex: Number.parseInt(editingDraft.startFloorIndex, 10) || 1,
        anchorFloorKey:
          editingDraft.verticalAnchorType === 'GROUND' ? null : editingDraft.anchorFloorKey || null,
      });
      setEditingId(null);
      setEditingDraft(createDraft());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 space-y-4 border-l-4 border-l-violet-500">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-700">Пристройки блока</h3>
        <span className="text-xs text-slate-500">{extensions.length} шт.</span>
      </div>

      {disabled && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Функционал пристроек временно отключен feature-flag конфигурацией.
        </div>
      )}

      {extensions.length > 0 && (
        <div className="space-y-2">
          {extensions.map(item => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              {editingId === item.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    value={editingDraft.label}
                    onChange={e => setEditingDraft(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Наименование пристройки"
                    disabled={isDisabled || saving}
                  />
                  <select
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    value={editingDraft.extensionType}
                    onChange={e => setEditingDraft(prev => ({ ...prev, extensionType: e.target.value }))}
                    disabled={isDisabled || saving}
                  >
                    {EXTENSION_TYPES.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    value={editingDraft.constructionKind}
                    onChange={e =>
                      setEditingDraft(prev => ({ ...prev, constructionKind: e.target.value }))
                    }
                    disabled={isDisabled || saving}
                  >
                    {CONSTRUCTION_KINDS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    value={editingDraft.floorsCount}
                    onChange={e =>
                      setEditingDraft(prev => ({ ...prev, floorsCount: Number(e.target.value || 1) }))
                    }
                    disabled={isDisabled || saving}
                  />
                  <select
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    value={editingDraft.verticalAnchorType}
                    onChange={e =>
                      setEditingDraft(prev => ({ ...prev, verticalAnchorType: e.target.value }))
                    }
                    disabled={isDisabled || saving}
                  >
                    {VERTICAL_ANCHORS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    value={editingDraft.startFloorIndex}
                    onChange={e =>
                      setEditingDraft(prev => ({ ...prev, startFloorIndex: Number(e.target.value || 1) }))
                    }
                    disabled={isDisabled || saving}
                  />

                  {editingDraft.verticalAnchorType !== 'GROUND' && (
                    <Input
                      value={editingDraft.anchorFloorKey}
                      onChange={e =>
                        setEditingDraft(prev => ({ ...prev, anchorFloorKey: e.target.value }))
                      }
                      placeholder="anchor_floor_key"
                      disabled={isDisabled || saving}
                    />
                  )}

                  <div className="flex gap-2 md:col-span-2">
                    <Button size="sm" onClick={handleUpdate} disabled={isDisabled || saving}>
                      <Save size={14} className="mr-1" /> Сохранить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      disabled={saving}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.extensionType} · {item.constructionKind} · {item.floorsCount} эт. ·{' '}
                      {item.verticalAnchorType} (старт {item.startFloorIndex})
                    </p>
                  </div>
                  {!isReadOnly && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                        Изменить
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(item.id)}>
                        <Trash2 size={14} className="mr-1" /> Удалить
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isReadOnly && (
        <div className="rounded-lg border border-dashed border-slate-300 p-3 space-y-2">
          <Label className="text-xs text-slate-500">Новая пристройка</Label>
          <Input
            value={draft.label}
            onChange={e => setDraft(prev => ({ ...prev, label: e.target.value }))}
            placeholder="Наименование"
            disabled={saving}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              value={draft.extensionType}
              onChange={e => setDraft(prev => ({ ...prev, extensionType: e.target.value }))}
              disabled={saving}
            >
              {EXTENSION_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              value={draft.constructionKind}
              onChange={e => setDraft(prev => ({ ...prev, constructionKind: e.target.value }))}
              disabled={saving}
            >
              {CONSTRUCTION_KINDS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              value={draft.floorsCount}
              onChange={e => setDraft(prev => ({ ...prev, floorsCount: Number(e.target.value || 1) }))}
              disabled={saving}
            />
            <Input
              type="number"
              min={1}
              value={draft.startFloorIndex}
              onChange={e =>
                setDraft(prev => ({ ...prev, startFloorIndex: Number(e.target.value || 1) }))
              }
              disabled={saving}
            />
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              value={draft.verticalAnchorType}
              onChange={e => setDraft(prev => ({ ...prev, verticalAnchorType: e.target.value }))}
              disabled={saving}
            >
              {VERTICAL_ANCHORS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {draft.verticalAnchorType !== 'GROUND' && (
              <Input
                value={draft.anchorFloorKey}
                onChange={e => setDraft(prev => ({ ...prev, anchorFloorKey: e.target.value }))}
                placeholder="anchor_floor_key"
                disabled={saving}
              />
            )}
          </div>
          <Button size="sm" onClick={handleCreate} disabled={saving || !draft.label.trim()}>
            <Plus size={14} className="mr-1" /> Добавить пристройку
          </Button>
        </div>
      )}
    </Card>
  );
}
