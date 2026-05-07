import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";

const SYSTEM = `당신은 사고의 두 갈래를 비교하는 분석가입니다. 두 텍스트를 받아 다음 4개 섹션으로 한국어 답변하세요. 매우 간결하게.

## 공통점
- 두 답이 모두 인정하는 것 / 같은 가정

## 차이
- 한쪽은 강조하고 다른 쪽은 안 한 것
- 강조점·결론·접근의 차이

## 빠진 시각
- 둘 다 다루지 않은 것 / 무의식적 가정

## 한 줄 종합
- 사용자가 이 둘에서 무엇을 얻고 어디로 가야 하는지

각 섹션은 짧은 불릿 2-3개로. 군더더기 없이.`;

type NodeRef = { id: string; text: string; convTitle: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const a: NodeRef = body.a;
    const b: NodeRef = body.b;
    if (!a?.text?.trim() || !b?.text?.trim()) {
      return NextResponse.json({ error: "두 노드의 텍스트가 필요합니다" }, { status: 400 });
    }
    const reply = await complete({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `## 노드 A (#${a.id} · ${a.convTitle})\n${a.text.slice(0, 1500)}\n\n## 노드 B (#${b.id} · ${b.convTitle})\n${b.text.slice(0, 1500)}`,
        },
      ],
      maxTokens: 700,
    });
    return NextResponse.json({ result: reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[/api/compare]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
