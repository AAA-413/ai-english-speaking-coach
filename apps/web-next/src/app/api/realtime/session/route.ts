import { NextResponse } from "next/server";
import { getScenario, scenarios } from "@/shared/scenarios";
import type { CorrectionMode, EnglishLevel, RealtimeProvider } from "@/shared/practice";
import { createRealtimeSession, createSessionId } from "@/server/realtime";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const scenario = getScenario(body.scenarioId) || scenarios[0];
  const sessionId = body.sessionId || createSessionId();
  const provider = normalizeRealtimeProvider(body.provider || process.env.REALTIME_PROVIDER);

  const result = await createRealtimeSession({
    scenario,
    sessionId,
    provider,
    level: body.level as EnglishLevel | undefined,
    correctionMode: body.correctionMode as CorrectionMode | undefined,
    voice: body.voice,
  });

  return NextResponse.json(result);
}

function normalizeRealtimeProvider(value: unknown): RealtimeProvider {
  if (value === "volc_doubao" || value === "mock") return value;
  return "openai";
}
