import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Stethoscope, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

const SUGGESTIONS = ["What are malaria symptoms?", "Which insurances do you accept?", "How do I book?"];

export function BellaVitaeAI() {
  const [open, setOpen] = useState(false);
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Bella Vitae AI" : "Open Bella Vitae AI"}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl ring-4 ring-accent/30"
      >
        {open ? <X className="h-5 w-5" /> : <Stethoscope className="h-5 w-5" />}
        <span className="hidden sm:inline">Bella Vitae AI</span>
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-20 right-3 z-50 flex h-[min(620px,80vh)] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Stethoscope className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <p className="font-semibold">Bella Vitae AI</p>
                <p className="text-[11px] opacity-80">Health answers guided by Medscape references</p>
              </div>
            </div>

            <Conversation className="flex-1">
              <ConversationContent>
                {messages.length === 0 ? (
                  <ConversationEmptyState
                    title="Muraho! How can I help?"
                    description="Ask about symptoms, medicines or our clinic. I don't replace a doctor."
                  >
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendMessage({ text: s })}
                          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </ConversationEmptyState>
                ) : (
                  messages.map((m) => (
                    <Message key={m.id} from={m.role}>
                      <MessageContent>
                        {m.parts.map((p, i) =>
                          p.type === "text" ? (
                            m.role === "assistant" ? (
                              <MessageResponse key={i}>{p.text}</MessageResponse>
                            ) : (
                              <span key={i}>{p.text}</span>
                            )
                          ) : null,
                        )}
                      </MessageContent>
                    </Message>
                  ))
                )}
                {status === "submitted" ? (
                  <p className="animate-pulse text-xs text-muted-foreground">Bella Vitae AI is thinking…</p>
                ) : null}
                {error ? <p className="text-xs text-destructive">{error.message}</p> : null}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="border-t border-border p-3">
              <PromptInput
                onSubmit={({ text }) => {
                  if (text?.trim() && !busy) sendMessage({ text });
                }}
              >
                <PromptInputTextarea placeholder="Ask Bella Vitae AI…" />
                <PromptInputFooter className="justify-between">
                  <Link to="/appointments" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">
                    Book an appointment
                  </Link>
                  <PromptInputSubmit
                    status={status}
                    onClick={(e) => {
                      if (busy) {
                        e.preventDefault();
                        void stop();
                      }
                    }}
                  />
                </PromptInputFooter>
              </PromptInput>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Not a diagnosis. Emergency? Call 912 or +250 788 275 617.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
