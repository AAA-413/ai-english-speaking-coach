import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "web-next",
    mode: "parallel_migration",
    contracts: ["scenarios", "turns", "summary", "transcription", "pronunciation"],
  });
}
