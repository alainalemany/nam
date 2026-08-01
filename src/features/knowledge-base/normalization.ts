import { KnowledgeBaseError } from "./errors";
import {
  knowledgeMaximumExternalReferenceUrlLength,
} from "./constants";

export function codePointLength(value: string) {
  return Array.from(value).length;
}

export function normalizePlainText(value: string) {
  return value.replace(/\r\n?/gu, "\n").trim();
}

export function normalizeSingleLineText(value: string) {
  return normalizePlainText(value).replace(/\s+/gu, " ");
}

export function normalizeTitleKey(value: string) {
  return normalizeSingleLineText(value).normalize("NFKC").toLocaleLowerCase("en-US");
}

export function normalizeMarkdownSource(value: string) {
  const lines = value.replace(/\r\n?/gu, "\n").split("\n");
  while (lines.length > 0 && lines[0]?.trim().length === 0) lines.shift();
  while (lines.length > 0 && lines.at(-1)?.trim().length === 0) lines.pop();
  return lines.join("\n");
}

export function normalizeHttpsUrl(value: string, field = "externalReferences") {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    codePointLength(trimmed) > knowledgeMaximumExternalReferenceUrlLength ||
    /[\u0000-\u001f\u007f]/u.test(trimmed)
  ) {
    throw new KnowledgeBaseError(
      "UNSAFE_LINK",
      "Each external reference requires a valid HTTPS URL.",
      field,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new KnowledgeBaseError(
      "UNSAFE_LINK",
      "Each external reference requires a valid HTTPS URL.",
      field,
    );
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.hostname.length === 0
  ) {
    throw new KnowledgeBaseError(
      "UNSAFE_LINK",
      "Only credential-free HTTPS links are allowed.",
      field,
    );
  }
  if (trimmed.endsWith("#") && parsed.hash.length === 0) parsed.hash = "";
  const normalized = parsed.toString();
  if (codePointLength(normalized) > knowledgeMaximumExternalReferenceUrlLength) {
    throw new KnowledgeBaseError(
      "UNSAFE_LINK",
      "Each external reference requires a valid HTTPS URL.",
      field,
    );
  }
  return normalized;
}
