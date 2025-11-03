export interface Patient {
  id: number;
  name: string;
  hn?: string;
  doctors?: string[];
  status: 'waiting' | 'in-progress' | 'completed' | 'cancelled';
  timestamp: number;
  startTime?: number;
  endTime?: number;
  note?: string;
  firebaseId?: string;
}