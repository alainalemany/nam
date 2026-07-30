export const supplyRequestReferencePageSize = 50;

export type SupplyRequestReferenceSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type SupplyRequestReferenceStatus = "all" | "active" | "inactive";

export type SupplyRequestReferenceFilters = {
  q?: string;
  status: SupplyRequestReferenceStatus;
  page: number;
};

export type ParsedSupplyRequestReferenceFilters = {
  filters: SupplyRequestReferenceFilters;
  ignoredInvalidParameters: boolean;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: string | string[] | undefined) {
  const first = firstValue(value);
  if (first === undefined) return undefined;
  const trimmed = first.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseSupplyRequestReferenceFilters(
  searchParams: SupplyRequestReferenceSearchParams,
): ParsedSupplyRequestReferenceFilters {
  let ignoredInvalidParameters = false;
  const filters: SupplyRequestReferenceFilters = {
    status: "all",
    page: 1,
  };

  const q = clean(searchParams.q);
  if (q) {
    if (q.length <= 200) filters.q = q;
    else ignoredInvalidParameters = true;
  }

  const status = clean(searchParams.status);
  if (status) {
    if (status === "all" || status === "active" || status === "inactive") {
      filters.status = status;
    } else {
      ignoredInvalidParameters = true;
    }
  }

  const page = clean(searchParams.page);
  if (page) {
    const value = Number(page);
    if (/^\d+$/.test(page) && Number.isSafeInteger(value) && value > 0) {
      filters.page = value;
    } else {
      ignoredInvalidParameters = true;
    }
  }

  return { filters, ignoredInvalidParameters };
}

export function hasSupplyRequestReferenceFilters(
  filters: SupplyRequestReferenceFilters,
) {
  return Boolean(filters.q || filters.status !== "all");
}

export function supplyRequestReferencePageHref(
  route: string,
  filters: SupplyRequestReferenceFilters,
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (page !== 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${route}?${query}` : route;
}
