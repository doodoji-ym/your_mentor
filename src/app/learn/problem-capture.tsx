"use client";

import { useRef, useState } from "react";
import { startProblem } from "./actions";

// 폰 사진(수 MB, HEIC 등)을 canvas로 리사이즈 + JPEG 재인코딩 → 업로드 가볍게.
async function compressImage(file: File): Promise<File> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
  );
  if (!blob) return file;
  return new File([blob], "problem.jpg", { type: "image/jpeg" });
}

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
