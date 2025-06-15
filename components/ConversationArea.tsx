
import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import ChatBubble from './ChatBubble';

interface ConversationAreaProps {
  messages: ChatMessage[];
}

const ConversationArea: React.FC<ConversationAreaProps> = ({ messages }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-grow p-6 space-y-2 overflow-y-auto bg-gray-800 rounded-lg shadow-inner">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-400">Press the microphone to start the conversation.</p>
        </div>
      )}
      {messages.map((msg) => (
        <ChatBubble key={msg.id} message={msg} />
      ))}
      <div ref={endOfMessagesRef} />
    </div>
  );
};

export default ConversationArea;
