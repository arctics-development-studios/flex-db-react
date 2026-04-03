// ─────────────────────────────────────────────
//  FlexDB React SDK · Public API
//  Import everything you need from this one file.
// ─────────────────────────────────────────────

// ── Provider & context ─────────────────────────────────────────────────────
export { FlexDBProvider, useFlexDB } from "./src/context.js";
export type { FlexDBProviderProps } from "./src/context.js";

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useHealth } from "./src/hooks/useHealth.js";
export { useGet } from "./src/hooks/useGet.js";
export { useCreate } from "./src/hooks/useCreate.js";
export { useSet } from "./src/hooks/useSet.js";
export { useDelete } from "./src/hooks/useDelete.js";
export { useList, useListHydrated } from "./src/hooks/useList.js";
export { useSearch, useSearchHydrated } from "./src/hooks/useSearch.js";

// ── Core client (escape hatch) ─────────────────────────────────────────────
export { FlexDBClient } from "./src/core/client.js";

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  // Config
  FlexDBConfig,
  RetryConfig,

  // Data shapes
  SearchParams,
  SearchParamValue,
  FilterOperators,
  Filters,

  // Raw API responses
  CreateResponse,
  SetResponse,
  GetResponse,
  DeleteResponse,
  ListIdsResponse,
  ListItemsResponse,

  // Hook state shapes
  HookState,
  UseGetState,
  UseMutationState,
  PaginatedState,
} from "./src/core/types.js";

// ── Hook option types ──────────────────────────────────────────────────────
export type { UseGetOptions } from "./src/hooks/useGet.js";
export type { UseCreateOptions, CreateArgs } from "./src/hooks/useCreate.js";
export type { UseSetOptions, SetArgs } from "./src/hooks/useSet.js";
export type { UseDeleteOptions, DeleteArgs } from "./src/hooks/useDelete.js";
export type { UseListOptions, UseListHydratedOptions } from "./src/hooks/useList.js";
export type { UseSearchOptions, UseSearchHydratedOptions } from "./src/hooks/useSearch.js";

// ── Errors ─────────────────────────────────────────────────────────────────
export { FlexDBError, FlexDBNetworkError } from "./src/core/types.js";
