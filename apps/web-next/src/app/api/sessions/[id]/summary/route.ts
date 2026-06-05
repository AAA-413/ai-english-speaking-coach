import { NextResponse } from "next/server";
import { createMockSummary, createSummary } from "@/server/analysis";
import { shouldUseMockAnalysis } from "@/server/env";
import { getScenario, scenarios } from "@/shared/scenarios";
import type { PracticeTurn } from "@/shared/practice";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const scenario = getScenario(body.scenarioId) || scenarios[0];
  const turns = Array.isArray(body.turns) ? body.turns as PracticeTurn[] : [];
  const input = {
    sessionId: id,
    scenario,
    level: body.level || scenario.level,
    turns,
  };

  if (!shouldUseMockAnalysis()) {
    try {
      return NextResponse.json(await createSummary(input));
    } catch (error) {
      const summary = createMockSummary(input);
      summary.providerError = error instanceof Error ? error.message : "Summary provider failed";
      return NextResponse.json(summary);
    }
  }

  return NextResponse.json(createMockSummary(input));
}
