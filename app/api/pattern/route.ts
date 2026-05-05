import { NextResponse } from "next/server";
import { getPattern } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(await getPattern());
}
