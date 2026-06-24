"use client";

import { useState, useRef } from "react";
import { MathMarkdown } from "@/lib/markdown";
import { ZoomableImage } from "@/lib/zoomable-image";
import { compressImage } from "@/lib/compress";

export function HomeworkProblem(p: {
  problemId: string;
  position: number;
  problemText: string;
  initialResolved: boolean;
  initialCorrect: boolean | null;
  initialAttempts: number;
  initialFeedback: string | null;
  initialSubmission: string | null;
}) {
  const [resolved, setResolved] = useState(p.initialResolved);
  const [correct, setCorrect] = useState(p.initialCorrect);
  const [attempts, setAttempts] = useState(p.initialAttempts);
  const [feedback, setFeedback] = useState(p.initialFeedback);
  const [submission, setSubmission] = useState(p.initialSubmission);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file).catch(() => file);
      const fd = new FormData();
      fd.append("image", compressed);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upJson = await up.json();
      if (!up.ok) {
        setFeedback("사진 업로드에 실패했어. 다시 시도해줘.");
        return;
      }
      setSubmission(upJson.url);
      const gr = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: p.problemId, imageUrl: upJson.url }),
      });
      const g = await gr.json();
      if (!gr.ok) {
        setFeedback(g.error ?? "채점에 실패했어.");
        return;
      }
      setCorrect(g.correct);
      setResolved(g.resolved);
      setAttempts(g.attempts);
      setFeedback(g.feedback);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const badge = resolved
    ? correct
      ? "✅ 정답"
      : "📘 해설 확인"
    : attempts > 0
      ? "✏️ 다시 풀기"
      : "미제출";

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{p.position}번</span>
        <span className="text-xs text-gray-500">{badge}</span>
      </div>
      <MathMarkdown>{p.problemText}</MathMarkdown>

      {submission && (
        <ZoomableImage
          src={submission}
          alt="내 풀이"
          className="max-h-40 cursor-zoom-in rounded border object-contain"
        />
      )}

      {feedback && (
        <div
          className={`rounded p-2 text-sm ${
            resolved && correct
              ? "bg-green-50 text-green-800"
              : resolved
                ? "bg-blue-50 text-blue-900"
                : "bg-amber-50 text-amber-900"
          }`}
        >
          <MathMarkdown>{feedback}</MathMarkdown>
        </div>
      )}

      {!resolved && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFile}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy
              ? "채점 중…"
              : attempts > 0
                ? "📷 다시 풀어서 올리기"
                : "📷 풀이 사진 올리기"}
          </button>
        </>
      )}
    </div>
  );
}
