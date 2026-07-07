import React, { useState } from 'react';
import { Spot, UserPresence } from '../types';
import { MapPin, Users, Plus, Crosshair, ArrowRight } from 'lucide-react';

interface MapBoardProps {
  spots: Spot[];
  presence: UserPresence[];
  currentUserId: string;
  onSelectSpot: (spot: Spot) => void;
  selectedSpotId?: string;
  isAddingSpotMode: boolean;
  onMapClickForCoords?: (x: number, y: number) => void;
  newSpotCoords?: { x: number; y: number } | null;
}

export default function MapBoard({
  spots,
  presence,
  currentUserId,
  onSelectSpot,
  selectedSpotId,
  isAddingSpotMode,
  onMapClickForCoords,
  newSpotCoords
}: MapBoardProps) {
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);

  // Helper to get users checked-in at a specific spot
  const getUsersAtSpot = (spotId: string) => {
    return presence.filter((p) => p.spotId === spotId);
  };

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingSpotMode || !onMapClickForCoords) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    
    // Clamp coordinates to 5-95 range to keep them safely inside the board boundaries
    const clampedX = Math.max(5, Math.min(95, x));
    const clampedY = Math.max(5, Math.min(95, y));

    onMapClickForCoords(clampedX, clampedY);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-indigo-500" />
          <h2 className="text-sm font-semibold tracking-tight text-slate-800">
            Интерактивная карта геоточек
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            Вы на месте
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
            Другие
          </span>
        </div>
      </div>

      {/* Main Board Canvas */}
      <div
        id="geopoints-map-canvas"
        onClick={handleBoardClick}
        className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 shadow-inner select-none transition-all duration-300 ${
          isAddingSpotMode ? 'cursor-crosshair ring-2 ring-indigo-500/30 ring-offset-2' : 'cursor-default'
        }`}
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Helper layout guides for adding spots */}
        {isAddingSpotMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-indigo-900/70 text-center text-white backdrop-blur-[2px] transition-all duration-300 pointer-events-none z-10">
            <Plus className="w-10 h-10 mb-2 text-indigo-300 animate-bounce" />
            <p className="text-sm font-medium">Кликните в любом месте карты,</p>
            <p className="text-xs text-indigo-200 mt-1">чтобы установить новые координаты для точки</p>
          </div>
        )}

        {/* Temporary coordinate target marker */}
        {isAddingSpotMode && newSpotCoords && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none"
            style={{ left: `${newSpotCoords.x}%`, top: `${newSpotCoords.y}%` }}
          >
            <span className="absolute w-8 h-8 rounded-full bg-red-500/30 animate-ping"></span>
            <MapPin className="w-8 h-8 text-rose-500 fill-rose-100" />
            <span className="mt-1 px-2 py-0.5 rounded bg-slate-950 text-[10px] text-white font-mono shadow-md border border-slate-800">
              X:{newSpotCoords.x} Y:{newSpotCoords.y}
            </span>
          </div>
        )}

        {/* Render actual location spots */}
        {!isAddingSpotMode &&
          spots.map((spot) => {
            const usersAtSpot = getUsersAtSpot(spot.id);
            const containsCurrentUser = usersAtSpot.some((u) => u.userId === currentUserId);
            const isSelected = selectedSpotId === spot.id;
            const isHovered = hoveredSpotId === spot.id;

            // Coordinates fallback if not specified
            const posX = spot.x ?? 50;
            const posY = spot.y ?? 50;

            return (
              <div
                key={spot.id}
                id={`map-spot-${spot.id}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-300"
                style={{ left: `${posX}%`, top: `${posY}%` }}
              >
                {/* Visual pulse rings */}
                {usersAtSpot.length > 0 && (
                  <span
                    className={`absolute inset-0 -m-3 rounded-full pulse-ring-element pointer-events-none ${
                      containsCurrentUser ? 'bg-emerald-500/20' : 'bg-indigo-500/20'
                    }`}
                  ></span>
                )}

                {/* Spot Pin / Node button */}
                <button
                  onClick={() => onSelectSpot(spot)}
                  onMouseEnter={() => setHoveredSpotId(spot.id)}
                  onMouseLeave={() => setHoveredSpotId(null)}
                  className={`relative flex items-center justify-center w-11 h-11 rounded-full border shadow-md transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 ring-4 ring-indigo-500/20 scale-105'
                      : containsCurrentUser
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-300 hover:bg-emerald-100'
                      : usersAtSpot.length > 0
                      ? 'bg-indigo-50 text-indigo-600 border-indigo-300 hover:bg-indigo-100'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className={`w-5 h-5 ${isSelected ? 'fill-slate-800' : ''}`} />

                  {/* Presence indicator count badge */}
                  {usersAtSpot.length > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full text-[10px] font-bold border border-white text-white shadow-sm ${
                        containsCurrentUser ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                    >
                      {usersAtSpot.length}
                    </span>
                  )}
                </button>

                {/* Hover/Select tooltip label */}
                <div
                  className={`absolute top-12 left-1/2 -translate-x-1/2 w-32 bg-white/95 border border-slate-200 px-2 py-1.5 rounded-lg text-center shadow-lg pointer-events-none transition-all duration-200 z-30 ${
                    isHovered || isSelected ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-1 invisible'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-800 truncate">{spot.name}</p>
                  
                  {usersAtSpot.length > 0 ? (
                    <div className="flex items-center justify-center gap-1 mt-1 text-[10px] text-slate-500 font-medium">
                      <Users className="w-3 h-3" />
                      <span>
                        {usersAtSpot.length === 1 ? '1 человек' : `${usersAtSpot.length} чел.`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">Пусто</p>
                  )}
                  
                  {isSelected && (
                    <div className="mt-1 flex items-center justify-center text-[9px] text-indigo-500 font-semibold uppercase tracking-wider animate-pulse">
                      <span>Выбрано</span>
                      <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                    </div>
                  )}
                </div>

                {/* Micro avatars sitting atop the node */}
                {usersAtSpot.length > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center -space-x-1 bg-white/80 backdrop-blur-[1px] px-1.5 py-0.5 rounded-full border border-slate-200/50 shadow-sm pointer-events-none max-w-[80px] overflow-hidden">
                    {usersAtSpot.slice(0, 3).map((p, idx) => (
                      <div
                        key={idx}
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm ring-1 ring-white ${
                          p.userId === currentUserId ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        title={p.userName}
                      >
                        {p.userName.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {usersAtSpot.length > 3 && (
                      <span className="text-[7px] text-slate-500 font-bold ml-1">
                        +{usersAtSpot.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <div className="mt-2 text-[11px] text-slate-500">
        {!isAddingSpotMode ? (
          <p className="italic">
            Кликните на геоточку на карте, чтобы подробнее посмотреть список присутствующих или отметиться на месте.
          </p>
        ) : (
          <p className="text-indigo-600 font-medium">
            Режим расстановки: кликните по карте выше, чтобы выбрать расположение новой геоточки.
          </p>
        )}
      </div>
    </div>
  );
}
