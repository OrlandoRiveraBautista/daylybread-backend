import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { AI_CONFIG } from "./config";

export type SermonPromptTemplate = {
  system: string;
  human: string;
};

export type SermonMessageInput = {
  sermonTitle?: string;
  sermonContent?: string;
  highlightedText?: string;
  additionalContext?: string;
  customPrompt?: string;
  language?: string;
};

/**
 * Shared prompt variable assembly for batch + streaming sermon AI paths.
 */
export function buildSermonPromptVariables(input: SermonMessageInput): {
  context: string;
  highlightedText: string;
  additionalContext: string;
  customPrompt: string;
} {
  let contextText = "";
  if (input.sermonTitle) {
    contextText = `Sermon Title: "${input.sermonTitle}"`;
    if (input.sermonContent) {
      contextText += `\n\nCurrent sermon content:\n${input.sermonContent.substring(
        0,
        AI_CONFIG.sermonContentMaxChars
      )}`;
    }
  } else {
    contextText = input.customPrompt || "General sermon assistance";
  }

  const highlightedTextSection = input.highlightedText
    ? `\n\nHighlighted/Selected text to work with:\n${input.highlightedText}`
    : "";

  const additionalContextSection = input.additionalContext
    ? `\n\nAdditional context: ${input.additionalContext}`
    : "";

  const languageInstruction = input.language
    ? `\n\nCRITICAL: Respond ENTIRELY in ${input.language}. Do not use English or any other language.`
    : "";

  const reminderInstruction = input.sermonTitle
    ? `\n\nREMINDER: All content must directly relate to and support the sermon title "${input.sermonTitle}".`
    : "";

  return {
    context: contextText,
    highlightedText: highlightedTextSection,
    additionalContext:
      additionalContextSection + languageInstruction + reminderInstruction,
    customPrompt: input.customPrompt || "",
  };
}

function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template
    .replace(/\{context\}/g, vars.context)
    .replace(/\{highlightedText\}/g, vars.highlightedText)
    .replace(/\{additionalContext\}/g, vars.additionalContext)
    .replace(/\{customPrompt\}/g, vars.customPrompt);
}

/**
 * Build the exact OpenAI messages used by both invoke and stream paths.
 */
export function buildSermonMessages(
  baseSystemInstruction: string,
  template: SermonPromptTemplate,
  input: SermonMessageInput
): BaseMessage[] {
  const vars = buildSermonPromptVariables(input);
  const systemPrompt = `${baseSystemInstruction}\n\n${template.system}`;
  const humanPrompt = fillTemplate(template.human, vars);
  return [new SystemMessage(systemPrompt), new HumanMessage(humanPrompt)];
}

export function extractVerseReferences(content: string): string[] {
  const versePattern = /(\d?\s?[A-Za-z]+\s+\d+:\d+(?:-\d+)?)/g;
  const verses = content.match(versePattern) || [];
  return [...new Set(verses)];
}

/** Loose UUID / opaque session id check (reject empty / tiny / path-like values). */
export function isValidAiSessionId(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  return /^[A-Za-z0-9_-]{8,128}$/.test(sessionId);
}
