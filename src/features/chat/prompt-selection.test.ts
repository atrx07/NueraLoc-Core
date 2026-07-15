import { describe, expect, it } from "vitest";
import type { PromptSummary } from "../../types/domain";
import { chatMessagesWithSystemPrompt, rememberedPrompt } from "./prompt-selection";

const prompt: PromptSummary = {
  profileId: "profile-1",
  stableName: "Reviewer",
  collection: "Coding",
  pinned: true,
  latestVersionId: "version-2",
  latestVersion: 2,
  description: null,
  tags: ["review"],
  sourcePath: null,
  createdAt: "2026-07-15T00:00:00Z",
  updatedAt: "2026-07-15T00:00:00Z",
};

describe("prompt selection", () => {
  it("restores only an available immutable version", () => {
    expect(rememberedPrompt([prompt], "version-2")).toEqual(prompt);
    expect(rememberedPrompt([prompt], "version-1")).toBeNull();
  });

  it("places the system prompt before conversation history", () => {
    expect(chatMessagesWithSystemPrompt(
      "Review precisely.",
      [{ role: "user", content: "Earlier" }, { role: "assistant", content: "Answer" }],
      "Now inspect this",
    )).toEqual([
      { role: "system", content: "Review precisely." },
      { role: "user", content: "Earlier" },
      { role: "assistant", content: "Answer" },
      { role: "user", content: "Now inspect this" },
    ]);
  });

  it("does not invent a system layer for the default option", () => {
    expect(chatMessagesWithSystemPrompt(null, [], "Hello")).toEqual([
      { role: "user", content: "Hello" },
    ]);
  });
});
