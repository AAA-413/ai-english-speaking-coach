"use client";

import { useRef, useState } from "react";
import type { PronunciationAudio } from "@/shared/practice";

export function usePronunciationRecorder(onEvent?: (type: string, detail: string) => void) {
  const [audio, setAudio] = useState<PronunciationAudio | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function toggleRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      return;
    }

    setAudio(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = choosePronunciationMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    const startedAt = performance.now();
    recorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("stop", async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const nextAudio = {
        base64: await blobToBase64(blob),
        mimeType: blob.type || "audio/webm",
        sizeBytes: blob.size,
        durationMs: Math.round(performance.now() - startedAt),
        recordedAt: new Date().toISOString(),
      };
      setAudio(nextAudio);
      onEvent?.("pronunciation:recorded", `${nextAudio.mimeType} / ${nextAudio.sizeBytes} bytes`);
    });

    recorder.start();
    setIsRecording(true);
    onEvent?.("pronunciation:record", "started");
  }

  return {
    audio,
    isRecording,
    setAudio,
    toggleRecording,
  };
}

function choosePronunciationMimeType() {
  const options = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("loadend", () => resolve(String(reader.result).split(",")[1] || ""));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}
