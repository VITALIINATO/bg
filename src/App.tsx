// 📌 НАСТРОЙКА КАРТОЧЕК МЕСТ (НАЗВАНИЙ ТОЧЕК):
// Чтобы изменить названия мест, отредактируйте массив DEFAULT_SPOTS в файле /src/lib/api.ts !

import React, { useState, useEffect, useRef } from 'react';
import { Spot, UserPresence, RoomState, HistoryEvent, ActiveUser } from './types';
import {
  createRoom,
  fetchRoomState,
  updateRoomState,
  DEFAULT_SPOTS,
  createInitialState,
  translateGroupName
} from './lib/api';
import { safeSessionStorage, safeLocalStorage } from './lib/storage';
import AddSpotForm from './components/AddSpotForm';
import {
  MapPin,
  Users,
  RefreshCw,
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
  Database,
  Lock,
  Pencil,
  Check
} from 'lucide-react';

// Help functions to generate random IDs
const generateId = (length: number = 8): string => {
  return Math.random().toString(36).substring(2, 2 + length);
};

const AVAILABLE_GROUPS = [
  'АДМИН',
  'Г1',
  'Ю3',
  'П4',
  'В5',
  'Л6',
  'С7',
  'В8',
  'К9',
  'С13',
  'В18',
  'С19',
  'Т15',
  'Наблюдатель'
];

const getGroupPassword = (groupName: string): string => {
  if (groupName === 'Наблюдатель') return '999999999';
  if (groupName === 'АДМИН') return '!2№4';

  const passwords: Record<string, string> = {
    'Г1': '7#qA',
    'Ю3': 'K2!v',
    'П4': 'z&4M',
    'В5': '8*Rt',
    'Л6': 'Y5%c',
    'С7': '^H1w',
    'В8': 'm9(L',
    'К9': 'G6)d',
    'С13': '7y_E',
    'В18': 'F8&g',
    'С19': 'W?1b',
    'Т15': 'Q4!x',
  };

  return passwords[groupName] || '00000000';
};

