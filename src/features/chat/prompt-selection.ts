import type { ChatMessageInput, PromptSummary } from "../../types/domain";

export function rememberedPrompt(
  prompts: PromptSummary[],
  versionId: string | null,
): PromptSummary | null {
  if (!versionId) return null;
  return prompts.find((prompt) => prompt.latestVersionId === versionId) ?? null;
}

export function chatMessagesWithSystemPrompt(
  systemPrompt: string | null,
  history: ChatMessageInput[],
  userContent: string,
): ChatMessageInput[] {
  const messages: ChatMessageInput[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push(...history, { role: "user", content: userContent });
  return messages;
}
