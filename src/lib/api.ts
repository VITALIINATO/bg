import { RoomState } from '../types';
import { safeLocalStorage } from './storage';

const BASE_URL = 'https://api.npoint.io';

export function translateGroupName(name: string): string {
  if (!name) return name;
  const trimmed = name.trim();
  
  const dict: Record<string, string> = {
    'Группа 1': 'Г1',
    'Группа 3': 'Ю3',
    'Группа 4': 'П4',
    'Группа 5': 'В5',
    'Группа 6': 'Л6',
    'Группа 7': 'С7',
    'Группа 8': 'В8',
    'Группа 13': 'С13',
    'Группа 14': 'С19',
    'Группа 15': 'Т15',
    'Группа 18': 'В18',
    'Группа 19': 'С19',
    'Группа Г1': 'Г1',
    'Группа Ю3': 'Ю3',
    'Группа П4': 'П4',
    'Группа В5': 'В5',
    'Группа Л6': 'Л6',
    'Группа С7': 'С7',
    'Группа В8': 'В8',
    'Группа С13': 'С13',
    'Группа Т15': 'Т15',
    'Группа В18': 'В18',
    'Группа С19': 'С19',
  };

  if (dict[trimmed]) return dict[trimmed];

  // Try numerical extract
  const numMatch = trimmed.match(/\d+/);
  if (numMatch) {
    const num = numMatch[0];
    if (num === '1') return 'Г1';
    if (num === '3') return 'Ю3';
    if (num === '4') return 'П4';
    if (num === '5') return 'В5';
    if (num === '6') return 'Л6';
    if (num === '7') return 'С7';
    if (num === '8') return 'В8';
    if (num === '13') return 'С13';
    if (num === '15') return 'Т15';
    if (num === '18') return 'В18';
    if (num === '19') return 'С19';
  }

  return name;
}

// Default initial state for a newly created room without x,y coordinates
export const DEFAULT_SPOTS = [
  { id: 'spot-ppd', name: 'ППД', description: 'Пункт постоянной дислокации' },
  { id: 'spot-1', name: '1', description: 'Геоточка 1' },
  { id: 'spot-2', name: '2', description: 'Геоточка 2' },
  { id: 'spot-3', name: '3', description: 'Геоточка 3' },
  { id: 'spot-4', name: '4', description: 'Геоточка 4' },
  { id: 'spot-5', name: '5', description: 'Геоточка 5' },
  { id: 'spot-6', name: '6', description: 'Геоточка 6' },
  { id: 'spot-7', name: '7', description: 'Геоточка 7' },
  { id: 'spot-8', name: '8', description: 'Геоточка 8' },
  { id: 'spot-9', name: '9', description: 'Геоточка 9' },
  { id: 'spot-10', name: '10', description: 'Геоточка 10' },
  { id: 'spot-11', name: '11', description: 'Геоточка 11' },
  { id: 'spot-12', name: '12', description: 'Геоточка 12' }
];

export const createInitialState = (roomName: string): RoomState => ({
  roomName: roomName || 'Общая группа',
  spots: [...DEFAULT_SPOTS],
  users: [],
  presence: [],
  history: []
});

/**
 * Creates a new JSON bin - fallback to hardcoded ID since npoint.io root creation is restricted
 */
export async function createRoom(roomName: string): Promise<string> {
  return 'd5590d7a9d5aeceb4195';
}

/**
 * Reads the room state from npoint.io with robust localStorage fallback and client-side heartbeat
 */
