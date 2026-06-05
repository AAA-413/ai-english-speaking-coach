import { NextResponse } from "next/server";
import { createHealthResponse } from "@/server/realtime";

export function GET() {
  return NextResponse.json(createHealthResponse());
}
