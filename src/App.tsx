import React, { useState, useEffect, useRef } from 'react';
import { Spot, UserPresence, RoomState, HistoryEvent, ActiveUser } from './types';
import {
  createRoom,
  fetchRoomState,
  updateRoomState,
  DEFAULT_SPOTS,
  createInitialState
} from './lib/api';
import AddSpotForm from './components/AddSpotForm';
import {
  MapPin,
  Users,
  RefreshCw,
  LogOut,
  Share2,
  Copy,
  Plus,
  Trash2,
  Clock,
  Compass,
  CheckCircle,
  User,
  ArrowRight,
  ChevronRight,
  HelpCircle,
  AlertCircle,
  Map as MapIcon,
  X,
  Info,
  Layers,
  Settings,
  Database
} from 'lucide-react';

// Help functions to generate random IDs
const generateId = (length: number = 8): string => {
  return Math.random().toString(36).substring(2, 2 + length);
};

const AVAILABLE_GROUPS = [
  'Группа 1',
  'Группа 3',
  'Группа 4',
  'Группа 5',
  'Группа 6',
  'Группа 7',
  'Группа 8',
  'Группа 14',
  'Группа 15',
  'Группа 18',
  'Группа 19',
  'Группа 23'
];

export default function App() {
  // --- User State ---
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [tempName, setTempName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showGroupSelector, setShowGroupSelector] = useState<boolean>(false);

  // --- Room & Connection State ---
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Creation States ---
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  
  // --- Spot Addition State ---
  const [isAddingSpot, setIsAddingSpot] = useState<boolean>(false);
  const [newSpotCoords, setNewSpotCoords] = useState<{ x: number; y: number } | null>(null);
  
  // --- UI Interactivity State ---
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards'); // Default view switcher for High Density layout
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState<boolean>(false);
  const [isActivityExpanded, setIsActivityExpanded] = useState<boolean>(false);

  // --- Refs ---
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize user from localStorage or generate new
  useEffect(() => {
    let savedUserId = localStorage.getItem('coloc_userid');
    const savedGroup = localStorage.getItem('coloc_selected_group');

    if (!savedUserId) {
      savedUserId = 'u-' + generateId();
      localStorage.setItem('coloc_userid', savedUserId);
    }
    setUserId(savedUserId);

    if (savedGroup && AVAILABLE_GROUPS.includes(savedGroup)) {
      setSelectedGroup(savedGroup);
      setUserName(savedGroup);
      setTempName(savedGroup);
      localStorage.setItem('coloc_username', savedGroup);
    } else {
      // If no valid group is selected, force show the group selector on load
      setShowGroupSelector(true);
      setUserName('Группа не выбрана');
      setTempName('Группа не выбрана');
    }

    // 2. Check URL for room code ?room=YOUR_ID or hash
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room') || window.location.hash.replace('#', '');
    
    if (urlRoom) {
      setRoomId(urlRoom);
    } else {
      const savedRoomId = localStorage.getItem('coloc_last_room');
      if (savedRoomId) {
        setRoomId(savedRoomId);
      } else {
        // Fallback to the user's requested default room API bin
        setRoomId('d5590d7a9d5aeceb4195');
      }
    }
  }, []);

  // 3. Load room state whenever roomId changes
  useEffect(() => {
    if (!roomId) {
      setRoomState(null);
      return;
    }

    // Save to local storage as last room
    localStorage.setItem('coloc_last_room', roomId);
    
    // Update URL query parameter without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url.toString());

    loadRoomData(roomId, true);
  }, [roomId]);

  // 4. Polling effect: auto-sync every 10 seconds
  useEffect(() => {
    if (!roomId) {
      stopTimers();
      return;
    }

    // Start countdown and sync timers
    startTimers();

    return () => {
      stopTimers();
    };
  }, [roomId]);

  const startTimers = () => {
    stopTimers();
    setCountdown(10);

    // Countdown timer (runs every second)
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger sync when countdown hits 0
          syncData();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimers = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
  };

  // Helper to force synchronization
  const syncData = async () => {
    if (!roomId || isSaving || isSyncing) return;
    setIsSyncing(true);
    try {
      await loadRoomData(roomId, false);
    } catch (e) {
      console.warn('Sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Main loader for room data
  const loadRoomData = async (targetRoomId: string, showSpinner: boolean) => {
    if (showSpinner) setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRoomState(targetRoomId);
      
      // Update our presence in the list of users
      let updatedUsers = [...data.users];
      const userIndex = updatedUsers.findIndex((u) => u.id === userId);
      
      const nowString = new Date().toISOString();
      if (userIndex >= 0) {
        updatedUsers[userIndex] = {
          ...updatedUsers[userIndex],
          name: userName,
          lastActive: nowString
        };
      } else {
        updatedUsers.push({
          id: userId,
          name: userName,
          lastActive: nowString
        });
      }

      // Filter out users who have been inactive for more than 48 hours to keep list clean
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      updatedUsers = updatedUsers.filter((u) => new Date(u.lastActive) > cutoff);

      const nextState = { ...data, users: updatedUsers };
      setRoomState(nextState);

      // Save user heartbeat back to server silently if user was added/updated
      if (JSON.stringify(data.users) !== JSON.stringify(updatedUsers)) {
        await updateRoomState(targetRoomId, nextState);
      }
    } catch (err: any) {
      console.error(err);
      setError('Не удалось загрузить данные группы. Проверьте ID или создайте новую группу.');
      // If room not found/invalid, clear local last room
      if (showSpinner) {
        setRoomId(null);
        localStorage.removeItem('coloc_last_room');
      }
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  // Create room handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newRoomName.trim() || 'Наша Компания';
    setIsLoading(true);
    setError(null);
    try {
      const newId = await createRoom(title);
      setRoomId(newId);
      setNewRoomName('');
    } catch (err) {
      setError('Не удалось создать комнату на api.npoint.io. Пожалуйста, попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  };

  // Join room handler
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = inputRoomId.trim();
    if (targetId) {
      setRoomId(targetId);
      setInputRoomId('');
    }
  };

  // Handle Nickname Update
  const handleSaveName = async () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    
    setUserName(trimmed);
    localStorage.setItem('coloc_username', trimmed);
    setIsEditingName(false);

    // If already in a room, synchronize the name change
    if (roomId && roomState) {
      setIsSaving(true);
      try {
        const updatedUsers = roomState.users.map((u) =>
          u.id === userId ? { ...u, name: trimmed, lastActive: new Date().toISOString() } : u
        );
        // Also update the presence list names
        const updatedPresence = roomState.presence.map((p) =>
          p.userId === userId ? { ...p, userName: trimmed } : p
        );

        const nextState = {
          ...roomState,
          users: updatedUsers,
          presence: updatedPresence
        };

        setRoomState(nextState);
        await updateRoomState(roomId, nextState);
      } catch (err) {
        console.error('Failed to update nickname in room:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Select group handler
  const handleSelectGroup = async (groupName: string) => {
    setSelectedGroup(groupName);
    setUserName(groupName);
    setTempName(groupName);
    localStorage.setItem('coloc_selected_group', groupName);
    localStorage.setItem('coloc_username', groupName);
    setShowGroupSelector(false);

    // If already in a room, synchronize the name change
    if (roomId && roomState) {
      setIsSaving(true);
      try {
        const updatedUsers = roomState.users.map((u) =>
          u.id === userId ? { ...u, name: groupName, lastActive: new Date().toISOString() } : u
        );
        // Also update the presence list names
        const updatedPresence = roomState.presence.map((p) =>
          p.userId === userId ? { ...p, userName: groupName } : p
        );

        const nextState = {
          ...roomState,
          users: updatedUsers,
          presence: updatedPresence
        };

        setRoomState(nextState);
        await updateRoomState(roomId, nextState);
      } catch (err) {
        console.error('Failed to update group name in room:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Leave current room
  const handleLeaveRoom = () => {
    stopTimers();
    setRoomId(null);
    setRoomState(null);
    localStorage.removeItem('coloc_last_room');
    
    // Clear URL parameter
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  };

  // CHECK-IN / CHECK-OUT Core Logic
  const handleTogglePresence = async (spotId: string) => {
    if (!roomId || !roomState) return;

    setIsSaving(true);
    stopTimers(); // pause polling during transaction
    
    try {
      // Re-fetch latest state to prevent race conditions as much as possible
      const freshState = await fetchRoomState(roomId);
      
      const spot = freshState.spots.find((s) => s.id === spotId);
      if (!spot) throw new Error('Геоточка не найдена.');

      // Check if ANYONE is currently checked in at this spot
      const presencesAtThisSpot = freshState.presence.filter((p) => p.spotId === spotId);
      const isAnyUserAtThisSpot = presencesAtThisSpot.length > 0;

      let nextPresence = [...freshState.presence];
      let nextHistory = [...freshState.history];

      // Format event details
      const nowString = new Date().toISOString();

      if (isAnyUserAtThisSpot) {
        // --- REMOVE ALL MARKS AT THIS SPOT (Leave 'nobody' / 'никого') ---
        nextPresence = nextPresence.filter((p) => p.spotId !== spotId);
        
        // Log check-out events for history for everyone who was checked in at this spot
        for (const presenceUser of presencesAtThisSpot) {
          const checkOutEvent: HistoryEvent = {
            id: 'ev-' + generateId(),
            userId: presenceUser.userId,
            userName: presenceUser.userName,
            spotId,
            spotName: spot.name,
            type: 'check-out',
            timestamp: nowString
          };
          nextHistory = [checkOutEvent, ...nextHistory];
        }
        nextHistory = nextHistory.slice(0, 150); // Keep last 150 events
      } else {
        // --- CHECK IN ON EMPTY SPOT ---
        // A user can only be at ONE spot at a time. If they are somewhere else, automatically check them out from there first!
        const existingPresences = nextPresence.filter((p) => p.userId === userId);
        
        for (const prev of existingPresences) {
          const prevSpot = freshState.spots.find((s) => s.id === prev.spotId);
          const checkOutEvent: HistoryEvent = {
            id: 'ev-' + generateId(),
            userId,
            userName,
            spotId: prev.spotId,
            spotName: prevSpot ? prevSpot.name : 'Предыдущая точка',
            type: 'check-out',
            timestamp: nowString
          };
          nextHistory = [checkOutEvent, ...nextHistory];
        }

        // Remove previous presence entirely for the current user
        nextPresence = nextPresence.filter((p) => p.userId !== userId);

        // Add new check-in presence for the current group
        nextPresence.push({
          userId,
          userName,
          spotId,
          timestamp: nowString
        });

        // Add check-in event
        const checkInEvent: HistoryEvent = {
          id: 'ev-' + generateId(),
          userId,
          userName,
          spotId,
          spotName: spot.name,
          type: 'check-in',
          timestamp: nowString
        };
        nextHistory = [checkInEvent, ...nextHistory].slice(0, 150);
      }

      // Build updated state
      const nextState: RoomState = {
        ...freshState,
        presence: nextPresence,
        history: nextHistory,
        // Make sure we exist/are updated in users
        users: freshState.users.map((u) =>
          u.id === userId ? { ...u, name: userName, lastActive: nowString } : u
        )
      };

      // Push back to server
      await updateRoomState(roomId, nextState);
      setRoomState(nextState);
    } catch (err: any) {
      console.error(err);
      alert('Ошибка при сохранении статуса. Пожалуйста, попробуйте обновить страницу.');
    } finally {
      setIsSaving(false);
      startTimers(); // resume polling
    }
  };

  // Add custom spot
  const handleAddCustomSpot = async (name: string, description: string, x: number, y: number) => {
    if (!roomId || !roomState) return;

    setIsSaving(true);
    stopTimers();

    try {
      const freshState = await fetchRoomState(roomId);
      
      const newSpot: Spot = {
        id: 'spot-' + generateId(),
        name,
        description,
        x,
        y
      };

      const nextState: RoomState = {
        ...freshState,
        spots: [...freshState.spots, newSpot]
      };

      await updateRoomState(roomId, nextState);
      setRoomState(nextState);
      setIsAddingSpot(false);
      setNewSpotCoords(null);
      setSelectedSpotId(newSpot.id); // select newly created spot
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить новую геоточку. Попробуйте еще раз.');
    } finally {
      setIsSaving(false);
      startTimers();
    }
  };

  // Delete a custom spot
  const handleDeleteSpot = async (spotId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent selecting the spot when clicking delete
    
    if (!roomId || !roomState) return;

    const spotToDelete = roomState.spots.find(s => s.id === spotId);
    if (!spotToDelete) return;

    const peopleThere = roomState.presence.filter(p => p.spotId === spotId);
    if (peopleThere.length > 0) {
      if (!confirm(`На точке "${spotToDelete.name}" сейчас находятся люди (${peopleThere.length} чел.). Вы уверены, что хотите удалить эту точку?`)) {
        return;
      }
    } else {
      if (!confirm(`Вы действительно хотите удалить геоточку "${spotToDelete.name}"?`)) {
        return;
      }
    }

    setIsSaving(true);
    stopTimers();

    try {
      const freshState = await fetchRoomState(roomId);
      
      // Remove spot and its presence data
      const nextSpots = freshState.spots.filter(s => s.id !== spotId);
      const nextPresence = freshState.presence.filter(p => p.spotId !== spotId);

      const nextState: RoomState = {
        ...freshState,
        spots: nextSpots,
        presence: nextPresence
      };

      await updateRoomState(roomId, nextState);
      setRoomState(nextState);
      if (selectedSpotId === spotId) {
        setSelectedSpotId(null);
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении точки.');
    } finally {
      setIsSaving(false);
      startTimers();
    }
  };

  // Helper to copy links/IDs
  const copyRoomLink = () => {
    if (!roomId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyRoomId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Convert coordinate layout percent to mock real latitude / longitude coordinates
  const getMockCoords = (spot: Spot) => {
    const defaultLat = 55.7558;
    const defaultLng = 37.6173;
    const lat = (defaultLat + ((spot.y ?? 50) - 50) * 0.0015).toFixed(4);
    const lng = (defaultLng + ((spot.x ?? 50) - 50) * 0.0025).toFixed(4);
    return `${lat}° N, ${lng}° E`;
  };

  // Render check-in / check-out history event
  const renderHistoryItem = (ev: HistoryEvent) => {
    const date = new Date(ev.timestamp);
    const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isCurrentUser = ev.userId === userId;
    const isCheckIn = ev.type === 'check-in';

    // Different color markers based on action type
    const borderClass = isCheckIn 
      ? 'border-l-2 border-emerald-500' 
      : 'border-l-2 border-slate-300';

    return (
      <div
        key={ev.id}
        className={`${borderClass} pl-3 py-1.5 transition-all text-[11px] hover:bg-slate-50`}
      >
        <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
          <span>{timeFormatted}</span>
          {isCurrentUser && <span className="text-[9px] font-mono bg-indigo-50 text-indigo-600 px-1 rounded">Вы</span>}
        </div>
        <p className="mt-0.5 text-slate-700 leading-tight">
          <strong className="text-slate-900 font-semibold">{ev.userName}</strong>{' '}
          {isCheckIn ? (
            <span>
              прибыл на <span className="text-emerald-600 font-bold uppercase">{ev.spotName}</span>
            </span>
          ) : (
            <span>
              снялся с <span className="text-slate-500 font-bold uppercase">{ev.spotName}</span>
            </span>
          )}
        </p>
      </div>
    );
  };

  // Find the spot where the current user is active right now
  const currentUserPresence = roomState?.presence.find(p => p.userId === userId);
  const currentUserSpot = currentUserPresence 
    ? roomState?.spots.find(s => s.id === currentUserPresence.spotId)
    : null;

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 overflow-x-hidden">
      
      {/* Top Navigation / Header */}
      <header className="h-14 bg-[#1E293B] text-white flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-md">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <div className="bg-blue-500 p-1.5 rounded flex items-center justify-center shrink-0">
            <Compass className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-[11px] sm:text-sm font-black tracking-wider uppercase flex items-center gap-2">
              <span className="inline xs:hidden">GeoSync</span>
              <span className="hidden xs:inline">GeoSync Collective</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono hidden xs:block">
              {roomId ? `API: npoint.io/bin/${roomId.slice(0, 10)}` : 'API: npoint.io/v1/collective'}
            </p>
          </div>
        </div>

        {roomId && (
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Сессия: {roomState?.roomName || 'Синхронизация...'}
              </span>
            </div>
            <div className="h-8 w-[1px] bg-slate-700"></div>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          {roomId && (
            <button
              onClick={() => setShowGroupSelector(true)}
              className="text-right flex flex-col justify-center cursor-pointer hover:bg-slate-700/60 px-2.5 py-1 rounded-lg border border-slate-700 transition-all text-white bg-slate-800/40 text-left"
            >
              <div className="flex flex-col">
                <p className="text-[10px] sm:text-[11px] font-black tracking-tight leading-tight flex items-center gap-1">
                  <span>{userName}</span>
                  <Settings className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                </p>
                <p className="text-[8px] sm:text-[10px] text-emerald-400 font-semibold leading-tight">
                  {currentUserSpot ? `На точке: ${currentUserSpot.name}` : 'Вне точек'}
                </p>
              </div>
            </button>
          )}

          <div 
            onClick={() => setShowGroupSelector(true)}
            className={`w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full bg-blue-600 border border-blue-500 flex items-center justify-center text-xs font-black text-white cursor-pointer hover:bg-blue-500 transition-colors shrink-0 ${
              currentUserSpot ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-slate-900' : ''
            }`}
            title="Нажмите для выбора группы"
          >
            {userName && userName.startsWith('Группа ') ? userName.replace('Группа ', '') : 'G'}
          </div>
        </div>
      </header>

      {/* Main Viewport Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        
        {/* Error Notice */}
        {error && (
          <div className="w-full bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-3 text-rose-800 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold">Ошибка соединения</p>
              <p className="text-rose-700 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Setup Screen / Join & Create Form (if not logged into any group) */}
        {!roomId ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full py-10">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-md w-full">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <Compass className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight text-center uppercase">
                GeoSync Collective Setup
              </h2>
              <p className="text-xs text-slate-500 mt-1 text-center max-w-xs mx-auto leading-relaxed">
                Введите имя вашей группы для мгновенного развертывания коллективного трекера или присоединитесь к существующему узлу.
              </p>

              <hr className="my-5 border-slate-100" />

              {/* Action 1: Create room */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Создать новый узел группы
                </label>
                <form onSubmit={handleCreateRoom} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Например: Пятничный маршрут, Сбор"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-medium placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Создать</span>
                  </button>
                </form>
              </div>

              <div className="relative my-5 text-center">
                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-100"></span>
                <span className="relative bg-white px-3 text-[9px] text-slate-400 font-bold uppercase tracking-widest">или</span>
              </div>

              {/* Action 2: Join room */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Присоединиться по ID
                </label>
                <form onSubmit={handleJoinRoom} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Вставьте ID контейнера (например: b53f19)"
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!inputRoomId.trim()}
                    className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded hover:bg-slate-900 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Войти</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-200 mt-5">
                <div className="flex gap-2">
                  <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-500 leading-normal">
                    <strong>Синхронизация npoint:</strong> все отметки и изменения в реальном времени сохраняются в облаке и транслируются вашей команде. Ссылка-приглашение содержит код доступа.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Connected State: Three column High-Density workspace */
          <>
            {/* COLUMN 1: Sidebar Group Status */}
            <aside className="w-full lg:w-64 order-2 lg:order-1 bg-white border border-slate-200 rounded-lg flex flex-col shrink-0 shadow-sm overflow-hidden transition-all duration-300">
              <div 
                onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
                className="p-3 border-b border-slate-100 bg-[#F8FAFC] flex justify-between items-center shrink-0 cursor-pointer lg:cursor-default"
              >
                <h2 className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span>Участники Группы ({roomState?.users.length || 0})</span>
                </h2>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase">
                    {roomState?.presence.length || 0} на месте
                  </span>
                  <div className="lg:hidden">
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isParticipantsExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </div>
              
              <div className={`${isParticipantsExpanded ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'} flex-1`}>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[220px] lg:max-h-none">
                  {roomState?.users && roomState.users.length > 0 ? (
                    roomState.users.map((user) => {
                      const userPresence = roomState.presence.find(p => p.userId === user.id);
                      const userSpot = userPresence ? roomState.spots.find(s => s.id === userPresence.spotId) : null;
                      const isMe = user.id === userId;

                      return (
                        <div
                          key={user.id}
                          className={`flex items-center justify-between p-2 rounded text-xs transition-all ${
                            userSpot 
                              ? isMe 
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium'
                                : 'bg-blue-50 border border-blue-100 text-blue-900'
                              : 'hover:bg-slate-50 border border-transparent text-slate-600'
                          }`}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${userSpot ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                            <span className="truncate">{user.name} {isMe && '(Вы)'}</span>
                          </span>
                          {userSpot ? (
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isMe ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                            } truncate max-w-[90px]`}>
                              {userSpot.name}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-mono">OFF-SITE</span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-4">Список пуст</p>
                  )}
                </div>

                {/* Compact Quick Link Card */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 shrink-0 text-[10px] space-y-2">
                  <p className="text-slate-500 leading-normal font-medium">
                    <strong>ID Узла:</strong> <span className="font-mono bg-white px-1 py-0.5 border border-slate-200 rounded">{roomId}</span>
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={copyRoomLink}
                      className="flex-1 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded flex items-center justify-center gap-1 active:scale-95 transition-all text-[9px]"
                    >
                      <Share2 className="w-2.5 h-2.5 text-blue-500" />
                      <span>{copiedLink ? 'Скопировано!' : 'Копировать Ссылку'}</span>
                    </button>
                    <button
                      onClick={copyRoomId}
                      className="py-1 px-2 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded flex items-center justify-center active:scale-95 transition-all text-[9px]"
                      title="Скопировать ID комнаты"
                    >
                      {copiedId ? 'Copied' : <Copy className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            {/* COLUMN 2: Center Grid: Geo Points */}
            <section className="flex-1 flex flex-col gap-3 min-w-0 order-1 lg:order-2">
              
              {/* View Content area */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg p-10">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-xs text-slate-400 mt-2 font-mono">Обновление базы...</p>
                  </div>
                ) : (
                  /* TAB: Location High Density Cards */
                  <div className="space-y-4">
                    
                    {isAddingSpot && (
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <AddSpotForm
                          onAddSpot={handleAddCustomSpot}
                          onCancel={() => {
                            setIsAddingSpot(false);
                            setNewSpotCoords(null);
                          }}
                          selectedCoords={newSpotCoords}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4">
                      {roomState?.spots && roomState.spots.length > 0 ? (
                        roomState.spots.map((spot) => {
                          const usersAtSpot = roomState.presence.filter(p => p.spotId === spot.id);
                          const isCurrentUserThere = usersAtSpot.some(u => u.userId === userId);
                          const isSelected = selectedSpotId === spot.id;

                          // Dynamic card border highlight if current user is checked-in there (as in design html)
                          const cardStyle = isCurrentUserThere
                            ? 'border-2 border-emerald-500 bg-white'
                            : isSelected
                            ? 'border-2 border-blue-500 bg-white shadow-md'
                            : 'border border-slate-200 bg-white hover:border-slate-300';

                          return (
                            <div
                              key={spot.id}
                              onClick={() => handleTogglePresence(spot.id)}
                              className={`${cardStyle} rounded-lg sm:rounded-xl p-2.5 sm:p-4 shadow-xs flex flex-col relative transition-all duration-200 cursor-pointer group hover:shadow-md`}
                            >
                              <div className="flex justify-between items-start mb-1 sm:mb-2 min-w-0">
                                <h3 className="text-xs sm:text-base md:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-1 min-w-0">
                                  <span className="shrink-0">📍</span>
                                  <span className="truncate">{spot.name}</span>
                                </h3>
                              </div>

                              {/* Two Indicators as requested */}
                              <div className="space-y-1 sm:space-y-2 mt-1 flex-1">
                                {/* Indicator 1: Green or Red presence status dot */}
                                <div className="flex items-center gap-1.5">
                                  {usersAtSpot.length > 0 ? (
                                    <>
                                      <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block shrink-0"></span>
                                      <span className="text-[10px] sm:text-xs font-black text-emerald-700 uppercase tracking-tight">На месте</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-rose-500 inline-block shrink-0"></span>
                                      <span className="text-[10px] sm:text-xs font-black text-rose-600 uppercase tracking-tight animate-none">Никого</span>
                                    </>
                                  )}
                                </div>

                                {/* Indicator 2: Travelers name (visible only if someone is on site) */}
                                {usersAtSpot.length > 0 && (
                                  <div className="text-[10px] sm:text-xs text-slate-700 font-medium pt-0.5">
                                    <span className="text-slate-400 font-bold uppercase text-[8px] sm:text-[9px] tracking-wider block mb-0.5 sm:mb-1">
                                      {usersAtSpot.length === 1 ? 'Путник' : 'Путники'}:
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {usersAtSpot.map((presenceUser) => (
                                        <span
                                          key={presenceUser.userId}
                                          className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[11px] font-bold ${
                                            presenceUser.userId === userId
                                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                                          } truncate max-w-full`}
                                        >
                                          {presenceUser.userName.split(' ')[0]} {presenceUser.userId === userId && '*'}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Bottom divider and info */}
                              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 mt-2.5 text-[8px] sm:text-[10px]">
                                <span className="font-mono text-slate-300 hidden sm:inline">
                                  ID: {spot.id.slice(0, 4)}...
                                </span>
                                <span className="text-slate-400 font-bold uppercase tracking-tight group-hover:text-blue-500 transition-colors truncate max-w-full">
                                  {usersAtSpot.length > 0 ? 'Убрать отметку' : 'Отметиться'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">
                          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <h4 className="text-sm font-bold text-slate-700">Нет геоточек</h4>
                          <p className="text-xs text-slate-400 mt-1">Добавьте первую точку, чтобы начать!</p>
                        </div>
                      )}
                    </div>

                    {!isAddingSpot && (
                      <button
                        onClick={() => setIsAddingSpot(true)}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>ДОБАВИТЬ НОВУЮ ГЕОТОЧКУ</span>
                      </button>
                    )}

                  </div>
                )}
              </div>
            </section>

            {/* COLUMN 3: Right Side Activity Stream */}
            <aside className="w-full lg:w-72 order-3 bg-white border border-slate-200 rounded-lg flex flex-col shrink-0 shadow-sm overflow-hidden transition-all duration-300">
              <div 
                onClick={() => setIsActivityExpanded(!isActivityExpanded)}
                className="p-3 border-b border-slate-100 bg-[#F8FAFC] flex justify-between items-center cursor-pointer lg:cursor-default"
              >
                <h2 className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  <span>Лента активности (Live)</span>
                </h2>
                <div className="lg:hidden">
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isActivityExpanded ? 'rotate-90' : ''}`} />
                </div>
              </div>
              <div className={`${isActivityExpanded ? 'block' : 'hidden lg:block'} flex-1 overflow-y-auto p-3 space-y-3 font-mono max-h-[220px] lg:max-h-none`}>
                {roomState?.history && roomState.history.length > 0 ? (
                  roomState.history.map((ev) => renderHistoryItem(ev))
                ) : (
                  <div className="text-center py-6 text-slate-400 italic text-[11px] font-sans">
                    Нет последних действий. Нажмите "Отметиться" выше.
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </main>

      {/* Bottom Controls / Quick Action Footer (Only if connected) */}
      {roomId && roomState && (
        <footer className="bg-white border-t border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-lg">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">
              Быстрый репорт местоположения
            </span>
            <div className="flex sm:flex-wrap gap-1.5 justify-start overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              {roomState.spots.slice(0, 4).map((spot) => {
                const isThere = roomState.presence.some(p => p.userId === userId && p.spotId === spot.id);
                return (
                  <button
                    key={spot.id}
                    onClick={() => handleTogglePresence(spot.id)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded transition-all uppercase whitespace-nowrap shrink-0 ${
                      isThere 
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {isThere ? `Покинуть: ${spot.name}` : `Я в: ${spot.name}`}
                  </button>
                );
              })}
              {currentUserSpot && (
                <button
                  onClick={() => handleTogglePresence(currentUserSpot.id)}
                  className="px-3 py-1.5 border border-slate-300 text-rose-600 text-[11px] font-bold rounded hover:bg-rose-50 whitespace-nowrap shrink-0"
                >
                  Сняться<span className="hidden xs:inline"> со всех точек</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0">
            <div className="text-left sm:text-right">
              <p className="text-[10px] text-slate-400">Автосинхронизация включена</p>
              <p className="text-xs font-mono text-slate-600 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isSyncing ? 'animate-ping' : ''}`}></span>
                <span>Синхронизация через: <strong>{countdown}с</strong></span>
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={syncData}
                disabled={isSyncing}
                className="p-2.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                title="Принудительная синхронизация"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleLeaveRoom}
                className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-full hover:bg-rose-100 transition-colors"
                title="Выйти из этой группы"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Small informative baseline footer */}
      {!roomId && (
        <footer className="bg-white border-t border-slate-100 py-3.5 text-center text-[11px] text-slate-400 font-mono">
          © 2026 GeoSync Collective • Синхронизация через api.npoint.io • Развертывание в реальном времени
        </footer>
      )}

      {/* Group Selection Overlay */}
      {(showGroupSelector || !selectedGroup) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Выбор вашей группы</span>
                </h2>
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  Выберите группу, от имени которой вы будете отмечаться на точках
                </p>
              </div>
              {selectedGroup && (
                <button 
                  onClick={() => setShowGroupSelector(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content - Grid of groups */}
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 gap-2.5 scrollbar-none">
              {AVAILABLE_GROUPS.map((group) => {
                const isSelected = selectedGroup === group;
                return (
                  <button
                    key={group}
                    onClick={() => handleSelectGroup(group)}
                    className={`py-3.5 px-3 rounded-xl text-xs font-black tracking-tight transition-all duration-200 uppercase text-center flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-[14px]">👥</span>
                    <span>{group}</span>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[9px] text-slate-400 font-medium font-mono shrink-0">
              {selectedGroup && selectedGroup !== 'Группа не выбрана' ? `Текущий выбор: ${selectedGroup}` : 'Необходимо выбрать группу для продолжения'}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
