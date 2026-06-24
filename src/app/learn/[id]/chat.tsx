"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MathMarkdown } from "@/lib/markdown";
import { ZoomableImage } from "@/lib/zoomable-image";
import { compressImage } from "@/lib/compress";

export type ChatMessage = {
  id: string;
  sender: "student" | "assistant";
  content: string;
  image_url?: string | null;
};

export function Chat({
  conversationId,
  mode,
  imageUrl,
  initialUnderstanding,
  initialMessages,
}: {
  conversationId: string;
  mode: "solve" | "review";
  imageUrl: string | null;
  initialUnderstanding: number;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [understanding, setUnderstanding] = useState(initialUnderstanding);
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function attach() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file).catch(() => file);
      const fd = new FormData();
      fd.append("image", compressed);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) setAttached(data.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !attached) || loading) return;
    const sentImage = attached;
    setInput("");
    setAttached(null);
    setMessages((m) => [
      ...m,
      {
        id: `tmp-${Date.now()}`,
        sender: "student",
        content: text,
        image_url: sentImage,
      },
    ]);
    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text, imageUrl: sentImage }),
      });
      const data = await res.json();
      if (res.ok && typeof data.understanding === "number") {
        setUnderstanding(data.understanding);
      }
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

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <header className="mb-2 flex items-center justify-between">
        <Link href="/learn" className="text-sm text-gray-500 underline">
          ← 목록
        </Link>
        <span className="text-xs text-gray-500">
          {mode === "review" ? "해설 모드" : "풀이 모드"} · 이해도{" "}
          <span className="font-semibold text-slate-700">{understanding}</span>
        </span>
      </header>

      {imageUrl && <ZoomableImage src={imageUrl} alt="문제" />}

      <div className="flex-1 space-y-3 overflow-y-auto rounded border bg-gray-50 p-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            문제에 대해 궁금한 걸 물어봐. 푼 걸 사진으로 올려도 돼. (답은 바로 안
            알려줘 — 힌트로 도와줄게!)
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
                  : "max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              }
            >
              {m.image_url && (
                <ZoomableImage
                  src={m.image_url}
                  alt="첨부"
                  className="mb-1 max-h-44 cursor-zoom-in rounded object-contain"
                />
              )}
              {m.sender === "assistant" ? (
                <MathMarkdown>{m.content}</MathMarkdown>
              ) : (
                m.content && <span>{m.content}</span>
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

      {attached && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <ZoomableImage
            src={attached}
            alt="첨부 미리보기"
            className="h-12 w-12 cursor-zoom-in rounded border object-cover"
          />
          <span>사진 첨부됨</span>
          <button
            onClick={() => setAttached(null)}
            className="text-red-500 underline"
          >
            제거
          </button>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={attach}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || loading}
          className="rounded border px-3 py-2 text-lg disabled:opacity-50"
          title="사진 첨부"
        >
          {uploading ? "…" : "📷"}
        </button>
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
          disabled={loading || uploading}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          보내기
        </button>
      </div>
    </main>
  );
}
