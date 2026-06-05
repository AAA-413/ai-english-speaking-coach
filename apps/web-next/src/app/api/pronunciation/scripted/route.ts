import { NextResponse } from "next/server";
import { assessAzurePronunciation, createMockPronunciationAssessment } from "@/server/pronunciation";
import { shouldUseMockPronunciation } from "@/server/env";
import type { ScenarioId } from "@/shared/practice";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const scenarioId = (body.scenarioId || "job_interview") as ScenarioId;
  const referenceText = body.referenceText || "Could I get a medium latte with oat milk, please?";

  if (!shouldUseMockPronunciation() && body.audioBase64) {
    try {
      const result = await assessAzurePronunciation({
        scenarioId,
        referenceText,
        audioBase64: body.audioBase64,
        mimeType: body.mimeType,
        durationMs: body.durationMs,
        language: body.language || "en-US",
      });
      return NextResponse.json({
        ...result,
        audioReceived: true,
        mimeType: body.mimeType || null,
        durationMs: body.durationMs || null,
      });
    } catch (error) {
      const assessment = createMockPronunciationAssessment({ scenarioId, referenceText });
      assessment.audioReceived = true;
      assessment.mimeType = body.mimeType || null;
      assessment.durationMs = body.durationMs || null;
      assessment.providerError = error instanceof Error ? error.message : "Azure pronunciation failed";
      return NextResponse.json(assessment);
    }
  }

  const assessment = createMockPronunciationAssessment({ scenarioId, referenceText });
  assessment.audioReceived = Boolean(body.audioBase64);
  assessment.mimeType = body.mimeType || null;
  assessment.durationMs = body.durationMs || null;
  return NextResponse.json(assessment);
}
