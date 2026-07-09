import { RoomState } from '../types';
import { safeLocalStorage } from './storage';

const BASE_URL = '/api/rooms';

// Default initial state for a newly created room
export const DEFAULT_SPOTS = [
  { id: 'spot-ppd', name: 'ППД', description: 'Пункт постоянной дислокации', x: 50, y: 50 },
  { id: 'spot-1', name: '1', description: 'Геоточка 1', x: 20, y: 15 },
  { id: 'spot-2', name: '2', description: 'Геоточка 2', x: 50, y: 15 },
  { id: 'spot-3', name: '3', description: 'Геоточка 3', x: 80, y: 15 },
  { id: 'spot-4', name: '4', description: 'Геоточка 4', x: 20, y: 35 },
  { id: 'spot-5', name: '5', description: 'Геоточка 5', x: 80, y: 35 },
  { id: 'spot-6', name: '6', description: 'Геоточка 6', x: 20, y: 65 },
  { id: 'spot-7', name: '7', description: 'Геоточка 7', x: 80, y: 65 },
  { id: 'spot-8', name: '8', description: 'Геоточка 8', x: 20, y: 85 },
  { id: 'spot-9', name: '9', description: 'Геоточка 9', x: 50, y: 85 },
  { id: 'spot-10', name: '10', description: 'Геоточка 10', x: 80, y: 85 },
  { id: 'spot-11', name: '11', description: 'Геоточка 11', x: 35, y: 50 },
  { id: 'spot-12', name: '12', description: 'Геоточка 12', x: 65, y: 50 }
];

export const createInitialState = (roomName: string): RoomState => ({
  roomName: roomName || 'Общая группа',
  spots: [...DEFAULT_SPOTS],
  users: [],
  presence: [],
  history: []
});

/**
 * Creates a new JSON bin
 */
export async function createRoom(roomName: string): Promise<string> {
  const initialState = createInitialState(roomName);
  try {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: JSON.stringify(initialState)
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.token) {
      return data.token;
    }
    throw new Error('No token returned from server');
  } catch (error) {
    console.error('Error creating room on server:', error);
    throw error;
  }
}

/**
 * Reads the room state from server with robust localStorage fallback
 */
export async function fetchRoomState(binId: string, userId?: string, userName?: string): Promise<RoomState> {
  try {
    let url = `${BASE_URL}/${binId}`;
    if (userId && userName) {
      url += `?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch room state: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    const parsed: RoomState = {
      roomName: data.roomName || 'Группа',
      spots: Array.isArray(data.spots) ? data.spots : [...DEFAULT_SPOTS],
      users: Array.isArray(data.users) ? data.users : [],
      presence: Array.isArray(data.presence) ? data.presence : [],
      history: Array.isArray(data.history) ? data.history : []
    };

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
        return {
          roomName: parsed.roomName || 'Группа (Локальный режим)',
          spots: Array.isArray(parsed.spots) ? parsed.spots : [...DEFAULT_SPOTS],
          users: Array.isArray(parsed.users) ? parsed.users : [],
          presence: Array.isArray(parsed.presence) ? parsed.presence : [],
          history: Array.isArray(parsed.history) ? parsed.history : []
        };
      }
    } catch (e) {
      console.error('Failed to load room state from localStorage:', e);
    }

    // Ultimate fallback if no local storage found
    console.warn(`No localStorage backup found for ${binId}, creating fresh initial state locally.`);
    return createInitialState('Группа (Локальный режим)');
  }
}

/**
 * Overwrites/updates the room state on server with localStorage backup
 */
export async function updateRoomState(binId: string, state: RoomState): Promise<boolean> {
  // First, always save to local storage as backup
  try {
    safeLocalStorage.setItem(`coloc_room_state_${binId}`, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save room state backup to localStorage:', e);
  }

  try {
    let response = await fetch(`${BASE_URL}/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state),
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
