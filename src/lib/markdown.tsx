"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// 모델이 $...$ 대신 \(...\) / \[...\] 구분자를 쓰는 경우가 많아 remark-math가 못 잡음.
// 렌더 전에 $...$ / $$...$$ 로 정규화한다.
function normalizeMath(s: string): string {
  return s
    .replace(/\\\[/g, () => "$$")
    .replace(/\\\]/g, () => "$$")
    .replace(/\\\(/g, () => "$")
    .replace(/\\\)/g, () => "$");
}

export function MathMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none break-words">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {normalizeMath(children)}
      </ReactMarkdown>
    </div>
  );
}
