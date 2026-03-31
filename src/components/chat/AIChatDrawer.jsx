import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Volume2, VolumeX, Send, Plus, Sparkles } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { chatWithGroq } from '@/lib/groq';
import ReactMarkdown from 'react-markdown';

const SUGGESTED_PROMPTS = {
  fmcg: [
    'Which products are at stockout risk?',
    'Show my top 5 SKUs this month',
    "What's my inventory health score?",
    'Which contracts expire soon?',
    'Forecast demand for next 30 days',
  ],
  logistics: [
    'What is the current network risk level?',
    'Which routes have the highest delay pressure?',
    'Summarise financial exposure across active shipments.',
    'Which vendors have the worst on-time delivery?',
    'What compliance documents are expiring soon?',
  ],
};

const SYSTEM_PROMPTS = {
  fmcg: (company, role) =>
    `You are PulseIQ AI, an intelligent business analytics assistant for ${company}, specializing in FMCG industry insights.
The user's role is: ${role}.

You help with:
- Demand forecasting and inventory analysis
- Stockout risk identification
- Contract and supplier management
- Data-driven business decisions

Keep responses concise, actionable, and data-focused. Use markdown for structure where helpful.
If you don't have real data, provide analytical frameworks and ask clarifying questions.`,

  logistics: (company, role) =>
    `You are PulseIQ AI, an intelligent operations assistant for ${company}, specializing in logistics and supply chain intelligence.
The user's role is: ${role}.

You help with:
- Shipment risk assessment and route analysis
- Vendor performance and on-time delivery tracking
- Compliance monitoring (fleet, driver licenses, insurance)
- Financial exposure and freight cost analysis
- Network-level risk scoring and mitigation recommendations

Keep responses concise, actionable, and data-focused. Use markdown for structure where helpful.
If you don't have real data, provide analytical frameworks and ask clarifying questions.`,
};

const buildSystemPrompt = (profile) => {
  const industry = String(profile?.industry || 'fmcg').toLowerCase();
  const company = profile?.company_name || 'the company';
  const role = profile?.role || 'user';
  const builder = SYSTEM_PROMPTS[industry] || SYSTEM_PROMPTS.fmcg;
  return builder(company, role);
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

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput('');
    setTyping(true);

    try {
      // Build conversation history for context (last 10 messages to keep tokens low)
      const history = [...messages, userMsg]
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));

      const reply = await chatWithGroq(history, buildSystemPrompt(profile));

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };
      addMessage(aiMsg);

      if (ttsEnabled && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(reply.replace(/[*#_`]/g, ''));
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I couldn't connect to the AI. ${err.message}`,
        created_at: new Date().toISOString(),
      };
      addMessage(errMsg);
    } finally {
      setTyping(false);
    }
  };

  const handleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.onresult = (event) => { sendMessage(event.results[0][0].transcript); };
    recognition.start();
    setVoiceEnabled(true);
    recognition.onend = () => setVoiceEnabled(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] z-[9999] glass-card border-l shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg gradient-ai flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">PulseIQ AI</h3>
                <p className="text-xs text-foreground-secondary flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  LLaMA 3.1 · Groq
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleVoice} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
                {voiceEnabled ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4 text-foreground-secondary" />}
              </button>
              <button onClick={() => setTtsEnabled(!ttsEnabled)} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
                {ttsEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-foreground-secondary" />}
              </button>
              <button onClick={() => clearMessages()} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <Plus className="h-4 w-4 text-foreground-secondary" />
              </button>
              <button onClick={closeChat} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-foreground-secondary" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="space-y-3 mt-8">
                <p className="text-sm text-foreground-secondary text-center mb-4">Try asking:</p>
                {(SUGGESTED_PROMPTS[String(profile?.industry || 'fmcg').toLowerCase()] || SUGGESTED_PROMPTS.fmcg).map((prompt) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 text-sm text-foreground-secondary hover:text-foreground transition-all">
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'gradient-brand text-primary-foreground rounded-br-sm'
                    : 'bg-background-elevated border-l-[3px] border-accent rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant'
                    ? <div className="prose prose-sm dark:prose-invert max-w-none text-foreground"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    : msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-background-elevated rounded-xl px-4 py-3 border-l-[3px] border-accent">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 rounded-full bg-foreground-secondary animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Ask PulseIQ AI anything..."
                rows={1}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background-surface text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="h-10 w-10 rounded-lg gradient-brand flex items-center justify-center hover-lift disabled:opacity-50"
              >
                <Send className="h-4 w-4 text-primary-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIChatDrawer;
