import { NextResponse } from "next/server";
import { scenarios } from "@/shared/scenarios";

export function GET() {
  return NextResponse.json({
    scenarios,
    count: scenarios.length,
  });
}
