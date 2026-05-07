import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const { userText }: { userText: string } = await req.json();
    if (!userText?.trim()) return NextResponse.json({ title: "" });
    const title = await complete({
      system:
        "사용자의 첫 질문/메시지를 보고 그 대화의 제목을 만드세요. 한국어로, 12자 이내, 따옴표·마침표·물음표 없이, 명사구로. 제목만 출력하세요.",
      messages: [{ role: "user", content: userText.slice(0, 600) }],
      maxTokens: 40,
    });
    const cleaned = title
      .trim()
      .replace(/^["'`「『]+|["'`」』]+$/g, "")
      .replace(/[.!?。！？]+$/g, "")
      .slice(0, 40);
    return NextResponse.json({ title: cleaned });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, title: "" }, { status: 500 });
  }
}
