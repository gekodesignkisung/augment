import { NextRequest, NextResponse } from "next/server";
import {
  bumpPattern,
  createConversation,
  listConversations,
  saveConversation,
} from "@/lib/storage";

export async function GET() {
  const list = await listConversations();
  return NextResponse.json(
    list.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      nodeCount: Object.keys(c.nodes).length,
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title : "새 대화";
  const conv = createConversation(title);
  await saveConversation(conv);
  await bumpPattern({ conversationsCreated: 1 });
  return NextResponse.json(conv);
}
