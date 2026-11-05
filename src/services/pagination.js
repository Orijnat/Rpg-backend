const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePaginationQuery(query = {}, options = {}) {
  const requested = ["page", "limit", "search", "q"].some((key) => query[key] !== undefined);
  const pageRaw = Number.parseInt(query.page, 10);
  const limitRaw = Number.parseInt(query.limit, 10);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT;
  const search = String(query.search ?? query.q ?? "").trim().slice(0, 100);
  return { requested, page, limit, offset: (page - 1) * limit, search,
    searchFields: options.searchFields ?? [] };
}
