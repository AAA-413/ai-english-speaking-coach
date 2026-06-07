import test from "node:test";
import assert from "node:assert/strict";
import { createSummary } from "../lib/openai-summary.mjs";
import { scenarios } from "../lib/scenarios.mjs";

const scenario = scenarios.find((item) => item.id === "job_interview");

test("createSummary uses DeepSeek Chat when DeepSeek credentials are configured", async () => {
  let requestUrl;
  let requestBody;
  const fakeFetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              overallScore: 82,
              scores: {
                pronunciation: 76,
                fluency: 78,
                grammar: 80,
                vocabulary: 77,
                interaction: 84,
              },
              goalCompletion: ["Completed a short self-introduction"],
              corrections: [{
                type: "grammar",
                severity: "medium",
                original: "I am work as product manager for three years.",
                corrected: "I have been working as a product manager for three years.",
                explanationZh: "持续到现在的经历用现在完成进行时。",
                betterExpression: "I've spent the last three years working as a product manager.",
              }],
              betterExpressions: ["I've spent the last three years working as a product manager."],
              pronunciationFocus: "Practice stress in longer interview answers.",
              practiceTasks: ["Repeat your self-introduction in 45 seconds."],
              recommendedPronunciationText: "I have been working as a product manager for three years.",
            }),
          },
        }],
      }),
    };
  };

  const summary = await createSummary({
    sessionId: "sess_deepseek",
    scenario,
    level: "B1",
    turns: [{
      speaker: "user",
      sequence: 1,
      transcript: "I am work as product manager for three years.",
    }],
    env: {
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_TEXT_MODEL: "deepseek-chat",
    },
    fetchImpl: fakeFetch,
  });

  assert.equal(requestUrl, "https://api.deepseek.com/v1/chat/completions");
  assert.equal(requestBody.model, "deepseek-chat");
  assert.equal(requestBody.max_tokens, 8000);
  assert.equal(summary.source, "deepseek_chat");
  assert.equal(summary.overallScore, 82);
});

test("createSummary retries DeepSeek when first response has empty content", async () => {
  const requestBodies = [];
  const fakeFetch = async (_url, options) => {
    requestBodies.push(JSON.parse(options.body));
    if (requestBodies.length === 1) {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: "",
              reasoning_content: "The model reasoned but did not emit JSON content.",
            },
          }],
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              overallScore: 84,
              scores: {
                pronunciation: 78,
                fluency: 80,
                grammar: 82,
                vocabulary: 79,
                interaction: 85,
              },
              goalCompletion: ["Answered the interview prompt"],
              corrections: [{
                type: "expression",
                severity: "low",
                original: "I want improve my communication.",
                corrected: "I want to improve my communication.",
                explanationZh: "want 后面接 to do。",
                betterExpression: "I am working on communicating more clearly.",
              }],
              betterExpressions: ["I am working on communicating more clearly."],
              pronunciationFocus: "Focus on sentence stress.",
              practiceTasks: ["Repeat the corrected answer twice."],
              recommendedPronunciationText: "I want to improve my communication.",
            }),
          },
        }],
      }),
    };
  };

  const summary = await createSummary({
    sessionId: "sess_deepseek_retry",
    scenario,
    level: "B1",
    turns: [{
      speaker: "user",
      sequence: 1,
      transcript: "I want improve my communication.",
    }],
    env: {
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_TEXT_MODEL: "deepseek-chat",
    },
    fetchImpl: fakeFetch,
  });

  assert.equal(requestBodies.length, 2);
  assert.equal(requestBodies[0].max_tokens, 8000);
  assert.equal(requestBodies[1].max_tokens, 12000);
  assert.equal(requestBodies[1].temperature, 0);
  assert.equal(summary.source, "deepseek_chat");
  assert.equal(summary.overallScore, 84);
});
