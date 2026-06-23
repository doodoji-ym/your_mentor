"use client";

import { useState, useRef, useEffect } from "react";
import { MathMarkdown } from "@/lib/markdown";

export type ChatMessage = {
  id: string;
  sender: "student" | "assistant";
  content: string;
};

export function Chat({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, sender: "student", content: text },
    ]);
    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text }),
      });
      const data = await res.json();
      const reply = res.ok
        ? data.reply
        : `오류가 났어: ${data.error ?? "알 수 없음"}`;
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, sender: "assistant", content: reply },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          sender: "assistant",
          content: "네트워크 오류가 났어. 다시 시도해줄래?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto rounded border bg-gray-50 p-3">
        {isEmpty && (
          <p className="text-sm text-gray-500">
            문제에 대해 궁금한 걸 물어봐. 어디서 막혔는지 말해주면 거기서부터
            같이 풀어보자. (답은 바로 안 알려줘 — 힌트로 도와줄게!)
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.sender === "student" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={
                m.sender === "student"
                  ? "max-w-[80%] rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white"
                  : "max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm shadow-sm"
              }
            >
              {m.sender === "assistant" ? (
                <MathMarkdown>{m.content}</MathMarkdown>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-3 py-2 text-sm text-gray-400 shadow-sm">
              생각 중…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="여기에 입력…"
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          보내기
        </button>
      </div>
    </>
  );
}
