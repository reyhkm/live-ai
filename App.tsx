
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, Sender, AiStatus, GeminiServerMessage } from './types';
import { LiveAiService } from './services/liveAiService';
import useBrowserAudioRecorder from './hooks/useBrowserAudioRecorder';
import useAudioPlayer from './hooks/useAudioPlayer';
import ConversationArea from './components/ConversationArea';
import Controls from './components/Controls';
import { FunctionCall, FunctionResponse } from '@google/genai';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus>(AiStatus.Idle);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const liveAiServiceRef = useRef<LiveAiService | null>(null);
  const currentAiMessageIdRef = useRef<string | null>(null);
  
  const addMessage = useCallback((sender: Sender, text: string, idOverride?: string): string => {
    const messageId = idOverride || Date.now().toString();
    const newMessage: ChatMessage = { id: messageId, sender, text, timestamp: new Date() };
    setMessages(prev => [...prev, newMessage]);
    return messageId;
  }, []);

  const { isPlaying: isAiSpeaking, addAudioChunkToQueue, playQueuedAudio, stopPlayback: stopAiPlayback } = useAudioPlayer({
    onPlaybackStateChange: (playing) => {
      if (playing) {
        setAiStatus(AiStatus.Speaking);
      }
    },
    isMuted: isMuted,
  });

  const stopRecordingAndSession = useCallback(() => { 
    if (liveAiServiceRef.current?.isConnected()) {
        liveAiServiceRef.current?.closeSession(); // This will now also clear the session handle in the service
    }
    stopAiPlayback(); 
    setAiStatus(AiStatus.Idle);
    currentAiMessageIdRef.current = null;
  }, [stopAiPlayback]);


  const handleAiServiceCallbacks = useCallback(() => {
    return {
      onOpen: () => {
        console.log("Live AI session opened for Barista Bot.");
        setAiStatus(AiStatus.Listening);
        addMessage(Sender.System, "Percakapan dimulai. Arum sedang mendengarkan.");
      },
      onMessage: (message: GeminiServerMessage) => {
        // console.log("Raw ServerMessage:", JSON.stringify(message, null, 2));
      },
      onError: (error: Error) => {
        console.error("Live AI Error (Barista Bot):", error);
        setAiStatus(AiStatus.Error);
        // Check if message indicates an invalid or expired session handle attempt
        const errorMsg = error.message?.toLowerCase();
        if (errorMsg?.includes('session') && (errorMsg?.includes('invalid') || errorMsg?.includes('expired') || errorMsg?.includes('not found'))) {
             addMessage(Sender.System, `Error: Sesi sebelumnya tidak valid atau sudah berakhir. Memulai sesi baru.`);
        } else {
            addMessage(Sender.System, `Error: ${error.message}. Mohon periksa konsol atau pengaturan API key.`);
        }
        
        if (isRecordingRef.current) { 
          stopRecordingRef.current(); 
        }
        stopRecordingAndSession(); // This will call closeSession() in the service, clearing the handle
      },
      onClose: (event: CloseEvent) => {
        console.log("Live AI session closed (Barista Bot):", event.reason || "Tidak ada alasan diberikan", "Code:", event.code);
        if (aiStatus !== AiStatus.Error) { 
            setAiStatus(AiStatus.Idle);
        }
         // Avoid "Percakapan berakhir." if it was an abnormal closure that might be resumed,
         // or if an error already displayed a message.
        if (event.code === 1000 || event.code === 1005 ) { // Normal closure or no status
             addMessage(Sender.System, "Percakapan berakhir.");
        } else if (event.code !== 1006 && event.code !== 1001 && event.code !== 1002 && aiStatus !== AiStatus.Error){ // 1006 abnormal, 1001 going away
            addMessage(Sender.System, `Koneksi terputus (Code: ${event.code}). Anda mungkin bisa mencoba lagi untuk melanjutkan.`);
        }
        currentAiMessageIdRef.current = null;
      },
      onInputTranscription: (text: string) => {
        setCurrentTranscript(text); 
      },
      onOutputTranscription: (text: string) => {
        if (!currentAiMessageIdRef.current) {
          const newMsgId = `ai_${Date.now()}`;
          addMessage(Sender.AI, text, newMsgId);
          currentAiMessageIdRef.current = newMsgId;
        } else {
          setMessages(prev => prev.map(msg => 
            msg.id === currentAiMessageIdRef.current 
              ? { ...msg, text: msg.text + text } 
              : msg
          ));
        }
      },
      onAiAudioData: (base64Audio: string) => {
        addAudioChunkToQueue(base64Audio);
      },
      onToolCall: async (fc: FunctionCall): Promise<FunctionResponse> => { 
        setAiStatus(AiStatus.Processing);
        addMessage(Sender.System, `Arum memanggil fungsi: ${fc.name} dengan detail: ${JSON.stringify(fc.args)}`);
        const response = await LiveAiService.handleBaristaFunctionCall(fc);
        addMessage(Sender.System, `Fungsi ${fc.name} merespons: ${response.response.message || JSON.stringify(response.response)}`);
        return response;
      },
      onTurnComplete: async () => {
        console.log("AI (Arum) turn complete.");
        const waveformData = await playQueuedAudio();
        
        if (waveformData && currentAiMessageIdRef.current) {
          setMessages(prev => prev.map(msg => 
            msg.id === currentAiMessageIdRef.current 
              ? { ...msg, audioWaveformData: waveformData } 
              : msg
          ));
        }
        currentAiMessageIdRef.current = null; 

        if (liveAiServiceRef.current?.isConnected() && !isAiSpeaking && aiStatus !== AiStatus.Processing && aiStatus !== AiStatus.Error) {
             setAiStatus(AiStatus.Listening);
        }
        if (currentTranscript) { 
            addMessage(Sender.User, currentTranscript);
            setCurrentTranscript('');
        }
      },
      onInterrupted: () => {
        console.log("Ucapan Arum diinterupsi oleh pengguna.");
        stopAiPlayback(); 
        if (liveAiServiceRef.current?.isConnected() && aiStatus !== AiStatus.Error) {
            setAiStatus(AiStatus.Listening);
        }
        currentAiMessageIdRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage, addAudioChunkToQueue, playQueuedAudio, currentTranscript, stopAiPlayback, isAiSpeaking, aiStatus, stopRecordingAndSession]);


  useEffect(() => {
    const apiKey = process.env.API_KEY; 
    if (!apiKey) {
        console.warn("API key tidak ditemukan. Mohon atur variabel lingkungan API_KEY.");
        addMessage(Sender.System, "Peringatan: API Key tidak dikonfigurasi. Fitur AI tidak akan berfungsi.");
        setAiStatus(AiStatus.Error);
        return;
    }
    liveAiServiceRef.current = new LiveAiService(apiKey, handleAiServiceCallbacks());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const { isRecording, startRecording, stopRecording } = useBrowserAudioRecorder({
    onAudioData: (base64Audio) => {
      liveAiServiceRef.current?.sendAudioData(base64Audio);
    },
    onRecordingStateChange: (recording) => {
      if (!recording && liveAiServiceRef.current?.isConnected() && aiStatus !== AiStatus.Connecting && aiStatus !== AiStatus.Error) {
        liveAiServiceRef.current?.sendAudioStreamEnd(); 
        if(currentTranscript) { 
            addMessage(Sender.User, currentTranscript);
            setCurrentTranscript('');
        }
      }
    },
    onError: (errorMsg: string) => {
        addMessage(Sender.System, `Error Mikrofon: ${errorMsg}`);
        setAiStatus(AiStatus.Error);
    }
  });
  
  const isRecordingRef = useRef(isRecording);
  const stopRecordingRef = useRef(stopRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
    stopRecordingRef.current = stopRecording;
  }, [isRecording, stopRecording]);


  const handleToggleRecording = useCallback(async () => {
    if (!liveAiServiceRef.current || !process.env.API_KEY) { 
        addMessage(Sender.System, "Layanan AI tidak diinisialisasi. Periksa konfigurasi API Key.");
        setAiStatus(AiStatus.Error);
        return;
    }

    if (isRecording) {
      stopRecording(); 
      // Do not call stopRecordingAndSession() immediately here if we want to allow resumption.
      // Instead, sendAudioStreamEnd is handled by onRecordingStateChange.
      // The session should remain "open" on the service side if it's a pause.
      // If the user *really* wants to stop, the UI might need a different button or logic.
      // For now, "stop" on the button means stop recording audio input.
      // stopRecordingAndSession(); // Keep this if "stop" should always fully terminate.
      // Let's assume the current behavior is that "stop" fully stops the AI interaction.
       stopRecordingAndSession();
    } else {
      setMessages([]); 
      setCurrentTranscript('');
      currentAiMessageIdRef.current = null;
      setAiStatus(AiStatus.Connecting);
      try {
        await liveAiServiceRef.current.connect(); // connect will use stored handle if available
        await startRecording(); 
      } catch (error) {
        console.error("Gagal menghubungkan atau memulai rekaman:", error);
        setAiStatus(AiStatus.Error);
        addMessage(Sender.System, "Gagal memulai percakapan. Silakan coba lagi.");
        stopRecordingAndSession(); 
      }
    }
  }, [isRecording, startRecording, stopRecording, stopRecordingAndSession, addMessage]);

  const handleToggleMute = () => {
    setIsMuted(prev => !prev);
  };
  
  const displayedMessages = currentTranscript 
    ? [...messages, { id: 'live_transcript', sender: Sender.User, text: `${currentTranscript}... (merekam)`, timestamp: new Date() }]
    : messages;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-900 shadow-2xl">
      <header className="p-4 bg-gray-800 border-b border-gray-700 text-center">
        <h1 className="text-2xl font-bold text-sky-400">Reykal Coffee - AI Barista Arum</h1>
      </header>
      <ConversationArea messages={displayedMessages} />
      <Controls 
        aiStatus={aiStatus}
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />
    </div>
  );
};

export default App;
