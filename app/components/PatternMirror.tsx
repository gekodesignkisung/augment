"use client";

import { useEffect, useState } from "react";
import type { Conversation, UsagePattern } from "@/lib/types";

export default function PatternMirror({ conv }: { conv: Conversation | null }) {
  const [pattern, setPattern] = useState<UsagePattern | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch("/api/pattern");
      setPattern(await r.json());
    } catch {}
  };

  useEffect(() => {
    refresh();
  }, [conv?.updatedAt]);

  if (!pattern) return null;

  const totalNodes = pattern.nodesCreated;
  const usedViewSpec = pattern.viewSpecsUsed > 0;

  let hint: string | null = null;
  if (totalNodes > 4 && !usedViewSpec) {
    hint = "ViewSpec을 한 번도 안 쓰셨어요. 우측에서 답변을 다른 시각으로 봐보세요.";
  } else if (totalNodes > 6 && pattern.branchesCreated === 0) {
    hint = "분기를 한 번도 안 만드셨어요. 답변의 한 문장을 클릭해보세요.";
  } else if (totalNodes > 8 && pattern.promotions === 0) {
    hint = "좋은 답변을 ★ 승격해보세요. 결정 기록이 누적됩니다.";
  }

  return (
    <div className="border-t border-[var(--border)] p-3 text-[13px] text-[var(--text-muted)] leading-relaxed">
      <div className="text-[12px] font-medium text-[var(--text-muted)] mb-2">사용 패턴</div>
      <div className="grid grid-cols-2 gap-y-1 gap-x-3">
        <div>생각 <span className="text-[var(--text)] font-medium">{pattern.nodesCreated}</span></div>
        <div>분기 <span className="text-[var(--text)] font-medium">{pattern.branchesCreated}</span></div>
        <div>다른 시각 <span className="text-[var(--text)] font-medium">{pattern.viewSpecsUsed}</span></div>
        <div>승격 <span className="text-[var(--text)] font-medium">{pattern.promotions}</span></div>
      </div>
      {hint && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] text-[var(--accent)] text-[13px] leading-snug">
          💡 {hint}
        </div>
      )}
    </div>
  );
}
