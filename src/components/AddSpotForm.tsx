import React, { useState, useEffect } from 'react';
import { Spot } from '../types';
import { MapPin, Plus, X, Crosshair } from 'lucide-react';

interface AddSpotFormProps {
  onAddSpot: (name: string, description: string, x: number, y: number) => void;
  onCancel: () => void;
  selectedCoords?: { x: number; y: number } | null;
}

export default function AddSpotForm({
  onAddSpot,
  onCancel,
  selectedCoords
}: AddSpotFormProps) {
  const [name, setName] = useState('');
  const [x, setX] = useState<number>(50);
  const [y, setY] = useState<number>(50);

  // Sync selected map coordinates from prop
  useEffect(() => {
    if (selectedCoords) {
      setX(selectedCoords.x);
      setY(selectedCoords.y);
    }
  }, [selectedCoords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddSpot(name.trim(), "", x, y);
    setName('');
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-sm">
          <Plus className="w-4 h-4 text-indigo-500" />
          <span>Добавить новую геоточку</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Название точки <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="например: Кафе 'Уют', Перекресток, Офис"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Visual Map Coordinator */}
        <div className="bg-white p-3 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
              Координаты на карте
            </span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              X: {x}% / Y: {y}%
            </span>
          </div>
          
          <div className="text-[11px] text-indigo-600 font-medium mb-2 leading-relaxed bg-indigo-50 px-2 py-1.5 rounded border border-indigo-100">
            💡 Кликните прямо на интерактивной карте, чтобы автоматически установить это положение!
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">По горизонтали (X)</label>
              <input
                type="range"
                min="5"
                max="95"
                value={x}
                onChange={(e) => setX(parseInt(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">По вертикали (Y)</label>
              <input
                type="range"
                min="5"
                max="95"
                value={y}
                onChange={(e) => setY(parseInt(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-all text-xs font-semibold shadow-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus className="w-4 h-4" />
            <span>Создать геоточку</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-all text-xs font-semibold"
          >
            <span>Отмена</span>
          </button>
        </div>
      </form>
    </div>
  );
}
