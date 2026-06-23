"use client";

import { useRef, useState } from "react";
import { startProblem } from "./actions";

// 탭 → 카메라/갤러리 → 사진 선택 시 자동 제출(업로드+분류). 모바일 친화 플로우.
export function ProblemCapture() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  return (
    <form ref={formRef} action={startProblem}>
      <input
        ref={fileRef}
        type="file"
        name="image"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={() => {
          if (fileRef.current?.files?.length) {
            setPending(true);
            formRef.current?.requestSubmit();
          }
        }}
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
