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
          <Plus className="w-4 h-4 text-blue-500" />
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
          <input
            type="text"
            required
            placeholder="Введите название геоточки"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all text-xs font-semibold shadow-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus className="w-4 h-4" />
            <span>Создать</span>
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
