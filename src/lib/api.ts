import { RoomState } from '../types';

const BASE_URL = 'https://api.npoint.io';

// Default initial state for a newly created room
export const DEFAULT_SPOTS = [
  { id: 'spot-ppd', name: 'ППД', description: 'Пункт постоянной дислокации', x: 50, y: 50 },
  { id: 'spot-1', name: 'ЦУМ', description: 'Центральный универсальный магазин (главный вход)', x: 35, y: 30 },
  { id: 'spot-2', name: 'Вокзал', description: 'Главный железнодорожный вокзал (у часов)', x: 70, y: 25 },
  { id: 'spot-3', name: 'Парк', description: 'Центральный городской парк (у фонтана)', x: 50, y: 70 },
  { id: 'spot-4', name: 'Площадь', description: 'Центральная площадь (возле памятника)', x: 25, y: 65 },
  { id: 'spot-5', name: 'Кинотеатр', description: 'Кинотеатр Октябрь (кассы)', x: 60, y: 45 }
];

export const createInitialState = (roomName: string): RoomState => ({
  roomName: roomName || 'Общая группа',
  spots: [...DEFAULT_SPOTS],
  users: [],
  presence: [],
  history: []
});

/**
 * Creates a new JSON bin on npoint.io
 */
export async function createRoom(roomName: string): Promise<string> {
  const initialState = createInitialState(roomName);
  try {
    const response = await fetch('https://www.npoint.io/documents', {
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
    throw new Error('No token returned from npoint.io');
  } catch (error) {
    console.error('Error creating room on npoint:', error);
    throw error;
  }
}

/**
 * Reads the room state from npoint.io
 */
export async function fetchRoomState(binId: string): Promise<RoomState> {
  try {
    const response = await fetch(`${BASE_URL}/${binId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch room state: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    // Ensure all required fields exist to prevent app crashes
    return {
      roomName: data.roomName || 'Группа',
      spots: Array.isArray(data.spots) ? data.spots : [...DEFAULT_SPOTS],
      users: Array.isArray(data.users) ? data.users : [],
      presence: Array.isArray(data.presence) ? data.presence : [],
      history: Array.isArray(data.history) ? data.history : []
    };
  } catch (error) {
    console.error(`Error fetching room state for bin ${binId}:`, error);
    throw error;
  }
}

/**
 * Overwrites/updates the room state on npoint.io
 */
export async function updateRoomState(binId: string, state: RoomState): Promise<boolean> {
  try {
    // We try PUT first which is standard for updating bins on npoint
    let response = await fetch(`${BASE_URL}/${binId}`, {
      method: 'POST', // Some npoint setups allow POST for overwrites too, but let's try POST then PUT if needed
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      // If POST didn't work for updating, try PUT (the standard update method)
      response = await fetch(`${BASE_URL}/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(state),
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to update room state: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`Error updating room state for bin ${binId}:`, error);
    throw error;
  }
}
