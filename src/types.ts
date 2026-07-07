export interface Spot {
  id: string;
  name: string;
  description?: string;
  x?: number; // Visual coordinates for the interactive 2D coordinate board (0 to 100 percent)
  y?: number;
}

export interface UserPresence {
  userId: string;
  userName: string;
  spotId: string;
  timestamp: string;
}

export interface ActiveUser {
  id: string;
  name: string;
  lastActive: string;
}

export interface HistoryEvent {
  id: string;
  userId: string;
  userName: string;
  spotId: string;
  spotName: string;
  type: 'check-in' | 'check-out';
  timestamp: string;
}

export interface RoomState {
  roomName: string;
  spots: Spot[];
  users: ActiveUser[];
  presence: UserPresence[];
  history: HistoryEvent[];
}
