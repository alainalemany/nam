import type {
  KnowledgeContentKind,
  KnowledgeContextKind,
  KnowledgeTrust,
} from "@prisma/client";

import {
  knowledgeContentKinds,
  knowledgeContextKinds,
  knowledgeListMaximumPage,
  knowledgeListMaximumSearchLength,
  knowledgeMaximumIdentifierLength,
} from "./constants";
import { codePointLength, normalizeSingleLineText } from "./normalization";

export const knowledgeListLifecycleValues = ["ACTIVE", "ARCHIVED", "ALL"] as const;
export const knowledgeListSortValues = ["UPDATED_DESC", "TITLE_ASC"] as const;
export const knowledgeListTrustValues = ["UNVERIFIED", "PERSONALLY_REVIEWED"] as const;
export const knowledgeListParameterNames = [
  "q",
  "lifecycle",
  "kind",
  "trust",
  "context",
  "mineId",
  "equipmentId",
  "sort",
  "page",
] as const;

export type KnowledgeListLifecycle = (typeof knowledgeListLifecycleValues)[number];
export type KnowledgeListSort = (typeof knowledgeListSortValues)[number];
export type KnowledgeListSearchParams = Record<string, string | string[] | undefined>;
export type KnowledgeListFilters = Readonly<{
  q?: string;
  lifecycle: KnowledgeListLifecycle;
  kind?: KnowledgeContentKind;
  trust?: KnowledgeTrust;
  context?: KnowledgeContextKind;
  mineId?: string;
  equipmentId?: string;
  sort: KnowledgeListSort;
  page: number;
}>;
export type ParsedKnowledgeListFilters = Readonly<{
  filters: KnowledgeListFilters;
  invalidParameters: readonly string[];
}>;

const supported = new Set<string>(knowledgeListParameterNames);
const kinds = new Set<string>(knowledgeContentKinds);
const trusts = new Set<string>(knowledgeListTrustValues);
const contexts = new Set<string>(knowledgeContextKinds);
const lifecycles = new Set<string>(knowledgeListLifecycleValues);
const sorts = new Set<string>(knowledgeListSortValues);
const positiveInteger = /^[1-9]\d*$/u;
const safeIdentifier = /^[^\u0000-\u001f\u007f]+$/u;

function firstString(
  value: unknown,
  name: string,
  invalid: Set<string>,
): string | undefined {
  if (Array.isArray(value)) {
    invalid.add(name);
    value = value[0];
  }
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    invalid.add(name);
    return undefined;
  }
  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    invalid.add(name);
    return undefined;
  }
  const normalized = normalizeSingleLineText(value);
  return normalized || undefined;
}

function firstIdentifier(
  value: unknown,
  name: string,
  invalid: Set<string>,
) {
  if (Array.isArray(value)) {
    invalid.add(name);
    value = value[0];
  }
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    invalid.add(name);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) {
    invalid.add(name);
    return undefined;
  }
  return trimmed;
}

export function parseKnowledgeListFilters(
  searchParams: KnowledgeListSearchParams,
): ParsedKnowledgeListFilters {
  const invalid = new Set<string>();
  const parsed: {
    q?: string;
    lifecycle: KnowledgeListLifecycle;
    kind?: KnowledgeContentKind;
    trust?: KnowledgeTrust;
    context?: KnowledgeContextKind;
    mineId?: string;
    equipmentId?: string;
    sort: KnowledgeListSort;
    page: number;
  } = { lifecycle: "ACTIVE", sort: "UPDATED_DESC", page: 1 };

  if (Object.keys(searchParams).some((key) => !supported.has(key))) {
    invalid.add("unsupported parameters");
  }

  const q = firstString(searchParams.q, "q", invalid);
  if (q) {
    if (codePointLength(q) <= knowledgeListMaximumSearchLength) parsed.q = q;
    else invalid.add("q");
  }

  const enumValues = [
    ["lifecycle", lifecycles],
    ["kind", kinds],
    ["trust", trusts],
    ["context", contexts],
    ["sort", sorts],
  ] as const;
  for (const [name, accepted] of enumValues) {
    const value = firstString(searchParams[name], name, invalid);
    if (!value) continue;
    if (!accepted.has(value)) {
      invalid.add(name);
      continue;
    }
    if (name === "lifecycle") parsed.lifecycle = value as KnowledgeListLifecycle;
    else if (name === "kind") parsed.kind = value as KnowledgeContentKind;
    else if (name === "trust") parsed.trust = value as KnowledgeTrust;
    else if (name === "context") parsed.context = value as KnowledgeContextKind;
    else parsed.sort = value as KnowledgeListSort;
  }

  for (const name of ["mineId", "equipmentId"] as const) {
    const value = firstIdentifier(searchParams[name], name, invalid);
    if (!value) continue;
    if (
      codePointLength(value) <= knowledgeMaximumIdentifierLength &&
      safeIdentifier.test(value)
    ) {
      parsed[name] = value;
    } else invalid.add(name);
  }

  const page = firstString(searchParams.page, "page", invalid);
  if (page) {
    const numeric = Number(page);
    if (
      positiveInteger.test(page) &&
      Number.isSafeInteger(numeric) &&
      numeric <= knowledgeListMaximumPage
    ) {
      parsed.page = numeric;
    } else invalid.add("page");
  }

  return { filters: parsed, invalidParameters: [...invalid].slice(0, 10) };
}

export function hasKnowledgeListFilters(filters: KnowledgeListFilters) {
  return Boolean(
    filters.q ||
      filters.lifecycle !== "ACTIVE" ||
      filters.kind ||
      filters.trust ||
      filters.context ||
      filters.mineId ||
      filters.equipmentId ||
      filters.sort !== "UPDATED_DESC",
  );
}

export function knowledgeListHref(
  filters: KnowledgeListFilters,
  overrides: Partial<KnowledgeListFilters> = {},
) {
  const next = { ...filters, ...overrides };
  const viewKeys = [
    "q",
    "lifecycle",
    "kind",
    "trust",
    "context",
    "mineId",
    "equipmentId",
    "sort",
  ] as const;
  if (
    viewKeys.some(
      (key) => key in overrides && overrides[key] !== filters[key],
    )
  ) {
    next.page = 1;
  }
  const parameters = new URLSearchParams();
  if (next.q) parameters.set("q", next.q);
  if (next.lifecycle !== "ACTIVE") parameters.set("lifecycle", next.lifecycle);
  if (next.kind) parameters.set("kind", next.kind);
  if (next.trust) parameters.set("trust", next.trust);
  if (next.context) parameters.set("context", next.context);
  if (next.mineId) parameters.set("mineId", next.mineId);
  if (next.equipmentId) parameters.set("equipmentId", next.equipmentId);
  if (next.sort !== "UPDATED_DESC") parameters.set("sort", next.sort);
  if (next.page > 1) parameters.set("page", String(next.page));
  const query = parameters.toString();
  return query ? `/knowledge-base?${query}` : "/knowledge-base";
}
