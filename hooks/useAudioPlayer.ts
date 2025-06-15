import { useState, useCallback, useRef, useEffect } from 'react';
import { AUDIO_OUTPUT_SAMPLE_RATE } from '../constants';

interface UseAudioPlayerProps {
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  isMuted?: boolean;
}

const generateWaveformData = (audioData: Float32Array, numBars: number = 50): number[] => {
  if (!audioData || audioData.length === 0) {
    return [];
  }
  const waveform: number[] = [];
  const segmentLength = Math.floor(audioData.length / numBars);
  if (segmentLength === 0) return [0]; // Not enough data for many bars

  for (let i = 0; i < numBars; i++) {
    const start = i * segmentLength;
    const end = start + segmentLength;
    let peak = 0;
    for (let j = start; j < end; j++) {
      if (j < audioData.length) {
        const amp = Math.abs(audioData[j]);
        if (amp > peak) {
          peak = amp;
        }
      }
    }
    waveform.push(peak);
  }
  // Normalize waveform data (optional, but good for consistent visualization)
  const maxPeak = Math.max(...waveform, 0.00001); // avoid division by zero
  return waveform.map(peak => peak / maxPeak);
};


const useAudioPlayer = ({ onPlaybackStateChange, isMuted = false }: UseAudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]); // Queue of base64 audio chunks
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => { // Cleanup on unmount
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
          currentSourceRef.current.disconnect();
        } catch(e) { /* ignore */ }
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);
  
  useEffect(() => {
    if (currentSourceRef.current && audioContextRef.current) {
      if (isMuted) {
         if (currentSourceRef.current.context.state === 'running') { // Check if context is running
            currentSourceRef.current.disconnect();
        }
      } else {
         if (currentSourceRef.current.context.state === 'running') {
            currentSourceRef.current.connect(audioContextRef.current.destination);
        }
      }
    }
  }, [isMuted]);


  const playAudioFromBase64 = useCallback(async (base64AudioChunks: string[]): Promise<number[] | null> => {
    if (isMuted || base64AudioChunks.length === 0) {
      if (onPlaybackStateChange) onPlaybackStateChange(false);
      return null;
    }

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (currentSourceRef.current) {
        try {
            currentSourceRef.current.stop();
            currentSourceRef.current.disconnect();
        } catch (e) { /* Might throw if already stopped or not started */ }
        currentSourceRef.current = null;
    }

    setIsPlaying(true);
    if (onPlaybackStateChange) onPlaybackStateChange(true);

    let waveformData: number[] | null = null;

    try {
      let combinedInt16Array = new Int16Array(0);
      for (const base64Audio of base64AudioChunks) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const currentInt16Array = new Int16Array(bytes.buffer);
        
        const newCombined = new Int16Array(combinedInt16Array.length + currentInt16Array.length);
        newCombined.set(combinedInt16Array);
        newCombined.set(currentInt16Array, combinedInt16Array.length);
        combinedInt16Array = newCombined;
      }

      if (combinedInt16Array.length === 0) {
        setIsPlaying(false);
        if (onPlaybackStateChange) onPlaybackStateChange(false);
        return null;
      }

      const float32Array = new Float32Array(combinedInt16Array.length);
      for (let i = 0; i < combinedInt16Array.length; i++) {
        float32Array[i] = combinedInt16Array[i] / 32768.0; 
      }

      waveformData = generateWaveformData(float32Array);

      const audioBuffer = audioContextRef.current.createBuffer(
        1, 
        float32Array.length,
        AUDIO_OUTPUT_SAMPLE_RATE 
      );
      audioBuffer.copyToChannel(float32Array, 0);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      if (!isMuted) { 
        source.connect(audioContextRef.current.destination);
      }
      source.onended = () => {
        setIsPlaying(false);
        if (onPlaybackStateChange) onPlaybackStateChange(false);
        if (currentSourceRef.current === source) { 
            currentSourceRef.current = null;
        }
      };
      source.start();
      currentSourceRef.current = source;
      return waveformData;

    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      if (onPlaybackStateChange) onPlaybackStateChange(false);
      return null;
    }
  }, [onPlaybackStateChange, isMuted]);

  const addAudioChunkToQueue = (base64Audio: string) => {
    audioQueueRef.current.push(base64Audio);
  };

  const playQueuedAudio = useCallback(async (): Promise<number[] | null> => {
    if (audioQueueRef.current.length > 0) {
      const chunksToPlay = [...audioQueueRef.current];
      audioQueueRef.current = []; // Clear queue
      return playAudioFromBase64(chunksToPlay);
    }
    return null;
  }, [playAudioFromBase64]);
  
  const stopPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch(e) { /* ignore */ }
      currentSourceRef.current = null;
    }
    setIsPlaying(false);
    if (onPlaybackStateChange) onPlaybackStateChange(false);
    audioQueueRef.current = []; // Clear any pending audio
  }, [onPlaybackStateChange]);


  return { isPlaying, playAudioFromBase64, addAudioChunkToQueue, playQueuedAudio, stopPlayback };
};

export default useAudioPlayer;