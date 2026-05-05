"use client";

import { useEffect } from "react";

const TOPICS: Record<string, { title: string; body: string[] }> = {
  intro: {
    title: "왜 이 도구는 이렇게 생겼나?",
    body: [
      "Augment는 더글러스 엥겔바트(1925–2013)의 철학에서 출발합니다. 그는 컴퓨터를 *답을 주는 기계*가 아니라, **인간이 더 어려운 질문을 다룰 수 있게 해주는 사고의 외골격**으로 보았습니다.",
      "그래서 이 도구는 ChatGPT와 다릅니다. 답을 던져주고 끝나는 것이 아니라 — 사고의 가지를 보존하고, 다른 시각으로 재렌더링하고, 좋은 결정을 승격해 누적시킵니다.",
      "처음엔 어색할 수 있습니다. 엥겔바트 자신도 *\"좋은 도구는 처음엔 어렵다\"*고 했습니다. 한두 번 써보면 *왜 채팅이 일자였는지*가 오히려 이상해질 겁니다.",
    ],
  },
  tree: {
    title: "왜 트리인가?",
    body: [
      "사고는 일직선으로 흐르지 않습니다. 하나의 질문에서 여러 갈래가 자라나고, 그중 일부만 결실을 맺습니다.",
      "일반 채팅 UI는 그 갈래를 *평평하게 누릅니다*. 과거 대화는 스크롤 무덤에 묻히고, 다른 가능성은 사라집니다.",
      "트리 뷰는 사고의 자연스러운 모양을 보존합니다. 각 노드는 주소(#id)를 가지며, 좌측 트리에서 언제든 다시 그 지점으로 점프할 수 있습니다. — 1968년 NLS의 *purple number* 사상.",
    ],
  },
  branch: {
    title: "분기는 왜 있는가?",
    body: [
      "AI 응답에서 가장 흥미로운 부분은 보통 *한 문장*입니다. 그런데 그 문장에 대해 더 묻고 싶을 때, 일반 채팅에서는 컨텍스트가 흐려집니다.",
      "Augment에서는 응답의 어느 문장이든 클릭하면, **그 문장을 컨텍스트로 들고 새 가지가 시작**됩니다. 메인 줄기는 그대로 보존됩니다.",
      "이게 \"하나의 정답\"이 아니라 \"탐색된 가능성의 지도\"를 만드는 방식입니다.",
    ],
  },
  viewspec: {
    title: "ViewSpec — 다른 렌즈로 보기",
    body: [
      "엥겔바트의 NLS는 *같은 데이터를 사용자가 원하는 시점으로* 즉석 변환할 수 있었습니다. 같은 문서를 1단계 헤딩만 / 인용만 / 시간순 등으로.",
      "Augment의 ViewSpec은 그 사상을 사고에 적용합니다. 같은 답변을:",
      "• **5초 요약** — 결론 한 문장",
      "• **3줄 핵심** — 자기완결적 세 줄",
      "• **반대 관점** — 빠진 시각, 약한 가정",
      "• **다음 질문** — 사고를 잇는 후속 질문 3개",
      "답이 아니라 *렌즈*를 갈아끼우는 경험입니다.",
    ],
  },
  promote: {
    title: "Promote — 좋은 가지를 승격",
    body: [
      "여러 가지 중 하나가 결실을 맺으면, ★ 버튼으로 그 노드를 **승격**할 수 있습니다.",
      "승격된 노드는 시각적으로 강조되고, 트리에서 별표로 표시됩니다. 나중에 \"이 대화에서 결정된 것\"을 한눈에 찾을 수 있는 *결정 기록*이 됩니다.",
      "이것이 엥겔바트가 말한 **DKR(Dynamic Knowledge Repository)** 의 씨앗입니다 — 일이 끝나면 사라지는 채팅이 아니라, 누적되는 살아있는 기억.",
    ],
  },
  pattern: {
    title: "사용 패턴 거울",
    body: [
      "엥겔바트는 조직 활동을 A(본업) / B(본업 개선) / C(개선 자체 개선) 세 층으로 나눴습니다. 대부분의 사람은 A에만 머뭅니다.",
      "좌하단의 작은 위젯은 당신이 도구를 *어떻게 쓰는지*를 보여주는 거울입니다 — 분기 빈도, ViewSpec 사용 패턴, 승격 횟수.",
      "이건 잔소리가 아니라, B 레이어(자기 작업 방식의 관찰)의 첫 걸음입니다. 보지 않으면 개선할 수 없습니다.",
    ],
  },
};

export default function WhyPanel({
  open,
  topic,
  onClose,
}: {
  open: boolean;
  topic: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const t = TOPICS[topic] ?? TOPICS.intro;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 fade-in" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-screen w-[480px] bg-[var(--bg-elev)] border-l border-[var(--border)] z-50 flex flex-col fade-in shadow-2xl">
        <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center justify-between px-6">
          <div className="text-[13px] font-medium text-[var(--accent)]">왜?</div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-[13px]"
          >
            닫기 (Esc)
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-7">
          <h2 className="text-[22px] font-semibold mb-5 text-[var(--text)] leading-tight">
            {t.title}
          </h2>
          <div className="space-y-4 text-[15px] leading-[1.7] text-[var(--text-muted)]">
            {t.body.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {renderInlineMarkdown(p)}
              </p>
            ))}
          </div>

          <div className="mt-10 pt-5 border-t border-[var(--border)] text-[13px] text-[var(--text-muted)] leading-relaxed">
            <div className="mb-2 text-[var(--text)] font-medium">
              — Douglas C. Engelbart
            </div>
            <div className="text-[var(--text-dim)] mb-2">
              <em>Augmenting Human Intellect: A Conceptual Framework</em> (1962)
            </div>
            <div className="italic">
              "우리는 특정 상황에서 도움이 되는 고립된 영리한 트릭을 말하는 것이 아니다.
              직감, 시행착오, 무형의 것, 인간의 \"감각\"이 강력한 개념·세련된 용어·정교한 전자 도구·
              고급 방법론과 *유용하게 공존*하는 통합된 영역의 *삶의 방식*을 말한다."
            </div>
          </div>

          <nav className="mt-6 pt-5 border-t border-[var(--border)] flex flex-wrap gap-2">
            {Object.keys(TOPICS).map((k) => (
              <a
                key={k}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent("augment:why", { detail: k }));
                }}
                className={`text-[13px] px-3 py-1.5 rounded-md border transition-colors ${
                  topic === k
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-card)]"
                }`}
              >
                {TOPICS[k].title.split(" ")[0].replace(/[?,]/g, "")}
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Lightweight: **bold** and *italic*
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="text-[var(--text)] font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <em key={key++} className="text-[var(--text)] italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
