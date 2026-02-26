import React, { useState } from 'react';
import { ImageIcon, Trash2 } from 'lucide-react';
import { Card, Input, Button, useReadOnly } from '@components/ui/UIKit';
import { useProject } from '@context/ProjectContext';

export default function PhotoTab({ building }) {
  const { buildingDetails, setBuildingDetails } = useProject();
  const isReadOnly = useReadOnly();
  const [photoUrlInput, setPhotoUrlInput] = useState('');

  const photoKey = `${building.id}_photo`;
  const currentPhoto = buildingDetails[photoKey];

  const handleSave = () => {
    if (photoUrlInput) setBuildingDetails(p => ({ ...p, [photoKey]: photoUrlInput }));
  };

  const handleClear = () => {
    setBuildingDetails(p => ({ ...p, [photoKey]: '' }));
  };

  return (
    <Card className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] border-2 border-dashed border-slate-200 shadow-none">
      {currentPhoto ? (
        <div className="relative group max-w-lg">
          <img
            src={currentPhoto}
            className="rounded-2xl shadow-xl ring-4 ring-white"
            alt="Facade"
          />
          {!isReadOnly && (
            <button
              onClick={handleClear}
              className="absolute top-4 right-4 bg-white text-red-500 p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-2">
            <ImageIcon size={40} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-700">Изображение фасада</h3>
            <p className="text-slate-400 text-sm">Вставьте прямую ссылку на изображение</p>
          </div>
          <div className="flex gap-2 w-full max-w-md mt-4">
            <Input
              type="text"
              placeholder="https://example.com/image.jpg"
              value={photoUrlInput}
              onChange={e => setPhotoUrlInput(e.target.value)}
              className="shadow-sm"
            />
            <Button
              disabled={isReadOnly}
              onClick={handleSave}
              className="shadow-lg shadow-blue-200"
            >
              Загрузить
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
