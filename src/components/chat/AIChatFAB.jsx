import { Sparkles } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

const AIChatFAB = () => {
  const { isOpen, toggleChat } = useChatStore();
  if (isOpen) return null;
  return (
    <button onClick={toggleChat} className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full gradient-ai shadow-lg hover-lift flex items-center justify-center animate-pulse-glow group" title="Ask PulseIQ AI">
      <Sparkles className="h-6 w-6 text-primary-foreground group-hover:scale-110 transition-transform" />
    </button>
  );
};
export default AIChatFAB;
