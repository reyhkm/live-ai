import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, Sender } from '../types';
import WaveformDisplay from './WaveformDisplay'; // Import the new component

interface ChatBubbleProps {
  message: ChatMessage;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.sender === Sender.User;
  const isAI = message.sender === Sender.AI;
  const isSystem = message.sender === Sender.System;

  const bubbleClasses = isUser
    ? 'bg-sky-600 self-end rounded-l-xl rounded-tr-xl'
    : isAI
    ? 'bg-slate-700 self-start rounded-r-xl rounded-tl-xl'
    : 'bg-yellow-600 self-center text-xs italic rounded-md';

  const senderName = isUser ? 'You' : isAI ? 'AI Assistant' : 'System';

  // Basic styling for markdown elements if needed
  const markdownComponents = {
    // Override default styling for p if react-markdown adds extra margins/paddings
    p: (props: any) => <p className="mb-1 last:mb-0" {...props} />,
    // You can add more overrides for ul, ol, li, strong, em, etc. if Tailwind's default
    // or prose plugin (if used) doesn't cover it well enough.
    // For now, relying on Tailwind's defaults and the browser's handling of these elements.
    ul: (props: any) => <ul className="list-disc list-inside ml-4" {...props} />,
    ol: (props: any) => <ol className="list-decimal list-inside ml-4" {...props} />,
    li: (props: any) => <li className="mb-0.5" {...props} />,
    strong: (props: any) => <strong className="font-bold" {...props} />,
    em: (props: any) => <em className="italic" {...props} />,
  };


  return (
    <div className={`w-full flex mb-3 ${isUser ? 'justify-end' : isAI ? 'justify-start' : 'justify-center'}`}>
      <div className={`max-w-[70%] p-3 text-white shadow-md ${bubbleClasses}`}>
        {!isSystem && <p className="text-xs font-semibold mb-1 opacity-80">{senderName}</p>}
        
        {isAI && message.audioWaveformData && message.audioWaveformData.length > 0 && (
          <div className="mb-2"> {/* Container for the waveform */}
            <WaveformDisplay data={message.audioWaveformData} barColor="#94a3b8" width={200} height={40}/> {/* Tailwind slate-400 for AI waveform */}
          </div>
        )}
        
        <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
           {/* prose-invert is for dark backgrounds with Tailwind Typography plugin */}
           {/* If not using typography plugin, custom styling via components prop is more crucial */}
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.text}
          </ReactMarkdown>
        </div>
        
        {!isSystem && <p className="text-xs opacity-60 mt-2 text-right">{message.timestamp.toLocaleTimeString()}</p>}
      </div>
    </div>
  );
};

export default ChatBubble;