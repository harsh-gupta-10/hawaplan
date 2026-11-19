import type { RefObject } from "react";
import {
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import type { Forecast } from "../shared/planner";
import type { ChatMessage } from "../shared/saved";

interface ConversationSectionProps {
  messages: ChatMessage[];
  signedIn: boolean;
  forecast: Forecast | null;
  question: string;
  asking: boolean;
  askError: string;
  chatEnd: RefObject<HTMLDivElement | null>;
  onClearChat: () => void;
  onQuestionChange: (question: string) => void;
  onAsk: () => void;
}

export default function ConversationSection({
  messages,
  signedIn,
  forecast,
  question,
  asking,
  askError,
  chatEnd,
  onClearChat,
  onQuestionChange,
  onAsk,
}: ConversationSectionProps) {
  return (
    <section className="conversation-section">
      <div className="conversation-head">
        <div className="assistant-avatar">
          <Sparkles size={21} />
        </div>
        <div>
          <span className="eyebrow">YOUR AIR ASSISTANT</span>
          <h2>Ask HawaPlan</h2>
          <p>
            Your conversation is{" "}
            {signedIn ? "synced to your account" : "saved on this device"}.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            className="text-action"
            onClick={() => {
              if (window.confirm("Clear this conversation history?"))
                onClearChat();
            }}
          >
            <Trash2 size={15} /> Clear chat
          </button>
        )}
      </div>
      <div className="chat-window">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <MessageCircle size={25} />
            </div>
            <strong>What does your day look like?</strong>
            <p>
              Ask about a fixed school pickup, an indoor alternative, or a
              lower-emission trip.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div className={`chat-bubble ${message.role}`} key={message.id}>
              <div className="chat-bubble-avatar">
                {message.role === "assistant" ? (
                  <Sparkles size={16} />
                ) : (
                  <UserRound size={16} />
                )}
              </div>
              <div>
                <span className="chat-author">
                  {message.role === "assistant" ? "HawaPlan" : "You"} ·{" "}
                  {message.city}
                </span>
                <p>{message.content}</p>
              </div>
            </div>
          ))
        )}
        {asking && (
          <div className="chat-thinking">
            <Sparkles size={17} className="spin" /> Thinking with your plan…
          </div>
        )}
        <div ref={chatEnd} />
      </div>
      <div className="conversation-compose">
        <div className="prompt-suggestions">
          {[
            "What if pickup cannot move?",
            "What can we do indoors?",
            "How do we make fewer car trips?",
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onQuestionChange(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="ask-box">
          <MessageCircle size={20} />
          <input
            aria-label="Ask HawaPlan"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAsk();
            }}
            placeholder="Ask about your family’s day…"
            maxLength={500}
          />
          <button
            onClick={onAsk}
            disabled={!forecast || !question.trim() || asking}
            aria-label="Send message"
          >
            {asking ? (
              <RefreshCw size={18} className="spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        {askError && (
          <p className="ask-error">
            {askError} Your question is saved; you can try again.
          </p>
        )}
        <p className="ai-note">
          Answers use a broad-area model forecast. For personal medical advice,
          consult a clinician.
        </p>
      </div>
    </section>
  );
}
