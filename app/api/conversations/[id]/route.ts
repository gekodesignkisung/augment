import { NextRequest, NextResponse } from "next/server";
import { deleteConversation, getConversation, saveConversation } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const conv = await getConversation(id);
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(conv);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  if (body.id !== id) {
    return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  }
  await saveConversation(body);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const conv = await getConversation(id);
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (typeof body.title === "string") {
    conv.title = body.title.trim().slice(0, 80) || conv.title;
  }
  await saveConversation(conv);
  return NextResponse.json(conv);
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await deleteConversation(id);
  return NextResponse.json({ ok: true });
}
