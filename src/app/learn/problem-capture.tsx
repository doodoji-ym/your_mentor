"use client";

import { useRef, useState } from "react";
import { startProblem } from "./actions";
import { compressImage } from "@/lib/compress";

export function ProblemCapture() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function onChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setPending(true);
    try {
      const compressed = await compressImage(file).catch(() => file);
      const dt = new DataTransfer();
      dt.items.add(compressed);
      if (fileRef.current) fileRef.current.files = dt.files;
    } catch {
      // 압축 실패 시 원본 그대로 제출
    }
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={startProblem}>
      <input
        ref={fileRef}
        type="file"
        name="image"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
      <input type="hidden" name="mode" value="solve" />
      <button
        type="button"
        disabled={pending}
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-xl bg-slate-900 px-4 py-5 text-center text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "문제 분석 중…" : "📷 문제 찍어서 질문하기"}
      </button>
    </form>
  );
}
