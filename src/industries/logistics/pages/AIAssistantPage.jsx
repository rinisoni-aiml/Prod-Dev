import { useState, useEffect, useRef } from 'react';
import { Send, Plus, Trash2, Bot } from 'lucide-react';
import { logisticsApi } from '@/industries/logistics/api/logisticsApi';

const STARTER_PROMPTS = [
  'What is the current network risk?',
  'Which routes are showing the most delay pressure?',
  'Summarize financial exposure.',
  'What should operations do next?',
];

function generateSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatContent(content) {
  if (!content) return null;
  // Render **bold** and bullet lines
  const lines = content.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('• ') || line.startsWith('- ')) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-primary mt-0.5 flex-shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        </div>
      );
    }
    if (!line.trim()) return <div key={i} className="h-2" />;
    return (
      <p key={i} className="my-0.5 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
    );
  });
}

export default function AIAssistantPage() {
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await logisticsApi.getChatSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch { setSessions([]); }
    finally { setSessionsLoading(false); }
  };

  const switchSession = async (sid) => {
    if (sid === sessionId) return;
    setSessionId(sid);
    setChatHistory([]);
    setError('');
    try {
      const messages = await logisticsApi.getSessionMessages(sid);
      setChatHistory((Array.isArray(messages) ? messages : []).map((m) => ({ role: m.role, content: m.content, id: `${m.role}-${Math.random()}` })));
    } catch { setChatHistory([]); }
  };

  const startNewChat = () => {
    setSessionId(generateSessionId());
    setChatHistory([]);
    setError('');
    setPrompt('');
  };

  const deleteSession = async (sid, e) => {
    e.stopPropagation();
    try {
      await logisticsApi.deleteChatSession(sid);
      setSessions((prev) => prev.filter((s) => s.session_id !== sid));
      if (sid === sessionId) startNewChat();
    } catch { /* silent */ }
  };

  const submitPrompt = async (value) => {
    const q = (value || prompt).trim();
    if (!q || submitting) return;
    setSubmitting(true);
    setError('');
    const userMsg = { role: 'user', content: q, id: `user-${Date.now()}` };
    setChatHistory((prev) => [...prev, userMsg]);
    setPrompt('');
    try {
      const res = await logisticsApi.askAIAssistant(q, sessionId);
      const answer = res?.answer || 'No response generated.';
      setChatHistory((prev) => [...prev, { role: 'assistant', content: answer, id: `assistant-${Date.now()}` }]);
      loadSessions();
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: err?.message || 'Request failed. Please try again.', id: `err-${Date.now()}` }]);
      setError('Assistant request failed.');
    } finally { setSubmitting(false); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPrompt(); }
  };

  const isEmpty = chatHistory.length === 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 border-r border-border bg-background-surface overflow-hidden">
        <div className="p-3 border-b border-border">
          <button onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> New Chat
          </button>
        </div>
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-secondary">Chat History</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin">
          {sessionsLoading ? (
            <p className="text-xs text-foreground-secondary px-2 py-2">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-foreground-secondary px-2 py-2">No past conversations yet.</p>
          ) : (
            sessions.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20).map((s) => {
              const isActive = s.session_id === sessionId;
              return (
                <div key={s.session_id} onClick={() => switchSession(s.session_id)}
                  className={`group flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-primary/15 border border-primary/30 text-primary' : 'text-foreground-secondary hover:bg-muted hover:text-foreground'}`}>
                  <span className="flex-1 text-xs truncate">{String(s.title || 'Untitled').slice(0, 40)}</span>
                  <button onClick={(e) => deleteSession(s.session_id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity flex-shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg gradient-brand flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">AI Assistant</h1>
              <p className="text-xs text-foreground-secondary">Live DB Q&A · Context-aware · Operations Co-Pilot</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="h-16 w-16 rounded-2xl gradient-brand flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Logistics AI Assistant</h2>
              <p className="text-sm text-foreground-secondary max-w-sm mb-8">
                Ask for a network summary, route delays, financial exposure, or next-step recommendations.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {STARTER_PROMPTS.map((p) => (
                  <button key={p} onClick={() => submitPrompt(p)} disabled={submitting}
                    className="px-4 py-2 rounded-full bg-muted border border-border text-sm text-foreground-secondary hover:text-foreground hover:bg-muted/70 hover:border-primary/50 transition-colors disabled:opacity-50">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${msg.role === 'user' ? 'gradient-brand text-white' : 'bg-muted border border-border text-foreground'}`}>
                {msg.role === 'user' ? 'R' : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'gradient-brand text-white rounded-tr-sm' : 'bg-muted border border-border text-foreground rounded-tl-sm'}`}>
                {msg.role === 'assistant' ? formatContent(msg.content) : <p>{msg.content}</p>}
              </div>
            </div>
          ))}

          {submitting && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                <Bot className="h-4 w-4 text-foreground" />
              </div>
              <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-2 w-2 rounded-full bg-foreground-secondary animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0 bg-background-surface">
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}
          <div className="flex gap-3 items-end">
            <textarea ref={textareaRef} rows={2}
              placeholder="Ask about risk hotspots, delayed routes, or financial exposure..."
              value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKey}
              className="flex-1 resize-none bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-foreground-secondary focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] max-h-32 scrollbar-thin" />
            <button onClick={() => submitPrompt()} disabled={!prompt.trim() || submitting}
              className="h-11 w-11 rounded-xl gradient-brand flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity">
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-foreground-secondary mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
