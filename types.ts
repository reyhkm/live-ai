import type { Live } from '@google/genai/dist/src/live/Live'; // For GeminiLiveSession type
import { LiveServerMessage } from '@google/genai'; // For GeminiServerMessage type

export enum Sender {
  User = 'user',
  AI = 'ai',
  System = 'system',
}

export interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  audioUrl?: string; // Optional: if we were to store/replay AI audio
  timestamp: Date;
  audioWaveformData?: number[]; // For AI message waveform visualization
}

export enum AiStatus {
  Idle = 'Idle',
  Connecting = 'Connecting...',
  Listening = 'Listening...',
  Processing = 'AI is thinking...',
  Speaking = 'AI is speaking...',
  Error = 'Error',
}

// Use the specific Live type from its module path
export type GeminiLiveSession = Live;
export type GeminiServerMessage = LiveServerMessage;

// Function call argument types for Barista AI
export interface SubmitOrderArgs {
  nama_pelanggan: string;
  pesanan: string;
  waktu_pemesanan: string;
}

export interface FunctionCallResponseData {
  status: 'success' | 'failure' | 'information';
  message?: string;
  data?: any;
  // Adding index signature to make it compatible with Record<string, unknown>
  [key: string]: unknown;
}