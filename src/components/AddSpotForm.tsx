import React, { useState } from 'react';
import { Plus, X, Compass } from 'lucide-react';

interface AddSpotFormProps {
  onAddSpot: (name: string, description: string) => void;
  onCancel: () => void;
}

export default function AddSpotForm({
  onAddSpot,
  onCancel
}: AddSpotFormProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddSpot(name.trim(), "");
    setName('');
  };

  return (
    <div className="bg-[#FAFBF7] rounded-xl p-4 border-2 border-[#3E4A34]/30 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#3E4A34]/10">
        <div className="flex items-center gap-1.5 text-[#3E4A34] font-black text-xs uppercase tracking-wider font-mono">
          <Compass className="w-4 h-4 text-[#F59E0B] animate-pulse" />
          <span>Новая геоточка</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-stone-400 hover:text-[#3E4A34] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            required
            placeholder="ВВЕДИТЕ НАЗВАНИЕ ТОЧКИ (например, С14)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border-2 border-[#3E4A34]/20 hover:border-[#3E4A34]/40 focus:border-[#2D5A27] focus:ring-1 focus:ring-[#2D5A27] rounded-lg focus:outline-none transition-all placeholder:text-stone-400 font-mono uppercase font-black"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#2D5A27] hover:bg-[#1C3E18] text-white rounded-lg hover:shadow transition-all text-xs font-black uppercase tracking-wider shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#A3E635]" />
            <span>Создать</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 border-2 border-[#3E4A34]/25 text-[#3E4A34] hover:bg-[#FAFBF7]/80 rounded-lg transition-all text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            <span>Отмена</span>
          </button>
        </div>
      </form>
    </div>
  );
}
