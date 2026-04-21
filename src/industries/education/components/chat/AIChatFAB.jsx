import { Sparkles, X } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

const AIChatFAB = () => {
  const { isOpen, toggleChat } = useChatStore();

  return (
    <button
      onClick={toggleChat}
      className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      title="Ask PulseIQ AI"
    >
      {isOpen
        ? <X className="h-6 w-6 text-white" />
        : <Sparkles className="h-6 w-6 text-white" />
      }
    </button>
  );
};

export default AIChatFAB;