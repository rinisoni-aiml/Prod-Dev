import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Mic, MicOff, Volume2, VolumeX, Send, Plus, Sparkles } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import ReactMarkdown from 'react-markdown';
import { educationAiApi } from '@/lib/api';

const SUGGESTED_PROMPTS = [
  'How many students are in each class?',
  'Which students have low attendance?',
  'Show average marks by subject',
  'Which class has the highest pass rate?',
  'List students who failed in any subject',
];

const casualPhrases = [
  'hi','hello','hey','how are you','good morning','good afternoon',
  'good evening','thanks','thank you','bye','goodbye','okay','ok',
  'cool','great','nice','awesome','got it','sure','yes','no',
];

const isDataQuestion = (text) =>
  !casualPhrases.includes(text.trim().toLowerCase());

const casualReply = (text) => {
  const t = text.trim().toLowerCase();
  if (['hi','hello','hey'].includes(t))
    return "Hello! 👋 I'm PulseIQ AI, your intelligent data assistant.\n\nTry asking:\n- **How many students are in each class?**\n- **Which students have low attendance?**\n- **Show average marks by subject**";
  if (t.includes('how are you'))
    return "I'm doing great and ready to help! 😊 Ask me anything about your data.";
  if (['thanks','thank you'].includes(t))
    return "You're welcome! Let me know if you have more questions. 😊";
  if (['bye','goodbye'].includes(t))
    return "Goodbye! Come back anytime. 👋";
  return "I'm here to help! Try asking a specific question about your data.";
};

const AIChatDrawer = () => {
  const { isOpen, closeChat, messages, addMessage, isTyping, setTyping, clearMessages } = useChatStore();
  const { profile } = useAuthStore();
  const [input, setInput] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    });
    setInput('');
    setTyping(true);

    if (!isDataQuestion(text)) {
      setTimeout(() => {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: casualReply(text),
          created_at: new Date().toISOString(),
        });
        setTyping(false);
      }, 500);
      return;
    }

    try {
      const res = await educationAiApi.chat(text);
      const answer = res.data?.response || 'No response received.';
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer,
        created_at: new Date().toISOString(),
      });
      if (ttsEnabled && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(answer.replace(/[*#_]/g, ''));
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err?.response?.data?.error
          || err?.message
          || 'Could not connect to backend. Make sure your Python server is running on port 8000.',
        created_at: new Date().toISOString(),
      });
    } finally {
      setTyping(false);
    }
  };

  const handleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.onresult = (e) => sendMessage(e.results[0][0].transcript);
    recognition.onend = () => setVoiceEnabled(false);
    recognition.start();
    setVoiceEnabled(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/40 md:hidden"
            onClick={closeChat}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-[9999] w-full sm:w-[420px] flex flex-col border-l border-border shadow-2xl"
            style={{ background: 'hsl(var(--background-surface, var(--background)))' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">PulseIQ AI</h3>
                  <p className="text-xs text-foreground-secondary flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    Groq LLaMA3 · Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVoice}
                  className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  title="Voice input"
                >
                  {voiceEnabled
                    ? <MicOff className="h-4 w-4 text-red-500" />
                    : <Mic className="h-4 w-4 text-foreground-secondary" />}
                </button>
                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  title="Text to speech"
                >
                  {ttsEnabled
                    ? <Volume2 className="h-4 w-4 text-indigo-500" />
                    : <VolumeX className="h-4 w-4 text-foreground-secondary" />}
                </button>
                <button
                  onClick={clearMessages}
                  className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  title="New conversation"
                >
                  <Plus className="h-4 w-4 text-foreground-secondary" />
                </button>
                <button
                  onClick={closeChat}
                  className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  title="Close"
                >
                  <X className="h-4 w-4 text-foreground-secondary" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.length === 0 && (
                <div className="space-y-2 mt-6">
                  <p className="text-xs text-foreground-secondary text-center mb-3">
                    Try asking:
                  </p>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-indigo-400/50 hover:bg-indigo-500/5 text-sm text-foreground-secondary hover:text-foreground transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-sm'
                        : 'bg-muted border-l-[3px] border-indigo-500 rounded-bl-sm text-foreground'
                    }`}
                    style={msg.role === 'user'
                      ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }
                      : {}}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-4 py-3 border-l-[3px] border-indigo-500">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-2 w-2 rounded-full bg-foreground-secondary animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Ask PulseIQ AI anything about your data..."
                  rows={1}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="h-10 w-10 rounded-lg flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  <Send className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AIChatDrawer;