export default function App() {
  // --- User State ---
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [tempName, setTempName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showGroupSelector, setShowGroupSelector] = useState<boolean>(false);

  // --- Password States for Group Selection ---
  const [pendingGroup, setPendingGroup] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // --- Spot Editing States ---
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const [editingSpotName, setEditingSpotName] = useState<string>('');

  // --- Room & Connection State ---
  const [roomId, setRoomId] = useState<string>('d5590d7a9d5aeceb4195');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // --- Spot Addition State ---
  const [isAddingSpot, setIsAddingSpot] = useState<boolean>(false);
  
  // --- UI Interactivity State ---
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards'); // Default view switcher for High Density layout
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState<boolean>(false);
  const [isActivityExpanded, setIsActivityExpanded] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // --- Refs ---
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeLoadTokenRef = useRef<number>(0);

  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);
  const selectedGroupRef = useRef(selectedGroup);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { userNameRef.current = userName; }, [userName]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);

  // 1. Initialize user from safeSessionStorage or generate new
  useEffect(() => {
    document.title = 'КТО ГДЕ КОГДА';
    let savedUserId = safeSessionStorage.getItem('coloc_userid');
    const rawSavedGroup = safeSessionStorage.getItem('coloc_selected_group');
    const savedGroup = rawSavedGroup ? translateGroupName(rawSavedGroup) : null;
    if (savedGroup) {
      safeSessionStorage.setItem('coloc_selected_group', savedGroup);
    }

    if (!savedUserId) {
      savedUserId = 'u-' + generateId();
      safeSessionStorage.setItem('coloc_userid', savedUserId);
    }
    setUserId(savedUserId);

    if (savedGroup && AVAILABLE_GROUPS.includes(savedGroup)) {
      setSelectedGroup(savedGroup);
      setUserName(savedGroup);
      setTempName(savedGroup);
      safeSessionStorage.setItem('coloc_username', savedGroup);
    } else {
      // If no valid group is selected, force show the group selector on load
      setShowGroupSelector(true);
      setUserName('Группа не выбрана');
      setTempName('Группа не выбрана');
    }

    // Always keep unified session room ID
    setRoomId('d5590d7a9d5aeceb4195');
  }, []);

  // 3. Load room state whenever roomId, userId, or userName changes
  useEffect(() => {
    if (roomId) {
      loadRoomData(roomId, true);
    }
  }, [roomId, userId, userName]);

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
  }, [roomId, userId, userName, selectedGroup]);

  const startTimers = () => {
    stopTimers();
    setCountdown(3);

    // Countdown timer (runs every second)
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger sync when countdown hits 0
          syncData();
          return 3;
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
    const token = ++activeLoadTokenRef.current;
    if (showSpinner) setIsLoading(true);
    setError(null);
    
    const currentUserId = userIdRef.current || userId;
    const currentUserName = userNameRef.current || userName;
    const currentSelectedGroup = selectedGroupRef.current || selectedGroup;

    try {
      const data = await fetchRoomState(targetRoomId, currentUserId, currentUserName);
      if (token !== activeLoadTokenRef.current) {
        return; // Discard stale background loaded data
      }
      setIsOffline(data.isOffline || false);
      
      // Ensure all default spots exist in the loaded data (healing old data structures)
      let updatedSpots = data.spots.map(spot => {
        if (!spot) return spot;
        // Migrate old names of default spots to their new counterparts if they were not custom renamed
        if (spot.id === 'spot-1' && spot.name === 'ЦУМ') return { ...spot, name: '1', description: 'Геоточка 1' };
        if (spot.id === 'spot-2' && spot.name === 'Вокзал') return { ...spot, name: '2', description: 'Геоточка 2' };
        if (spot.id === 'spot-3' && spot.name === 'Парк') return { ...spot, name: '3', description: 'Геоточка 3' };
        if (spot.id === 'spot-4' && spot.name === 'Площадь') return { ...spot, name: '4', description: 'Геоточка 4' };
        if (spot.id === 'spot-5' && spot.name === 'Кинотеатр') return { ...spot, name: '5', description: 'Геоточка 5' };
        return spot;
      }).filter(Boolean);

      DEFAULT_SPOTS.forEach((defaultSpot) => {
        const exists = updatedSpots.some(s => s && s.id === defaultSpot.id);
        if (!exists) {
          updatedSpots.push(defaultSpot);
        }
      });

      // Filter out any presence entries for 'Наблюдатель' to ensure observers are never checked in anywhere
      let updatedPresence = Array.isArray(data.presence) ? [...data.presence] : [];
      const beforeFilterLength = updatedPresence.length;
      updatedPresence = updatedPresence.filter((p) => p.userName !== 'Наблюдатель');
      
      const isObserver = currentSelectedGroup === 'Наблюдатель' || currentUserName === 'Наблюдатель' || safeSessionStorage.getItem('coloc_selected_group') === 'Наблюдатель';
      if (isObserver) {
        updatedPresence = updatedPresence.filter((p) => p.userId !== currentUserId);
      }

      const nextState = { ...data, spots: updatedSpots, presence: updatedPresence };
      setRoomState(nextState);

      // Save healed spots or cleaned presence back to server silently ONLY if they actually changed.
      // Crucial: We do not trigger automatic updateRoomState just because of heartbeat changes (_hasHeartbeatChange)
      // during normal background loads, preventing active users from overwriting each other's check-ins.
      const spotsChanged = JSON.stringify(data.spots) !== JSON.stringify(updatedSpots);
      const presenceChanged = beforeFilterLength !== updatedPresence.length || JSON.stringify(data.presence) !== JSON.stringify(updatedPresence);

      if (spotsChanged || presenceChanged) {
        if (token === activeLoadTokenRef.current) {
          await updateRoomState(targetRoomId, nextState);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (token === activeLoadTokenRef.current) {
        setIsOffline(true);
        if (showSpinner) {
          setError('Не удалось загрузить данные группы. Пожалуйста, проверьте интернет-соединение.');
        } else {
          console.warn('Background sync failed silently. Will retry on next interval.');
        }
      }
    } finally {
      if (token === activeLoadTokenRef.current) {
        if (showSpinner) setIsLoading(false);
      }
    }
  };

  // Handle Nickname Update
  const handleSaveName = async () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    
    setUserName(trimmed);
    safeSessionStorage.setItem('coloc_username', trimmed);
    setIsEditingName(false);

    // If already in a room, synchronize the name change
    if (roomId && roomState) {
      activeLoadTokenRef.current++;
      setIsSaving(true);
      try {
        const freshState = await fetchRoomState(roomId, userId, userName);

        let updatedUsers = Array.isArray(freshState.users) ? [...freshState.users] : [];
        const hasUser = updatedUsers.some((u) => u.id === userId);
        if (hasUser) {
          updatedUsers = updatedUsers.map((u) =>
            u.id === userId ? { ...u, name: trimmed, lastActive: new Date().toISOString() } : u
          );
        } else {
          updatedUsers.push({
            id: userId,
            name: trimmed,
            lastActive: new Date().toISOString()
          });
        }

        // Also update the presence list names
        const updatedPresence = (Array.isArray(freshState.presence) ? freshState.presence : []).map((p) =>
          p.userId === userId ? { ...p, userName: trimmed } : p
        );

        const nextState = {
          ...freshState,
          users: updatedUsers,
          presence: updatedPresence
        };

        await updateRoomState(roomId, nextState);
        setRoomState(nextState);
      } catch (err) {
        console.error('Failed to update nickname in room:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Select group handler - sets pending group for password check
  const handleSelectGroup = (groupName: string) => {
    setPendingGroup(groupName);
    setPasswordInput('');
    setPasswordError(null);
  };

  const handleConfirmPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingGroup) return;

    const correctPassword = getGroupPassword(pendingGroup);
    if (passwordInput === correctPassword) {
      const groupName = pendingGroup;
      setSelectedGroup(groupName);
      setUserName(groupName);
      setTempName(groupName);
      safeSessionStorage.setItem('coloc_selected_group', groupName);
      safeSessionStorage.setItem('coloc_username', groupName);
      setShowGroupSelector(false);
      setPendingGroup(null);
      setPasswordInput('');
      setPasswordError(null);

      // If already in a room, synchronize the name change
      if (roomId && roomState) {
        activeLoadTokenRef.current++;
        setIsSaving(true);
        try {
          const freshState = await fetchRoomState(roomId, userId, userName);

          let updatedUsers = Array.isArray(freshState.users) ? [...freshState.users] : [];
          const hasUser = updatedUsers.some((u) => u.id === userId);
          if (hasUser) {
            updatedUsers = updatedUsers.map((u) =>
              u.id === userId ? { ...u, name: groupName, lastActive: new Date().toISOString() } : u
            );
          } else {
            updatedUsers.push({
              id: userId,
              name: groupName,
              lastActive: new Date().toISOString()
            });
          }

          // Also update the presence list names
          let updatedPresence = (Array.isArray(freshState.presence) ? freshState.presence : []).map((p) =>
            p.userId === userId ? { ...p, userName: groupName } : p
          );

          if (groupName === 'Наблюдатель') {
            updatedPresence = updatedPresence.filter((p) => p.userId !== userId);
          }

          const nextState = {
            ...freshState,
            users: updatedUsers,
            presence: updatedPresence
          };

          await updateRoomState(roomId, nextState);
          setRoomState(nextState);
        } catch (err) {
          console.error('Failed to update group name in room:', err);
        } finally {
          setIsSaving(false);
        }
      }
    } else {
      setPasswordError('Неверный пароль. Попробуйте еще раз.');
    }
  };

  // Leave current room / group
  const handleLeaveRoom = () => {
    setSelectedGroup(null);
    safeSessionStorage.removeItem('coloc_selected_group');
    setShowGroupSelector(true);
  };

  // CHECK-IN / CHECK-OUT Core Logic
  const handleTogglePresence = async (spotId: string) => {
    if (selectedGroup === 'Наблюдатель') {
      alert('Режим наблюдателя: у вас нет возможности отмечаться на геоточках.');
      return;
    }
    if (!roomId || !roomState) return;

    activeLoadTokenRef.current++;
    setIsSaving(true);
    stopTimers(); // pause polling during transaction
    
    try {
      // Re-fetch latest state to prevent race conditions as much as possible
      const freshState = await fetchRoomState(roomId, userId, userName);
      
      const spot = freshState.spots.find((s) => s.id === spotId);
      if (!spot) throw new Error('Геоточка не найдена.');

      // Check if the CURRENT group is already checked in at this spot
      const isCurrentGroupAtThisSpot = freshState.presence.some(
        (p) => (p.userName === selectedGroup || p.userId === userId) && p.spotId === spotId
      );

      let nextPresence = [...freshState.presence];
      let nextHistory = [...freshState.history];

      // Format event details
      const nowString = new Date().toISOString();

      if (isCurrentGroupAtThisSpot) {
        // --- REMOVE CURRENT GROUP FROM THIS SPOT (Check out) ---
        nextPresence = nextPresence.filter(
          (p) => !(p.userName === selectedGroup || p.userId === userId)
        );
        
        // Log check-out event for history
        const checkOutEvent: HistoryEvent = {
          id: 'ev-' + generateId(),
          userId,
          userName: selectedGroup || userName,
          spotId,
          spotName: spot.name,
          type: 'check-out',
          timestamp: nowString
        };
        nextHistory = [checkOutEvent, ...nextHistory].slice(0, 150);
      } else {
        // --- CHECK IN CURRENT GROUP ON THIS SPOT ---
        // A group can only be at ONE spot at a time. If they are somewhere else, automatically check them out first!
        const existingPresences = nextPresence.filter(
          (p) => p.userName === selectedGroup || p.userId === userId
        );
        
        for (const prev of existingPresences) {
          const prevSpot = freshState.spots.find((s) => s.id === prev.spotId);
          const checkOutEvent: HistoryEvent = {
            id: 'ev-' + generateId(),
            userId,
            userName: selectedGroup || userName,
            spotId: prev.spotId,
            spotName: prevSpot ? prevSpot.name : 'Предыдущая точка',
            type: 'check-out',
            timestamp: nowString
          };
          nextHistory = [checkOutEvent, ...nextHistory];
        }

        // Remove previous presence entirely for the current group
        nextPresence = nextPresence.filter(
          (p) => !(p.userName === selectedGroup || p.userId === userId)
        );

        // Add new check-in presence for the current group
        nextPresence.push({
          userId,
          userName: selectedGroup || userName,
          spotId,
          timestamp: nowString
        });

        // Add check-in event
        const checkInEvent: HistoryEvent = {
          id: 'ev-' + generateId(),
          userId,
          userName: selectedGroup || userName,
          spotId,
          spotName: spot.name,
          type: 'check-in',
          timestamp: nowString
        };
        nextHistory = [checkInEvent, ...nextHistory].slice(0, 150);
      }

      // Build updated state
      let nextUsers = Array.isArray(freshState.users) ? [...freshState.users] : [];
      const hasUser = nextUsers.some((u) => u.id === userId);
      if (hasUser) {
        nextUsers = nextUsers.map((u) =>
          u.id === userId ? { ...u, name: selectedGroup || userName, lastActive: nowString } : u
        );
      } else {
        nextUsers.push({
          id: userId,
          name: selectedGroup || userName,
          lastActive: nowString
        });
      }

      const nextState: RoomState = {
        ...freshState,
        presence: nextPresence,
        history: nextHistory,
        users: nextUsers
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
  const handleAddCustomSpot = async (name: string, description: string) => {
    if (!isAdmin) {
      alert('Добавлять геоточки может только АДМИН.');
      return;
    }
    if (!roomId || !roomState) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Название геоточки не может быть пустым.');
      return;
    }

    activeLoadTokenRef.current++;
    setIsSaving(true);
    stopTimers();

    try {
      const freshState = await fetchRoomState(roomId, userId, userName);
      
      const nameExists = freshState.spots.some(
        (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (nameExists) {
        alert(`Геоточка с названием "${trimmedName}" уже существует.`);
        return;
      }

      const newSpot: Spot = {
        id: 'spot-' + generateId(),
        name: trimmedName,
        description
      };

      const nextState: RoomState = {
        ...freshState,
        spots: [...freshState.spots, newSpot]
      };

      await updateRoomState(roomId, nextState);
      setRoomState(nextState);
      setIsAddingSpot(false);
      setSelectedSpotId(newSpot.id); // select newly created spot
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить новую геоточку. Попробуйте еще раз.');
    } finally {
      setIsSaving(false);
      startTimers();
    }
  };

  // Edit / Save spot name
  const handleSaveSpotName = async (spotId: string) => {
    if (!isAdmin) {
      alert('Редактировать геоточки может только АДМИН.');
      return;
    }
    if (!roomId || !roomState) return;
    const trimmed = editingSpotName.trim();
    if (!trimmed) return;

    activeLoadTokenRef.current++;
    setIsSaving(true);
    stopTimers();

    try {
      const freshState = await fetchRoomState(roomId, userId, userName);
      
      const nameExists = freshState.spots.some(
        (s) => s.id !== spotId && s.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (nameExists) {
        alert(`Геоточка с названием "${trimmed}" уже существует.`);
        return;
      }

      const updatedSpots = freshState.spots.map((spot) =>
        spot.id === spotId ? { ...spot, name: trimmed } : spot
      );

      const nextState: RoomState = {
        ...freshState,
        spots: updatedSpots
      };

      await updateRoomState(roomId, nextState);
      setRoomState(nextState);
      setEditingSpotId(null);
    } catch (err) {
      console.error('Failed to update spot name:', err);
      alert('Не удалось изменить название геоточки.');
    } finally {
      setIsSaving(false);
      startTimers();
    }
  };

  // Delete a custom spot
  const handleDeleteSpot = async (spotId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent selecting the spot when clicking delete
    
    if (!isAdmin) {
      alert('Удалять геоточки может только АДМИН.');
      return;
    }

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

    activeLoadTokenRef.current++;
    setIsSaving(true);
    stopTimers();

    try {
      const freshState = await fetchRoomState(roomId, userId, userName);
      
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

  const handleClearActivity = async () => {
    if (!roomId || !roomState) return;
    activeLoadTokenRef.current++;
    setIsSaving(true);
    setShowClearConfirm(false);
    try {
      const freshState = await fetchRoomState(roomId, userId, userName);
      const nextState: RoomState = {
        ...freshState,
        history: []
      };
      await updateRoomState(roomId, nextState);
      setRoomState(nextState);
    } catch (err) {
      console.warn('Failed to clear activity:', err);
    } finally {
      setIsSaving(false);
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
    if (ev.type !== 'check-in') return null;
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
  const currentUserPresence = roomState?.presence.find(p => p.userName === selectedGroup || p.userId === userId);
  const currentUserSpot = currentUserPresence 
    ? roomState?.spots.find(s => s.id === currentUserPresence.spotId)
    : null;

  const isAdmin = selectedGroup === 'АДМИН';

  const activeParticipants = (roomState?.presence || [])
    .map(p => ({
      id: p.userId,
      name: p.userName
    }))
    .filter((user, index, self) =>
      user.id && self.findIndex(u => u.id === user.id) === index
    );

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 overflow-x-hidden">
      
      {/* Top Navigation / Header */}
      <header className="h-14 bg-[#1E293B] text-white flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-md">
        <div 
          onClick={syncData}
          className="flex items-center gap-2.5 sm:gap-4 cursor-pointer hover:opacity-95 active:scale-95 transition-all duration-150 group"
          title="Синхронизировать сейчас"
        >
          <div className="bg-blue-500 p-1.5 rounded flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors">
            <Compass className={`w-4.5 h-4.5 sm:w-5 sm:h-5 text-white ${isSyncing ? 'animate-spin' : 'animate-spin-slow'}`} />
          </div>
          <div>
            <h1 className="text-[11px] sm:text-sm font-black tracking-wider uppercase flex items-center gap-2">
              <span>BG-now</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono hidden xs:block">
              {roomId ? `ID: ${roomId}` : 'ID: inactive'}
            </p>
          </div>
        </div>



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

      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">⚠️</span>
            <span>Вы работаете в локальном (автономном) режиме. Данные будут синхронизированы при восстановлении связи с сервером.</span>
          </div>
          <button 
            onClick={syncData}
            disabled={isSyncing}
            className="px-3 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 font-bold active:scale-95 disabled:opacity-50 text-xs cursor-pointer"
          >
            {isSyncing ? 'Подключение...' : 'Подключиться'}
          </button>
        </div>
      )}

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

        {isLoading && !roomState ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 w-full">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Загрузка данных...</p>
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
                  <span>Участники Группы ({activeParticipants.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase">
                    {activeParticipants.length} на месте
                  </span>
                  <div className="lg:hidden">
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isParticipantsExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </div>
              
              <div className={`${isParticipantsExpanded ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'} flex-1`}>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[220px] lg:max-h-none">
                  {activeParticipants.length > 0 ? (
                    activeParticipants.map((user) => {
                      const userPresence = roomState?.presence.find(p => p.userId === user.id);
                      const userSpot = userPresence ? roomState?.spots.find(s => s.id === userPresence.spotId) : null;
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
                    <p className="text-xs text-slate-400 italic text-center py-4">Список пуст (все off-site)</p>
                  )}
                </div>

                {/* Compact Database Sync Status */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 shrink-0 text-[10px]">
                  <p className="text-slate-500 leading-normal font-semibold text-center flex items-center justify-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    <span>Общая сессия активна</span>
                  </p>
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
                          }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      {roomState?.spots && roomState.spots.length > 0 ? (
                        [...roomState.spots]
                          .sort((a, b) => {
                            // "ППД" always first
                            if (a.name === 'ППД' && b.name !== 'ППД') return -1;
                            if (b.name === 'ППД' && a.name !== 'ППД') return 1;
                            
                            // Then by occupancy (occupied first)
                            const aOccupied = roomState.presence.some(p => p.spotId === a.id);
                            const bOccupied = roomState.presence.some(p => p.spotId === b.id);
                            if (aOccupied && !bOccupied) return -1;
                            if (!aOccupied && bOccupied) return 1;

                            // Sort numerically if names are numbers
                            const aNum = parseInt(a.name, 10);
                            const bNum = parseInt(b.name, 10);
                            if (!isNaN(aNum) && !isNaN(bNum)) {
                              return aNum - bNum;
                            }
                            // Fallback to alphabetical sorting
                            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                          })
                          .map((spot) => {
                            const usersAtSpot = roomState.presence.filter(p => p.spotId === spot.id);
                            const isCurrentUserThere = usersAtSpot.some(u => u.userName === selectedGroup || u.userId === userId);
                            const isSelected = selectedSpotId === spot.id;
                            const isPPD = spot.name === 'ППД';
                            const hasUsers = usersAtSpot.length > 0;

                            // ⚡️ Dynamic card styling with maximum visual contrast as requested!
                            let cardStyle = '';
                            if (isPPD) {
                              if (hasUsers) {
                                cardStyle = 'border-2 border-yellow-500 bg-yellow-400 text-slate-950 shadow-md font-black';
                              } else {
                                cardStyle = 'border border-slate-200 bg-slate-50/50 hover:bg-white text-slate-800';
                              }
                            } else {
                              cardStyle = isCurrentUserThere
                                ? 'border-2 border-emerald-600 bg-emerald-50 shadow-md ring-2 ring-emerald-500/10'
                                : hasUsers
                                ? 'border-2 border-amber-500 bg-amber-50 shadow-md animate-pulse-subtle'
                                : isSelected
                                ? 'border-2 border-blue-500 bg-white shadow-sm'
                                : 'border border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-white';
                            }

                            // 🏠 Layout 1: Special horizontal card for "ППД" (3 columns, half height, static yellow)
                            if (isPPD) {
                              return (
                                <div
                                  key={spot.id}
                                  onClick={() => handleTogglePresence(spot.id)}
                                  className={`${cardStyle} col-span-3 min-h-[45px] sm:min-h-[55px] rounded-lg sm:rounded-xl px-3 py-1.5 shadow-xs flex flex-row items-center justify-between gap-4 relative transition-all duration-200 cursor-pointer group hover:shadow-md`}
                                >
                                  {/* Left side: title and admin editing */}
                                  <div className="flex items-center gap-2 min-w-0" onClick={(e) => { if (editingSpotId === spot.id) e.stopPropagation(); }}>
                                    {editingSpotId === spot.id ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={editingSpotName}
                                          onChange={(e) => setEditingSpotName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.stopPropagation();
                                              handleSaveSpotName(spot.id);
                                            }
                                          }}
                                          className="px-1.5 py-0.5 text-xs border border-yellow-600 bg-white text-slate-900 rounded focus:ring-1 focus:ring-yellow-500 font-bold uppercase w-28"
                                          autoFocus
                                        />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleSaveSpotName(spot.id); }}
                                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setEditingSpotId(null); }}
                                          className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight flex items-center gap-1 leading-none text-slate-950 truncate">
                                          <span>🏠</span>
                                          <span className="truncate">{spot.name}</span>
                                        </h3>
                                        {isAdmin && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingSpotId(spot.id);
                                              setEditingSpotName(spot.name);
                                            }}
                                            className="p-1 bg-black/5 hover:bg-black/10 text-slate-700 rounded transition-all shrink-0"
                                            title="Редактировать название"
                                          >
                                            <Pencil className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Center: List of groups/users currently at ППД */}
                                  <div className="flex-1 flex items-center justify-end gap-2 px-2 min-w-0">
                                    {hasUsers && (
                                      <div className="flex flex-wrap gap-1 items-center justify-end min-w-0 overflow-hidden">
                                        {usersAtSpot.map((presenceUser) => {
                                          const isCurrent = presenceUser.userName === selectedGroup || presenceUser.userId === userId;
                                          return (
                                            <span
                                              key={presenceUser.userId}
                                              className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase border shadow-xs truncate max-w-[80px] sm:max-w-[120px] ${
                                                isCurrent
                                                  ? 'bg-slate-950 text-white border-slate-900'
                                                  : 'bg-slate-800 text-white border-slate-900'
                                              }`}
                                              title={presenceUser.userName}
                                            >
                                              {presenceUser.userName} {isCurrent && '👤'}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // 📍 Layout 2: Normal 3-column bento card for other locations (half height, title maximally visible)
                            return (
                              <div
                                key={spot.id}
                                onClick={() => handleTogglePresence(spot.id)}
                                className={`${cardStyle} rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 shadow-xs flex flex-col justify-between relative transition-all duration-200 cursor-pointer group hover:shadow-md min-h-[55px] sm:min-h-[70px]`}
                              >
                                <div className="w-full relative">
                                  {editingSpotId === spot.id ? (
                                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="text"
                                        value={editingSpotName}
                                        onChange={(e) => setEditingSpotName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.stopPropagation();
                                            handleSaveSpotName(spot.id);
                                          }
                                        }}
                                        className="px-1.5 py-0.5 text-xs border border-blue-500 bg-white text-slate-900 rounded focus:ring-1 focus:ring-blue-500 font-bold uppercase w-full"
                                        autoFocus
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleSaveSpotName(spot.id); }}
                                        className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setEditingSpotId(null); }}
                                        className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <h3 className="text-center w-full text-[11px] sm:text-xs md:text-sm font-black text-slate-950 uppercase tracking-tight break-all leading-tight">
                                        {spot.name}
                                      </h3>
                                      {isAdmin && (
                                        <div className="absolute -right-1 -top-1 flex items-center gap-0.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingSpotId(spot.id);
                                              setEditingSpotName(spot.name);
                                            }}
                                            className="p-0.5 bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 rounded border border-slate-200/60 shadow-xs"
                                            title="Редактировать"
                                          >
                                            <Pencil className="w-2.5 h-2.5" />
                                          </button>
                                          <button
                                            onClick={(e) => handleDeleteSpot(spot.id, e)}
                                            className="p-0.5 bg-rose-50/95 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded border border-rose-200/40 shadow-xs"
                                            title="Удалить"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Travelers List or status - ultra compact */}
                                <div className="flex-1 flex items-center justify-center min-h-[14px] sm:min-h-[18px] my-1">
                                  {usersAtSpot.length > 0 ? (
                                    <div className="flex flex-wrap gap-0.5 items-center justify-center max-w-full">
                                        {usersAtSpot.map((presenceUser) => {
                                          const isCurrent = presenceUser.userName === selectedGroup || presenceUser.userId === userId;
                                          return (
                                            <span
                                              key={presenceUser.userId}
                                              className={`px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black text-center uppercase tracking-tight shadow-xs border truncate max-w-[55px] sm:max-w-[80px] ${
                                                isCurrent
                                                  ? 'bg-emerald-600 text-white border-emerald-700'
                                                  : 'bg-blue-600 text-white border-blue-700'
                                              }`}
                                              title={presenceUser.userName}
                                            >
                                              {presenceUser.userName}
                                            </span>
                                          );
                                        })}
                                    </div>
                                  ) : (
                                    <span className="text-[7px] sm:text-[8px] font-black text-slate-300 uppercase tracking-tight">Никого</span>
                                  )}
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

                    {!isAddingSpot && isAdmin && (
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
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider truncate">Лента активности (Live)</span>
                </div>
                
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      {showClearConfirm ? (
                        <>
                          <button
                            onClick={handleClearActivity}
                            className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[9px] font-bold uppercase hover:bg-red-700 transition-colors cursor-pointer"
                          >
                            Да
                          </button>
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold uppercase hover:bg-slate-300 transition-colors cursor-pointer"
                          >
                            Нет
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded text-[9px] font-bold uppercase transition-all duration-150 flex items-center gap-1 active:scale-95 cursor-pointer"
                          title="Очистить историю"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Очистить</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="lg:hidden" onClick={() => setIsActivityExpanded(!isActivityExpanded)}>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isActivityExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </div>
              <div className={`${isActivityExpanded ? 'block' : 'hidden lg:block'} flex-1 overflow-y-auto p-3 space-y-3 font-mono max-h-[220px] lg:max-h-none`}>
                {roomState?.history && roomState.history.filter((ev) => ev.type === 'check-in').length > 0 ? (
                  roomState.history.filter((ev) => ev.type === 'check-in').map((ev) => renderHistoryItem(ev))
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

            {/* Content */}
            {pendingGroup ? (
              /* Password verification sub-screen */
              <div className="p-6 flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Вход в {pendingGroup}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Для продолжения необходимо ввести пароль этой группы
                  </p>
                </div>

                <form onSubmit={handleConfirmPassword} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="Введите пароль"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError(null);
                      }}
                      className="w-full px-3 py-2.5 text-center text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono tracking-widest placeholder:tracking-normal placeholder:text-slate-400"
                    />
                    {passwordError && (
                      <p className="text-[10px] text-rose-500 font-semibold mt-1.5 text-center">
                        ⚠️ {passwordError}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingGroup(null);
                        setPasswordInput('');
                        setPasswordError(null);
                      }}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Назад
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      Войти
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Content - Grid of groups */
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
                      <span className="text-[14px]">{group === 'Наблюдатель' ? '👁️' : '👥'}</span>
                      <span>{group}</span>
                    </button>
                  );
                })}
              </div>
            )}

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
