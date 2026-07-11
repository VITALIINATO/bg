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
  'Г1',
  'Ю3',
  'П4',
  'В5',
  'Л6',
  'С7',
  'В8',
  'С13',
  'Т15',
  'В18',
  'С19',
  'АДМИН',
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
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(true);
  const [selectedSpotToCheckIn, setSelectedSpotToCheckIn] = useState<string>('');

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

      // Filter out any presence entries for 'Наблюдатель' and 'АДМИН' to ensure they are never checked in anywhere
      let updatedPresence = Array.isArray(data.presence) ? [...data.presence] : [];
      const beforeFilterLength = updatedPresence.length;
      updatedPresence = updatedPresence.filter((p) => p.userName !== 'Наблюдатель' && p.userName !== 'АДМИН');
      
      const isObserverOrAdmin = currentSelectedGroup === 'Наблюдатель' || currentUserName === 'Наблюдатель' || safeSessionStorage.getItem('coloc_selected_group') === 'Наблюдатель' ||
                               currentSelectedGroup === 'АДМИН' || currentUserName === 'АДМИН' || safeSessionStorage.getItem('coloc_selected_group') === 'АДМИН';
      if (isObserverOrAdmin) {
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
    if (selectedGroup === 'Наблюдатель' || selectedGroup === 'АДМИН') {
      // Admin and Observer cannot check in, and warning is removed (simply nothing happens)
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
    if (ev.userName === 'АДМИН' || ev.userName === 'Наблюдатель') return null;
    const date = new Date(ev.timestamp);
    const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isCurrentUser = ev.userId === userId;
    const isCheckIn = ev.type === 'check-in';

    // Different color markers based on action type
    const borderClass = isCheckIn 
      ? 'border-l-[3px] border-[#2D5A27] bg-[#E2F0D9]/10' 
      : 'border-l-[3px] border-stone-400 bg-stone-50/10';

    return (
      <div
        key={ev.id}
        className={`${borderClass} pl-3 py-1.5 transition-all text-[11px] hover:bg-[#EAECE1]/30 rounded-r`}
      >
        <div className="flex items-center justify-between text-stone-400 text-[10px] font-mono">
          <span className="font-bold">{timeFormatted}</span>
          {isCurrentUser && <span className="text-[9px] font-mono bg-[#485638] text-[#E6E8D2] px-1 rounded uppercase font-black">Вы</span>}
        </div>
        <p className="mt-0.5 text-[#2D3524] leading-tight">
          <strong className="text-[#1C1F15] font-black uppercase font-mono">{ev.userName}</strong>{' '}
          {isCheckIn ? (
            <span>
              прибыл на <span className="text-[#2D5A27] font-black uppercase">{ev.spotName}</span>
            </span>
          ) : (
            <span>
              снялся с <span className="text-stone-500 font-black uppercase">{ev.spotName}</span>
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
    .filter(p => p.userName !== 'АДМИН' && p.userName !== 'Наблюдатель')
    .map(p => ({
      id: p.userId,
      name: p.userName
    }))
    .filter((user, index, self) =>
      user.id && self.findIndex(u => u.id === user.id) === index
    );

  return (
    <div className="w-full min-h-screen bg-[#E1E4D5] flex flex-col font-sans text-[#2D3325] overflow-x-hidden">
      
      {/* Top Navigation / Header */}
      <header className="h-14 bg-[#232B1B] border-b-2 border-[#3E4A34] text-[#E6E8D2] flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-md">
        <div 
          onClick={syncData}
          className="flex items-center gap-2.5 sm:gap-4 cursor-pointer hover:opacity-95 active:scale-95 transition-all duration-150 group"
          title="Синхронизировать сейчас"
        >
          <div className="bg-[#485638] border border-[#5B6D47] p-1.5 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-[#5B6D47] transition-colors shadow-inner">
            <Compass className={`w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#E6E8D2] animate-pulse ${isSyncing ? 'animate-spin' : 'animate-spin-slow'}`} />
          </div>
          <div>
            <h1 className="text-[11px] sm:text-sm font-black tracking-widest uppercase flex items-center gap-2 text-[#E6E8D2]">
              <span>BG-NOW</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-[#A3B899] font-mono hidden xs:block tracking-wide">
              {roomId ? `SECTOR: ${roomId}` : 'SECTOR: OFFLINE'}
            </p>
          </div>
        </div>



        <div className="flex items-center gap-2 sm:gap-3">
          {roomId && (
            <button
              onClick={() => setShowGroupSelector(true)}
              className="text-right flex flex-col justify-center cursor-pointer hover:bg-[#3E4A34]/60 px-2.5 py-1 rounded-lg border border-[#3E4A34] transition-all text-[#E6E8D2] bg-[#232B1B]/60 text-left hover:border-[#E6E8D2]/30"
            >
              <div className="flex flex-col">
                <p className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase leading-tight flex items-center gap-1.5">
                  <span>{userName}</span>
                  <Settings className="w-2.5 h-2.5 text-[#A3B899] shrink-0 animate-spin-slow" />
                </p>
                <p className="text-[8px] sm:text-[10px] text-[#A3E635] font-black font-mono leading-tight uppercase">
                  {currentUserSpot ? `ПОЗИЦИЯ: ${currentUserSpot.name}` : 'ВНЕ ПОЗИЦИИ'}
                </p>
              </div>
            </button>
          )}

          <div 
            onClick={() => setShowGroupSelector(true)}
            className={`w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg bg-[#485638] border border-[#5B6D47] flex items-center justify-center text-xs font-black text-[#E6E8D2] cursor-pointer hover:bg-[#5B6D47] hover:text-white transition-all shrink-0 ${
              currentUserSpot ? 'ring-2 ring-[#A3E635] ring-offset-1 ring-offset-[#232B1B]' : ''
            }`}
            title="Нажмите для выбора группы"
          >
            {userName && userName.startsWith('Группа ') ? userName.replace('Группа ', '') : userName ? userName.substring(0, 2) : 'G'}
          </div>
        </div>
      </header>

      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="bg-[#D97706] text-white px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-md shrink-0 border-b border-[#B45309]">
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">⚠️</span>
            <span>Вы работаете в локальном (автономном) режиме. Данные будут синхронизированы при восстановлении связи с сервером.</span>
          </div>
          <button 
            onClick={syncData}
            disabled={isSyncing}
            className="px-3 py-1 bg-[#232B1B] text-[#E6E8D2] hover:bg-[#3E4A34] rounded-lg hover:text-white transition-all shrink-0 font-bold active:scale-95 disabled:opacity-50 text-xs cursor-pointer border border-[#3E4A34]"
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
            <aside className="w-full lg:w-64 order-3 lg:order-1 bg-[#FAFBF7] border-2 border-[#3E4A34]/30 rounded-xl flex flex-col shrink-0 shadow-md overflow-hidden transition-all duration-300">
              <div 
                onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
                className="p-3 border-b border-[#3E4A34]/20 bg-[#3E4A34] text-[#E6E8D2] flex justify-between items-center shrink-0 cursor-pointer lg:cursor-default"
              >
                <h2 className="text-[11px] font-black uppercase text-[#E6E8D2] tracking-widest flex items-center gap-1.5 font-sans">
                  <Users className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Участники Группы ({activeParticipants.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-[#485638] text-[#E6E8D2] text-[9px] font-bold rounded uppercase border border-[#3E4A34]/40 font-mono">
                    {activeParticipants.length} ON-SITE
                  </span>
                  <div className="lg:hidden">
                    <ChevronRight className={`w-3.5 h-3.5 text-[#A3B899] transition-transform duration-200 ${isParticipantsExpanded ? 'rotate-90' : ''}`} />
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
                          className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
                            userSpot 
                              ? isMe 
                                ? 'bg-[#E2F0D9] border border-[#2D5A27]/40 text-[#1C3E18] font-bold shadow-xs'
                                : 'bg-[#EAECE1] border border-[#3E4A34]/20 text-[#2D3524]'
                              : 'hover:bg-[#EAECE1]/40 border border-transparent text-stone-500 font-medium'
                          }`}
                        >
                          <span className="truncate flex items-center gap-1.5 font-mono">
                            <span className={`w-1.5 h-1.5 rounded-full ${userSpot ? 'bg-[#2D5A27] animate-pulse' : 'bg-stone-300'}`}></span>
                            <span className="truncate">{user.name} {isMe && '(Вы)'}</span>
                          </span>
                          {userSpot ? (
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                              isMe 
                                ? 'bg-[#2D5A27] text-white border-[#1C3E18]' 
                                : 'bg-[#485638] text-[#E6E8D2] border-[#3E4A34]'
                            } truncate max-w-[90px]`}>
                              {userSpot.name}
                            </span>
                          ) : (
                            <span className="text-[9px] text-stone-400 font-mono font-bold tracking-wider">OFF-SITE</span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-stone-400 italic text-center py-4 font-mono uppercase tracking-wide">Список пуст (все off-site)</p>
                  )}
                </div>

                {/* Compact Database Sync Status */}
                <div className="p-3 border-t border-[#3E4A34]/20 bg-[#EAECE1]/40 shrink-0 text-[10px]">
                  <p className="text-[#3E4A34] leading-normal font-black text-center flex items-center justify-center gap-1.5 font-mono tracking-wider">
                    <Database className="w-3.5 h-3.5 text-[#2D5A27] animate-pulse" />
                    <span>ОБЩАЯ СЕССИЯ АКТИВНА</span>
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
                    
                    {/* ТАКТИЧЕСКИЙ ПУЛЬТ ОТМЕТОК */}
                    <div className="bg-[#FAFBF7] border-2 border-[#3E4A34]/40 rounded-xl p-4 shadow-md">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#3E4A34]/20">
                        <div className="flex items-center gap-1.5 text-[#2D3524] font-black text-xs uppercase tracking-wider">
                          <Compass className="w-4 h-4 text-[#F59E0B] animate-pulse" />
                          <span>ОТМЕТКА НА ПОЗИЦИИ</span>
                        </div>
                        {currentUserSpot && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#2D5A27] bg-[#E2F0D9] border border-[#2D5A27]/25 px-2 py-0.5 rounded-md uppercase font-mono">
                              📍 {currentUserSpot.name}
                            </span>
                            <button
                              onClick={() => handleTogglePresence(currentUserSpot.id)}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white border border-red-700 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer font-mono"
                            >
                              СНЯТЬСЯ
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                        <div className="flex-1 flex gap-2">
                          <select
                            value={selectedSpotToCheckIn}
                            onChange={(e) => setSelectedSpotToCheckIn(e.target.value)}
                            className="bg-[#FAFBF7] border-2 border-[#3E4A34]/30 hover:border-[#3E4A34]/50 rounded-lg px-3 py-2 text-xs font-bold text-[#3E4A34] focus:border-[#2D5A27] focus:ring-1 focus:ring-[#2D5A27] outline-none flex-1 font-mono uppercase transition-colors"
                          >
                            <option value="">-- ВЫБЕРИТЕ ГЕОТОЧКУ --</option>
                            {(roomState?.spots || []).map(spot => (
                              <option key={spot.id} value={spot.id}>
                                {spot.name} {spot.description ? `(${spot.description})` : ''}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => setIsAddingSpot(!isAddingSpot)}
                            className={`p-2 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer shrink-0 ${
                              isAddingSpot 
                                ? 'bg-amber-500 border-amber-600 text-slate-950' 
                                : 'bg-[#3E4A34] hover:bg-[#485638] text-[#E6E8D2] border-[#2D3524]'
                            }`}
                            title="Добавить новую геоточку"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            if (!selectedSpotToCheckIn) {
                              alert('Пожалуйста, выберите геоточку из списка.');
                              return;
                            }
                            handleTogglePresence(selectedSpotToCheckIn);
                          }}
                          className="px-4 py-2 bg-[#2D5A27] hover:bg-[#1C3E18] text-white rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-150 shadow-sm border border-[#1C3E18] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4 text-[#A3E635]" />
                          <span>ПОДТВЕРДИТЬ</span>
                        </button>
                      </div>

                      {isAddingSpot && (
                        <div className="mt-4 pt-4 border-t border-[#3E4A34]/15">
                          <AddSpotForm
                            onAddSpot={async (name, description) => {
                              await handleAddCustomSpot(name, description);
                              setIsAddingSpot(false);
                            }}
                            onCancel={() => {
                              setIsAddingSpot(false);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* ГРИД ДЛЯ ЗАНЯТЫХ ТОЧЕК */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      {roomState?.spots && roomState.spots.length > 0 ? (
                        (() => {
                          const occupiedSpots = [...roomState.spots]
                            .filter(spot => {
                              const usersAtSpot = roomState.presence.filter(p => p.spotId === spot.id && p.userName !== 'АДМИН' && p.userName !== 'Наблюдатель');
                              return usersAtSpot.length > 0;
                            })
                            .sort((a, b) => {
                              // "ППД" always first
                              if (a.name === 'ППД' && b.name !== 'ППД') return -1;
                              if (b.name === 'ППД' && a.name !== 'ППД') return 1;

                              // Sort numerically if names are numbers
                              const aNum = parseInt(a.name, 10);
                              const bNum = parseInt(b.name, 10);
                              if (!isNaN(aNum) && !isNaN(bNum)) {
                                return aNum - bNum;
                              }
                              // Fallback to alphabetical sorting
                              return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                            });

                          if (occupiedSpots.length === 0) {
                            return (
                              <div className="col-span-3 text-center py-10 bg-[#FAFBF7] border-2 border-dashed border-[#3E4A34]/20 rounded-xl shadow-xs w-full">
                                <MapPin className="w-8 h-8 text-stone-300 mx-auto mb-2 animate-bounce" />
                                <h4 className="text-xs font-black text-[#3E4A34] uppercase tracking-wider">Все группы вне позиций (off-site)</h4>
                                <p className="text-[10px] text-stone-500 font-medium mt-1 font-sans">Выберите геоточку на пульте выше и подтвердите отметку.</p>
                              </div>
                            );
                          }

                          return occupiedSpots.map((spot) => {
                            const usersAtSpot = roomState.presence.filter(p => p.spotId === spot.id && p.userName !== 'АДМИН' && p.userName !== 'Наблюдатель');
                            const isCurrentUserThere = usersAtSpot.some(u => u.userName === selectedGroup || u.userId === userId);
                            const isSelected = selectedSpotId === spot.id;
                            const isPPD = spot.name === 'ППД';
                            const hasUsers = usersAtSpot.length > 0;

                            // Tactical styles
                            let cardStyle = '';
                            if (isPPD) {
                              if (hasUsers) {
                                cardStyle = 'border-[3px] border-[#D97706] bg-[#F59E0B] text-stone-950 shadow-lg font-black tracking-wider';
                              } else {
                                cardStyle = 'border-2 border-dashed border-[#485638]/40 bg-[#FAFBF7]/85 hover:bg-[#FAFBF7] text-[#3E4A34]';
                              }
                            } else {
                              cardStyle = isCurrentUserThere
                                ? 'border-[3px] border-[#2D5A27] bg-[#E2F0D9] shadow-lg ring-2 ring-[#2D5A27]/20 text-[#1C3E18] font-bold'
                                : hasUsers
                                ? 'border-[3px] border-[#D97706] bg-[#FEF3C7] shadow-lg animate-pulse-subtle text-[#78350F] font-bold'
                                : isSelected
                                ? 'border-[3px] border-[#485638] bg-[#FAFBF7] shadow-md ring-2 ring-[#485638]/10 text-[#2D3524]'
                                : 'border-2 border-[#485638]/20 bg-[#FAFBF7]/90 hover:border-[#485638]/40 hover:bg-white text-[#3E4A34]';
                            }

                            // Horizontal card for ППД
                            if (isPPD) {
                              return (
                                <div
                                  key={spot.id}
                                  onClick={() => handleTogglePresence(spot.id)}
                                  className={`${cardStyle} col-span-3 min-h-[45px] sm:min-h-[55px] rounded-lg sm:rounded-xl px-3 py-1.5 shadow-xs flex flex-row items-center justify-between gap-4 relative transition-all duration-200 cursor-pointer group hover:shadow-md`}
                                >
                                  {/* Title and editing */}
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

                                  {/* List of active groups at ППД */}
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

                            // Normal cards
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
                                                ? 'bg-[#2D5A27] text-white border-[#1C3E18]'
                                                : 'bg-[#485638] text-[#E6E8D2] border-[#3E4A34]'
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
                          });
                        })()
                      ) : (
                        <div className="col-span-full bg-[#FAFBF7] border-2 border-dashed border-[#3E4A34]/20 rounded-xl p-8 text-center text-stone-400">
                          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <h4 className="text-sm font-bold text-slate-700">Нет геоточек</h4>
                          <p className="text-xs text-slate-400 mt-1">Добавьте первую точку, чтобы начать!</p>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            </section>

            {/* COLUMN 3: Right Side Activity Stream */}
            <aside className={`w-full ${isHistoryExpanded ? 'lg:w-72' : 'lg:w-14'} order-2 lg:order-3 mt-12 lg:mt-0 bg-[#FAFBF7] border-2 border-[#3E4A34]/30 rounded-xl flex flex-col shrink-0 shadow-md overflow-hidden transition-all duration-300`}>
              <div 
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                className="p-3 border-b border-[#3E4A34]/20 bg-[#3E4A34] flex justify-between items-center cursor-pointer select-none"
                title={isHistoryExpanded ? "Свернуть" : "Развернуть"}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-[#F59E0B] animate-pulse shrink-0" />
                  {isHistoryExpanded && (
                    <span className="text-[11px] font-black uppercase text-[#E6E8D2] tracking-widest truncate font-sans">
                      ЛЕНТА АКТИВНОСТИ (Live)
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {isHistoryExpanded && selectedGroup && (
                    <div className="flex items-center gap-1">
                      {showClearConfirm ? (
                        <>
                          <button
                            onClick={handleClearActivity}
                            className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[9px] font-bold uppercase hover:bg-red-700 transition-colors cursor-pointer font-mono"
                          >
                            Да
                          </button>
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-1.5 py-0.5 bg-[#485638] text-[#E6E8D2] rounded text-[9px] font-bold uppercase hover:bg-[#5B6D47] transition-colors cursor-pointer font-mono"
                          >
                            Нет
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          className="px-2 py-1 bg-[#232B1B] text-[#E6E8D2] hover:bg-[#D97706] hover:text-white border border-[#3E4A34]/60 rounded-md text-[9px] font-black uppercase transition-all duration-150 flex items-center gap-1 active:scale-95 cursor-pointer font-mono"
                          title="Очистить историю"
                        >
                          <Trash2 className="w-3 h-3 text-[#F59E0B]" />
                          <span>Очистить</span>
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHistoryExpanded(!isHistoryExpanded);
                    }}
                    className="p-1 hover:bg-[#485638] rounded text-[#E6E8D2] transition-colors cursor-pointer"
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isHistoryExpanded ? 'rotate-90 lg:rotate-180' : 'rotate-0'}`} />
                  </button>
                </div>
              </div>
              {isHistoryExpanded && (
                <div className="block flex-1 overflow-y-auto p-3 space-y-3 font-mono max-h-[300px] lg:max-h-none">
                  {roomState?.history && roomState.history.filter((ev) => ev.type === 'check-in').length > 0 ? (
                    roomState.history.filter((ev) => ev.type === 'check-in').map((ev) => renderHistoryItem(ev))
                  ) : (
                    <div className="text-center py-6 text-slate-400 italic text-[11px] font-sans">
                      Нет последних действий. Нажмите "Отметиться" выше.
                    </div>
                  )}
                </div>
              )}
            </aside>
          </>
        )}
      </main>



      {/* Group Selection Overlay */}
      {(showGroupSelector || !selectedGroup) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#232B1B]/85 backdrop-blur-md">
          <div className="bg-[#FAFBF7] rounded-xl w-full max-w-md border-2 border-[#3E4A34] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 border-b border-[#3E4A34]/20 bg-[#3E4A34] text-[#E6E8D2] flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 font-sans text-[#E6E8D2]">
                  <Users className="w-4 h-4 text-[#F59E0B]" />
                  <span>ВЫБОР ВАШЕЙ ГРУППЫ</span>
                </h2>
                <p className="text-[10px] text-[#A3B899] font-semibold mt-1">
                  Выберите группу, от имени которой вы будете отмечаться на точках
                </p>
              </div>
              {selectedGroup && (
                <button 
                  onClick={() => setShowGroupSelector(false)}
                  className="p-1.5 text-[#A3B899] hover:text-[#E6E8D2] hover:bg-[#485638] rounded-lg transition-colors cursor-pointer"
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
                      className="flex-1 py-2 bg-[#EAECE1] hover:bg-[#FAFBF7] text-[#3E4A34] border border-[#3E4A34]/20 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Назад
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-[#3E4A34] hover:bg-[#485638] text-[#E6E8D2] hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs border border-[#2D3524]"
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
                          ? 'bg-[#2D5A27] text-white border-[#1C3E18] shadow-md scale-[1.02]'
                          : 'bg-[#EAECE1]/50 hover:bg-[#EAECE1] text-[#3E4A34] border-[#3E4A34]/25 hover:border-[#3E4A34]/45'
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
            <div className="p-4 bg-[#EAECE1]/60 border-t border-[#3E4A34]/20 text-center text-[9px] text-[#3E4A34] font-black font-mono shrink-0 uppercase tracking-wider">
              {selectedGroup && selectedGroup !== 'Группа не выбрана' ? `Текущий выбор: ${selectedGroup}` : 'Необходимо выбрать группу для продолжения'}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
