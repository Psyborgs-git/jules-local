import { useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { julesApi } from '../../julesApi';

export const MessageComposer = ({ sessionId }: { sessionId: string }) => {
  const [chatMessage, setChatMessage] = useState('');
  const { dbConfig, setActivities } = useAppStore();

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !sessionId) return;
    const messageText = chatMessage;
    setChatMessage('');
    julesApi.sendMessage(sessionId, messageText)
      .then(() => julesApi.listActivities(sessionId))
      .then(res => {
        setActivities(res);
      })
      .catch(console.error);
  };

  return (
    <div className="absolute bottom-6 left-0 right-0 px-6 z-10 flex justify-center pointer-events-none">
      <div className="w-full max-w-4xl pointer-events-auto">
        <form onSubmit={handleSendMessage} className="floating-composer glassmorphism p-2 pl-4 rounded-2xl flex items-center gap-3 border border-border-subtle bg-bg-surface backdrop-blur-xl shadow-lg transition-all duration-300 focus-within:border-border-focus focus-within:shadow-primary-glow focus-within:bg-bg-surface-hover">
          <input 
            type="text" 
            placeholder="Send instructions or feedback to Jules..." 
            value={chatMessage} 
            onChange={(e) => setChatMessage(e.target.value)} 
            disabled={!dbConfig?.hasKey} 
            className="flex-1 bg-transparent border-none text-text-bright text-sm py-2 px-1 outline-none font-mono placeholder:text-text-muted transition-all focus:placeholder:text-text-main" 
          />
          <button 
            type="submit" 
            disabled={!chatMessage.trim() || !dbConfig?.hasKey} 
            className="w-10 h-10 flex items-center justify-center bg-accent-primary hover:bg-accent-primary/80 disabled:bg-bg-surface-hover disabled:text-text-muted text-text-bright rounded-xl transition-all cursor-pointer border-none flex-shrink-0 shadow-primary-glow micro-interaction-btn hover:scale-105 active:scale-90"
          >
            <Send size={16} className={chatMessage.trim() ? "animate-pulse" : ""} />
          </button>
        </form>
        {!dbConfig?.hasKey && (
          <div className="text-center mt-2 text-[10px] text-accent-danger font-mono flex justify-center items-center gap-1.5">
            <AlertCircle size={10} /> Jules API key is offline. Please configure credentials in Settings.
          </div>
        )}
      </div>
    </div>
  );
};
