import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { bumpPattern } from "@/lib/storage";
import type { ViewSpecKind } from "@/lib/types";

const PROMPTS: Record<ViewSpecKind, string> = {
  summary:
    "다음 텍스트를 5초 안에 읽을 수 있는 한 문장(최대 30자)으로 압축하세요. 결론만, 수식어 없이.",
  threeLine:
    "다음 텍스트의 핵심을 3줄로 정리하세요. 각 줄은 짧고 자기완결적이어야 합니다. 1) 2) 3) 형식.",
  counter:
    "다음 텍스트의 주장에 대해 가장 강력한 반대 관점 또는 빠진 시각을 제시하세요. 형식: '이 답은 X를 가정하지만 ~' 으로 시작.",
  nextQuestions:
    "다음 텍스트를 읽은 사용자가 자연스럽게 떠올릴 다음 질문 3개를 제안하세요. 번호 형식. 각 질문은 한 줄.",
};

const LABELS: Record<ViewSpecKind, string> = {
  summary: "5초 요약",
  threeLine: "3줄 핵심",
  counter: "반대 관점",
  nextQuestions: "다음 질문",
};

export async function POST(req: NextRequest) {
  try {
    const { kind, text }: { kind: ViewSpecKind; text: string } = await req.json();
    const prompt = PROMPTS[kind];
    if (!prompt) return NextResponse.json({ error: "unknown kind" }, { status: 400 });
    if (!text?.trim()) return NextResponse.json({ error: "empty text" }, { status: 400 });

    const reply = await complete({
      system:
        "당신은 텍스트를 다양한 시각으로 재렌더링하는 ViewSpec 엔진입니다. 한국어로 매우 간결하게 답합니다.",
      messages: [{ role: "user", content: `${prompt}\n\n---\n${text}` }],
      maxTokens: 400,
    });

    await bumpPattern({ viewSpecsUsed: 1, viewSpec: kind });

    return NextResponse.json({ kind, label: LABELS[kind], text: reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
