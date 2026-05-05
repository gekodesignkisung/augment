"use client";

import { useEffect, useState } from "react";
import type { ConvNode, ViewSpecKind } from "@/lib/types";
import { toast } from "./Toast";

const LENSES: { kind: ViewSpecKind; label: string; tip: string }[] = [
  { kind: "summary", label: "5초 요약", tip: "한 문장으로 압축합니다" },
  { kind: "threeLine", label: "3줄 핵심", tip: "핵심을 세 줄로 정리합니다" },
  { kind: "counter", label: "반대 관점", tip: "반대편의 시선을 보여줍니다" },
  { kind: "nextQuestions", label: "다음 질문", tip: "이어질 질문 3개를 제안합니다" },
];

export default function ViewSpecPane({
  node,
  openWhy,
}: {
  node: ConvNode | null;
  openWhy: (topic: string) => void;
}) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState<ViewSpecKind>("summary");

  // Reset active to first tab whenever node changes
  useEffect(() => {
    setActive("summary");
  }, [node?.id]);

  const run = async (kind: ViewSpecKind) => {
    if (!node?.text) return;
    setBusy(kind);
    try {
      const r = await fetch("/api/viewspec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text: node.text }),
      });
      const data = await r.json();
      setResults((prev) => ({ ...prev, [`${node.id}:${kind}`]: data.text ?? data.error }));
    } finally {
      setBusy(null);
    }
  };

  const onSelectTab = (kind: ViewSpecKind) => {
    setActive(kind);
    if (node?.text && !results[`${node.id}:${kind}`] && busy !== kind) {
      run(kind);
    }
  };

  const activeLabel = LENSES.find((l) => l.kind === active)?.label ?? "";
  const activeText = node ? results[`${node.id}:${active}`] : null;

  return (
    <>
      <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center justify-between px-5">
        <div className="text-[15px] font-medium">다른 시각으로 보기</div>
        <button
          onClick={() => openWhy("viewspec")}
          className="text-[var(--text-muted)] hover:text-[var(--text)] text-[13px] px-2 py-0.5 rounded border border-[var(--border)]"
        >
          ?
        </button>
      </header>

      {!node ? (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-[14px] text-[var(--text-muted)] leading-relaxed">
            <div className="mb-2 text-[var(--text)]">노드를 선택하세요.</div>
            <div>
              하나의 답변을 5초 요약·3줄 핵심·반대 관점·다음 질문 등 여러 시각으로 다시 볼 수 있습니다.
            </div>
          </div>
        </div>
      ) : !node.text ? (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-[14px] text-[var(--text-dim)]">텍스트가 없는 노드입니다.</div>
        </div>
      ) : (
        <>
          {/* Tabs — paper bookmark style */}
          <div className="shrink-0 flex items-end px-5 pt-4 gap-6 border-b border-[var(--border)]">
            {LENSES.map((l) => {
              const isActive = active === l.kind;
              return (
                <button
                  key={l.kind}
                  onClick={() => onSelectTab(l.kind)}
                  title={l.tip}
                  className={`relative pb-2 text-[13px] transition-colors ${
                    isActive
                      ? "text-[var(--text)] font-medium"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {l.label}
                  <span
                    aria-hidden
                    className={`absolute left-0 right-0 -bottom-px h-[2px] transition-colors ${
                      isActive ? "bg-[var(--accent)]" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Active result */}
          <div className="flex-1 overflow-y-auto p-5">
            {busy === active ? (
              <div className="flex items-center gap-2 text-[14px] text-[var(--text-muted)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                {activeLabel} 생성 중…
              </div>
            ) : activeText ? (
              <div className="fade-in">
                {active === "nextQuestions" ? (
                  <NextQuestionsList text={activeText} />
                ) : (
                  <div className="text-[15px] text-[var(--text)] whitespace-pre-wrap leading-[1.7]">
                    {activeText}
                  </div>
                )}
                <button
                  onClick={() => run(active)}
                  className="mt-4 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  ↻ 다시 생성
                </button>
              </div>
            ) : (
              <button
                onClick={() => run(active)}
                className="text-[14px] text-[var(--text-muted)] hover:text-[var(--accent)]"
              >
                {activeLabel} 생성하기
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

function NextQuestionsList({ text }: { text: string }) {
  // Parse "1) ...", "1. ...", "- ..." style lines into individual questions
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const questions = lines.map((line) =>
    line.replace(/^\s*(?:\d+[.)]\s*|[-•]\s*)/, "").trim()
  );

  const useQuestion = (q: string) => {
    window.dispatchEvent(new CustomEvent("augment:send", { detail: q }));
    toast("질문 전송 — 답변을 생성 중입니다");
  };

  return (
    <div className="space-y-2">
      <div className="text-[12px] text-[var(--text-muted)] mb-1">
        클릭하면 즉시 전송됩니다.
      </div>
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => useQuestion(q)}
          className="w-full text-left px-3 py-2.5 rounded-md border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] text-[14px] text-[var(--text)] leading-relaxed transition-colors group flex items-start gap-2"
        >
          <span className="text-[var(--accent)] font-mono text-[12px] mt-0.5 shrink-0">
            {i + 1}.
          </span>
          <span className="flex-1">{q}</span>
          <span className="text-[var(--text-dim)] group-hover:text-[var(--accent)] text-[12px] mt-0.5 shrink-0">
            ↩
          </span>
        </button>
      ))}
    </div>
  );
}
