"use client";

import { useEffect, useRef, useState } from "react";
import { REQUEST_POINTS } from "@/lib/rules";
import type { RequestKind } from "@/lib/types";

type Props = {
  kind: RequestKind;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (target: string) => void;
};

const TITLE: Record<RequestKind, string> = {
  prayer: "누구를 위한 기도인가요?",
  invite_remote: "누구에게 권유하셨나요?",
  invite_face: "누구에게 권유하셨나요?",
};

const LABEL: Record<RequestKind, string> = {
  prayer: "기도부탁",
  invite_remote: "비대면 권유",
  invite_face: "대면 권유",
};

export default function RequestDialog({ kind, busy, onCancel, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("이름을 입력해주세요");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITLE[kind]}
        className="card w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold">{TITLE[kind]}</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {LABEL[kind]} · <span className="font-semibold text-[var(--wheat-deep)]">+{REQUEST_POINTS[kind]}점</span>
        </p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={40}
          placeholder="이름"
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="mt-3 w-full rounded-xl border border-[rgba(124,74,45,0.18)] bg-white px-4 py-3 text-base outline-none focus:border-[var(--wheat)] focus:ring-2 focus:ring-[rgba(224,165,58,0.25)]"
        />
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-ghost px-4 py-2 text-sm">
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="btn btn-primary px-4 py-2 text-sm"
          >
            요청하기
          </button>
        </div>
      </div>
    </div>
  );
}