export async function fetchRoomState(binId: string, userId?: string, userName?: string): Promise<RoomState> {
  try {
    const url = `${BASE_URL}/${binId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch room state: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    // Support either direct root format or nested "contents" format
    const content = data?.contents ? data.contents : data;

    let loadedSpots = Array.isArray(content?.spots) ? content.spots : [...DEFAULT_SPOTS];
    
    // Heal/migrate spot names
    let updatedSpots = loadedSpots.map((spot: any) => {
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
      const exists = updatedSpots.some((s: any) => s && s.id === defaultSpot.id);
      if (!exists) {
        updatedSpots.push(defaultSpot);
      }
    });

    const rawUsers = Array.isArray(content?.users) ? content.users : [];
    const mappedUsers = rawUsers.map((u: any) => u ? { ...u, name: translateGroupName(u.name) } : u).filter(Boolean);

    const rawPresence = Array.isArray(content?.presence) ? content.presence : [];
    const mappedPresence = rawPresence.map((p: any) => p ? { ...p, userName: translateGroupName(p.userName) } : p).filter(Boolean);

    const rawHistory = Array.isArray(content?.history) ? content.history : [];
    const mappedHistory = rawHistory.map((ev: any) => ev ? { ...ev, userName: translateGroupName(ev.userName) } : ev).filter(Boolean);

    const parsed: RoomState = {
      roomName: content?.roomName || 'Общая группа',
      spots: updatedSpots,
      users: mappedUsers,
      presence: mappedPresence,
      history: mappedHistory,
      isOffline: false
    };

    // Client-side user heartbeat (replacing Express server logic)
    if (userId && userName) {
      let stateChanged = false;
      const nowString = new Date().toISOString();
      const userIndex = parsed.users.findIndex((u: any) => u.id === userId);

      if (userIndex >= 0) {
        const lastActiveTime = new Date(parsed.users[userIndex].lastActive).getTime();
        const nowTime = new Date(nowString).getTime();
        // Only write back heartbeat if name changed or if it has been more than 20 seconds
        if (parsed.users[userIndex].name !== userName || isNaN(lastActiveTime) || nowTime - lastActiveTime > 20000) {
          parsed.users[userIndex] = {
            ...parsed.users[userIndex],
            name: userName,
            lastActive: nowString
          };
          stateChanged = true;
        }
      } else {
        parsed.users.push({
          id: userId,
          name: userName,
          lastActive: nowString
        });
        stateChanged = true;
      }

      // Clean users who have been inactive for more than 48 hours
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const beforeFilterLength = parsed.users.length;
      parsed.users = parsed.users.filter((u: any) => {
        const lastActiveTime = new Date(u.lastActive).getTime();
        return !isNaN(lastActiveTime) && lastActiveTime > cutoff.getTime();
      });

      if (parsed.users.length !== beforeFilterLength) {
        stateChanged = true;
      }

      // Mark that there is a heartbeat change so the caller can save it in its consolidated write
      if (stateChanged) {
        (parsed as any)._hasHeartbeatChange = true;
      }
    }

    // Store a backup in localStorage for offline/static deployment recovery
    try {
      safeLocalStorage.setItem(`coloc_room_state_${binId}`, JSON.stringify(parsed));
    } catch (e) {
      console.warn('Failed to save room state backup to localStorage:', e);
    }

    return parsed;
  } catch (error) {
    console.error(`Error fetching room state for bin ${binId}, trying localStorage backup:`, error);
    
    // Attempt local storage fallback
    try {
      const saved = safeLocalStorage.getItem(`coloc_room_state_${binId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawUsers = Array.isArray(parsed.users) ? parsed.users : [];
        const mappedUsers = rawUsers.map((u: any) => u ? { ...u, name: translateGroupName(u.name) } : u).filter(Boolean);

        const rawPresence = Array.isArray(parsed.presence) ? parsed.presence : [];
        const mappedPresence = rawPresence.map((p: any) => p ? { ...p, userName: translateGroupName(p.userName) } : p).filter(Boolean);

        const rawHistory = Array.isArray(parsed.history) ? parsed.history : [];
        const mappedHistory = rawHistory.map((ev: any) => ev ? { ...ev, userName: translateGroupName(ev.userName) } : ev).filter(Boolean);

        return {
          roomName: parsed.roomName || 'Общая группа',
          spots: Array.isArray(parsed.spots) ? parsed.spots : [...DEFAULT_SPOTS],
          users: mappedUsers,
          presence: mappedPresence,
          history: mappedHistory,
          isOffline: true
        };
      }
    } catch (e) {
      console.error('Failed to load room state from localStorage:', e);
    }

    // Ultimate fallback if no local storage found
    console.warn(`No localStorage backup found for ${binId}, creating fresh initial state locally.`);
    const fallback = createInitialState('Общая группа');
    fallback.isOffline = true;
    return fallback;
  }
}

/**
 * Overwrites/updates the room state on npoint.io with localStorage backup
 */
export async function updateRoomState(binId: string, state: RoomState): Promise<boolean> {
  // Create a clean copy without internal/temporary fields
  const cleanState = { ...state };
  for (const key in cleanState) {
    if (key.startsWith('_')) {
      delete (cleanState as any)[key];
    }
  }

  // First, always save to local storage as backup
  try {
    safeLocalStorage.setItem(`coloc_room_state_${binId}`, JSON.stringify(cleanState));
  } catch (e) {
    console.warn('Failed to save room state backup to localStorage:', e);
  }

  try {
    const response = await fetch(`${BASE_URL}/${binId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cleanState),
    });

    if (!response.ok) {
      throw new Error(`Failed to update room state: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`Error updating room state for bin ${binId}, relying on localStorage backup:`, error);
    // Return true even if network fails so the app continues operating offline/locally
    return true;
  }
}
