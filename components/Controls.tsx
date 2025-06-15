
import React from 'react';
import { AiStatus } from '../types';

interface ControlsProps {
  aiStatus: AiStatus;
  isRecording: boolean;
  onToggleRecording: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const MicrophoneIcon: React.FC<{isRecording: boolean, className?: string}> = ({ isRecording, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${className} w-8 h-8 ${isRecording ? 'text-red-500 animate-pulse' : 'text-sky-400'}`}>
    <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
    <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.041h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.041a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
  </svg>
);

const MuteIcon: React.FC<{isMuted: boolean, className?: string}> = ({ isMuted, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${className} w-6 h-6 ${isMuted ? 'text-red-500' : 'text-gray-400'}`}>
    {isMuted ? (
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.66 1.905H6.44l4.5 4.5c.945.945 2.56.276 2.56-1.06V4.06ZM18.584 12.353a.75.75 0 0 0 0-1.06l-1.06-1.061a.75.75 0 1 0-1.061 1.061L17.523 12l-1.06 1.06a.75.75 0 1 0 1.06 1.06l1.06-1.06Z" />
    ) : (
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.66 1.905H6.44l4.5 4.5c.945.945 2.56.276 2.56-1.06V4.06ZM17.25 12a.75.75 0 0 0-.75-.75H15v1.5h1.5a.75.75 0 0 0 .75-.75Z" />
    )}
     <path d="M19.5 12c0-2.485-2.015-4.5-4.5-4.5H15V6c0-.414-.336-.75-.75-.75h-.75a.75.75 0 0 0-.75.75v.021a6.008 6.008 0 0 0-4.5 5.979v.005A6.003 6.003 0 0 0 15 18v.001h.021a6.008 6.008 0 0 0 5.979-4.5h.005A6.003 6.003 0 0 0 19.5 12Z" />
  </svg>
);


const Controls: React.FC<ControlsProps> = ({ aiStatus, isRecording, onToggleRecording, isMuted, onToggleMute }) => {
  let statusColor = 'text-gray-400';
  if (aiStatus === AiStatus.Listening || aiStatus === AiStatus.Speaking) statusColor = 'text-sky-400';
  if (aiStatus === AiStatus.Processing) statusColor = 'text-yellow-400';
  if (aiStatus === AiStatus.Error) statusColor = 'text-red-500';

  return (
    <div className="p-4 bg-gray-850 border-t border-gray-700 flex flex-col items-center space-y-3">
      <button
        onClick={onToggleRecording}
        className={`p-4 rounded-full transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 ${
          isRecording ? 'bg-red-700 hover:bg-red-800 focus:ring-red-500' : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500'
        } shadow-lg`}
        aria-label={isRecording ? 'Stop conversation' : 'Start conversation'}
      >
        <MicrophoneIcon isRecording={isRecording} className="w-10 h-10 text-white" />
      </button>
      <div className="flex items-center space-x-3">
        <p className={`text-sm font-medium ${statusColor}`}>{aiStatus}</p>
        <button 
          onClick={onToggleMute}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          aria-label={isMuted ? "Unmute AI speech" : "Mute AI speech"}
        >
          <MuteIcon isMuted={isMuted} />
        </button>
      </div>
    </div>
  );
};

export default Controls;
