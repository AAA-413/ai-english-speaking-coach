import { NextResponse } from "next/server";
import { mockTranscript, transcribeAudio } from "@/server/analysis";
import { shouldUseMockAnalysis } from "@/server/env";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const turnId = body.turnId || `turn_${Date.now()}`;

  if (!shouldUseMockAnalysis() && body.audioBase64) {
    try {
      return NextResponse.json(await transcribeAudio({
        sessionId: id,
        turnId,
        audioBase64: body.audioBase64,
        mimeType: body.mimeType,
        fileName: body.fileName,
        language: body.language || "en",
      }));
    } catch (error) {
      return NextResponse.json({
        sessionId: id,
        turnId,
        transcript: body.roughTranscript || mockTranscript(body.referenceText),
        confidence: 0.5,
        source: body.roughTranscript ? "rough_transcript" : "mock",
        providerError: error instanceof Error ? error.message : "OpenAI transcription failed",
      });
    }
  }

  return NextResponse.json({
    sessionId: id,
    turnId,
    transcript: body.roughTranscript || mockTranscript(body.referenceText),
    confidence: 0.86,
    source: body.roughTranscript ? "rough_transcript" : "mock",
  });
}
