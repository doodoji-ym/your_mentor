"use client";

import { useState } from "react";

// 클릭하면 전체화면으로 크게 보기. 학생/교사 뷰 공용.
export function ZoomableImage({
  src,
  alt = "이미지",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        className={
          className ??
          "mb-3 max-h-56 w-full cursor-zoom-in rounded border object-contain"
        }
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full cursor-zoom-out object-contain"
          />
        </div>
      )}
    </>
  );
}
