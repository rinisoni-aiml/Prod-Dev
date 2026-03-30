import { useState, useEffect, useRef } from "react";
import PageHeader from "../components/PageHeader";
import { logisticsApi } from "../api/logisticsApi";

const STARTER_PROMPTS = [
  "What is the current network risk?",
  "Which routes are showing the most delay pressure?",
  "Summarize financial exposure.",
  "What should operations do next?",
];

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createMessageId(role) {
  return `${generateSessionId()}-${role}`;
}

function normalizeAssistantText(content) {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toParagraphs(text) {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractInlineBulletList(text) {
  if (!text) return null;
  const bulletLikeParts = text.split(/\s-\s/).map((part) => part.trim());
  const hasEnoughItems = bulletLikeParts.length >= 4;
  const isLongResponse = text.length >= 220;
  const hasListHint = /(include:|includes:|as follows:|for example:|below:)/i.test(text);
  if (!hasEnoughItems || (!hasListHint && !isLongResponse)) return null;
  const [intro, ...items] = bulletLikeParts;
  const cleanedItems = items
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((item) => item.replace(/[.;]+$/, ""));
  if (!cleanedItems.length) return null;
  return { intro: intro.replace(/\s+/g, " ").trim(), items: cleanedItems };
}

function formatAssistantMessage(content) {
  const normalized = normalizeAssistantText(content);
  if (!normalized) return { paragraphs: [], bullets: [] };
  const maybeList = extractInlineBulletList(normalized);
  if (maybeList) {
    return {
      paragraphs: toParagraphs(maybeList.intro),
      bullets: maybeList.items,
    };
  }
  const blocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return { paragraphs: blocks.flatMap((b) => toParagraphs(b)), bullets: [] };
}

function renderAssistantMessage(content) {
  const { paragraphs, bullets } = formatAssistantMessage(content);
  return (
    <div>
      {paragraphs.map((p, i) => (
        <p key={`para-${i}`} style={{ margin: i === 0 ? "4px 0" : "10px 0", lineHeight: 1.6 }}>
          {p}
        </p>
      ))}
      {bullets.length ? (
        <ul style={{ margin: "8px 0 4px 18px", padding: 0 }}>
          {bullets.map((item, i) => (
            <li key={`bullet-${i}`} style={{ marginBottom: "6px" }}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function AIAssistantPage() {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await logisticsApi.getChatSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const switchSession = async (sid) => {
    if (sid === sessionId) return;
    setSessionId(sid);
    setChatHistory([]);
    setError("");
    try {
      const messages = await logisticsApi.getSessionMessages(sid);
      const formatted = (Array.isArray(messages) ? messages : []).map((m) => ({
        role: m.role,
        content: m.content,
        id: createMessageId(m.role),
      }));
      setChatHistory(formatted);
    } catch {
      setChatHistory([]);
    }
  };

  const startNewChat = () => {
    const newId = generateSessionId();
    setSessionId(newId);
    setChatHistory([]);
    setError("");
    setPrompt("");
  };

  const clearCurrentChat = async () => {
    if (clearing || submitting) return;
    setClearing(true);
    setError("");
    try {
      const hasPersistedSession = sessions.some((s) => s.session_id === sessionId);
      if (hasPersistedSession) {
        await logisticsApi.deleteChatSession(sessionId);
      }
      startNewChat();
      await loadSessions();
    } catch {
      setError("Unable to clear this chat. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  const submitPrompt = async (nextPrompt) => {
    const value = nextPrompt.trim();
    if (!value || submitting) return;

    setSubmitting(true);
    setError("");

    const userMessage = {
      role: "user",
      content: value,
      id: createMessageId("user"),
    };
    setChatHistory((prev) => [...prev, userMessage]);
    setPrompt("");

    try {
      const response = await logisticsApi.askAIAssistant(value, sessionId);
      const backendError = response?.error;
      const answer = response?.answer || "No response generated.";
      const assistantMessage = {
        role: "assistant",
        content: backendError ? `${answer}\n\nNote: ${backendError}` : answer,
        id: createMessageId("assistant"),
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
      loadSessions();
    } catch (requestError) {
      const errorMessage = {
        role: "assistant",
        content: requestError?.message || "I could not retrieve a live answer. Please try again.",
        id: createMessageId("assistant"),
      };
      setChatHistory((prev) => [...prev, errorMessage]);
      setError("Assistant request failed. Check backend/LLM configuration.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      <div
        style={{
          width: "220px",
          flexShrink: 0,
          position: "sticky",
          top: "16px",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: "var(--bg-card, #111827)",
          border: "1px solid var(--border, rgba(255,255,255,0.07))",
          borderRadius: "10px",
          padding: "12px",
        }}
      >
        <button type="button" className="primary" style={{ width: "100%", marginBottom: "12px" }} onClick={startNewChat}>
          + New Chat
        </button>

        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--text-3, #64748B)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "8px",
          }}
        >
          Chat History
        </div>

        {sessionsLoading ? (
          <div style={{ fontSize: "12px", color: "var(--text-3, #64748B)", padding: "8px 0" }}>Loading...</div>
        ) : sessions.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--text-3, #64748B)", padding: "8px 0" }}>
            No past conversations yet.
          </div>
        ) : (
          sessions
            .slice()
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 20)
            .map((s) => {
              const isActive = s.session_id === sessionId;
              return (
                <button
                  key={s.session_id}
                  type="button"
                  onClick={() => switchSession(s.session_id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: isActive ? "rgba(59,130,246,0.15)" : "transparent",
                    border: isActive ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    marginBottom: "4px",
                    fontSize: "12px",
                    color: isActive ? "#3B82F6" : "var(--text-2, #94A3B8)",
                    cursor: "pointer",
                    wordBreak: "break-word",
                    lineHeight: 1.4,
                  }}
                >
                  {isActive ? "▶ " : ""}
                  {String(s.title || "Untitled").slice(0, 45)}
                  {String(s.title || "").length > 45 ? "…" : ""}
                </button>
              );
            })
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <PageHeader title="AI Assistant" subtitle="Chat with AI for insights, recommendations, and analysis" icon="🤖" />

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Operations Co-Pilot</div>
            <div className="panel-meta">Live DB Q&A · Context-aware memory</div>
          </div>
          <div className="panel-body">
            <div className="chat-container">
              {error ? (
                <div className="upload-error" style={{ marginBottom: "12px" }}>
                  {error}
                </div>
              ) : null}

              {!chatHistory.length ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🤖</div>
                  <div className="empty-state-message">
                    Ask for a network summary, route delays, financial exposure, or next-step recommendations.
                  </div>
                </div>
              ) : null}

              {chatHistory.map((message) => (
                <div key={message.id} className={`chat-message ${message.role === "user" ? "user" : ""}`}>
                  <div className={`chat-avatar ${message.role === "user" ? "user" : ""}`}>
                    {message.role === "user" ? "🧑" : "🤖"}
                  </div>
                  <div className={`chat-bubble ${message.role === "user" ? "user" : ""}`}>
                    <div className="chat-name">{message.role === "user" ? "You" : "AI Assistant"}</div>
                    {message.role === "assistant" ? renderAssistantMessage(message.content) : message.content}
                  </div>
                </div>
              ))}

              <div ref={bottomRef} />

              <div className="chat-chips">
                {STARTER_PROMPTS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="chat-chip"
                    onClick={() => submitPrompt(starter)}
                    disabled={submitting}
                  >
                    {starter}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
                <textarea
                  rows={4}
                  placeholder="Ask about risk hotspots, delayed routes, or exposure..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitPrompt(prompt);
                    }
                  }}
                />
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" className="primary" onClick={() => submitPrompt(prompt)} disabled={submitting}>
                    {submitting ? "Analyzing..." : "Send"}
                  </button>
                  <button type="button" onClick={clearCurrentChat} disabled={submitting || clearing}>
                    {clearing ? "Clearing..." : "Clear chat"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
