
import { useState, useCallback, useRef, useEffect } from 'react';
import { AUDIO_INPUT_SAMPLE_RATE } from '../constants';

interface UseBrowserAudioRecorderProps {
  onAudioData: (base64Audio: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onError?: (error: string) => void;
  isAiSessionReady: boolean; // New prop
}

const useBrowserAudioRecorder = ({ onAudioData, onRecordingStateChange, onError, isAiSessionReady }: UseBrowserAudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const isAiSessionReadyRef = useRef(isAiSessionReady); // Ref for AI session readiness
  useEffect(() => {
    isAiSessionReadyRef.current = isAiSessionReady;
  }, [isAiSessionReady]);

  const float32ToInt16 = (buffer: Float32Array): Int16Array => {
    const int16Buffer = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Buffer;
  };

  const resampleBuffer = (inputBuffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array => {
    if (inputSampleRate === outputSampleRate) {
      return inputBuffer;
    }
    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.floor(inputBuffer.length / ratio);
    const outputBuffer = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const inputIndex = Math.floor(i * ratio);
      if (inputIndex < inputBuffer.length) {
         outputBuffer[i] = inputBuffer[inputIndex];
      }
    }
    return outputBuffer;
  };

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sourceSampleRate = audioContextRef.current.sampleRate;

      mediaStreamSourceNodeRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      
      const bufferSize = 4096; 
      scriptProcessorNodeRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

      scriptProcessorNodeRef.current.onaudioprocess = (event: AudioProcessingEvent) => {
        // Check both recording state and AI session readiness
        if (!isRecordingRef.current || !isAiSessionReadyRef.current) return; 

        const inputData = event.inputBuffer.getChannelData(0); 
        
        const resampledData = resampleBuffer(inputData, sourceSampleRate, AUDIO_INPUT_SAMPLE_RATE);

        const pcmData = float32ToInt16(resampledData);
        
        const uint8Array = new Uint8Array(pcmData.buffer);
        const base64Audio = btoa(String.fromCharCode(...uint8Array));
        
        onAudioData(base64Audio);
      };

      mediaStreamSourceNodeRef.current.connect(scriptProcessorNodeRef.current);
      scriptProcessorNodeRef.current.connect(audioContextRef.current.destination); 

      setIsRecording(true);
      // isRecordingRef.current is updated by its own useEffect
      if (onRecordingStateChange) onRecordingStateChange(true);

    } catch (err) {
      console.error("Error starting recording:", err);
      if (onError) onError("Failed to start recording. Please check microphone permissions.");
      setIsRecording(false);
      // isRecordingRef.current is updated by its own useEffect
      if (onRecordingStateChange) onRecordingStateChange(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAudioData, onRecordingStateChange, onError]); // isAiSessionReadyRef is managed by ref, not a direct dep of useCallback


  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current && !mediaStreamRef.current) return; // Use ref for current state

    // isRecordingRef.current will be set to false by its useEffect when setIsRecording(false) is called
    setIsRecording(false);
    if (onRecordingStateChange) onRecordingStateChange(false);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorNodeRef.current) {
      scriptProcessorNodeRef.current.disconnect();
      scriptProcessorNodeRef.current.onaudioprocess = null; 
      scriptProcessorNodeRef.current = null;
    }
    if (mediaStreamSourceNodeRef.current) {
      mediaStreamSourceNodeRef.current.disconnect();
      mediaStreamSourceNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
  }, [onRecordingStateChange]);

  return { isRecording, startRecording, stopRecording };
};

export default useBrowserAudioRecorder;
