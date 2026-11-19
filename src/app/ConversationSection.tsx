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
  const isElevatedSmog = Boolean(forecast && forecast.currentPm25 >= 55.5);

  const promptSuggestions = isElevatedSmog
    ? [
        "Are N95 masks recommended right now?",
        "What if pickup time is fixed?",
        "What can we do indoors today?",
        "How do we make fewer car trips?",
      ]
    : [
        "What if pickup cannot move?",
        "What can we do indoors?",
        "How do we make fewer car trips?",
        "When is the best window for outdoor play?",
      ];

  return (
    <section className="conversation-section" aria-labelledby="chat-heading">
      <div className="conversation-head">
        <div className="assistant-avatar" aria-hidden="true">
          <Sparkles size={21} />
        </div>
        <div>
          <span className="eyebrow">YOUR AIR ASSISTANT</span>
          <h2 id="chat-heading">Ask HawaPlan</h2>
          <p>
            Your conversation is{" "}
            {signedIn ? "synced to your account" : "saved on this device"}.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="text-action"
            onClick={() => {
              if (window.confirm("Clear this conversation history?"))
                onClearChat();
            }}
            aria-label="Clear chat conversation"
          >
            <Trash2 size={15} aria-hidden="true" /> Clear chat
          </button>
        )}
      </div>

      <div
        className="chat-window"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon" aria-hidden="true">
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
              <div className="chat-bubble-avatar" aria-hidden="true">
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
          <div className="chat-thinking" role="status" aria-live="polite">
            <Sparkles size={17} className="spin" aria-hidden="true" /> Thinking
            with your plan…
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      <div className="conversation-compose">
        <div
          className="prompt-suggestions"
          role="group"
          aria-label="Suggested questions"
        >
          {promptSuggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => onQuestionChange(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="ask-box">
          <MessageCircle size={20} aria-hidden="true" />
          <input
            id="chat-input-field"
            aria-label="Ask HawaPlan a question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAsk();
            }}
            placeholder="Ask about your family’s day…"
            maxLength={500}
          />
          <button
            type="button"
            onClick={onAsk}
            disabled={!forecast || !question.trim() || asking}
            aria-label="Send message"
          >
            {asking ? (
              <RefreshCw size={18} className="spin" aria-hidden="true" />
            ) : (
              <Send size={18} aria-hidden="true" />
            )}
          </button>
        </div>

        {askError && (
          <p className="ask-error" role="alert">
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
