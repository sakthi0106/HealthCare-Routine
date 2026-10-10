import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { Disclaimer } from "./ui";

const EXAMPLES = [
  "Did I take my morning tablets?",
  "How much water did I drink today?",
  "How much did I walk today?",
  "When is my next appointment?",
  "Which medicines are running low?",
  "Show my medicine schedule.",
];

export default function AIChat({ onClose }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: "How can I help you?" }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  const send = async (msg) => {
    const message = (msg ?? text).trim();
    if (!message || busy) return;
    const history = messages.slice(1).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: message }]);
    setText("");
    setBusy(true);
    try {
      const { reply } = await api("/api/ai/chat", { method: "POST", body: { message, history } });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e.message || "Sorry, I could not answer that. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet chat" role="dialog" aria-modal="true" aria-label="AI Assistant" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>🤖 AI Assistant</h2>
          <button className="btn btn-ghost btn-small" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="chat-log">
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble-${m.role}`}>{m.content}</div>
          ))}
          {busy && <div className="bubble bubble-assistant">Checking…</div>}
          {messages.length === 1 && (
            <div className="chips">
              {EXAMPLES.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="chat-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type your question…"
            maxLength={500}
            aria-label="Your question"
          />
          <button className="btn" onClick={() => send()} disabled={busy || !text.trim()}>Send</button>
        </div>
        <Disclaimer compact />
      </div>
    </div>
  );
}
