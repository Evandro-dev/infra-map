export interface SearchableOption {
  value: string;
  key?: string;
  label?: string;
  detail?: string;
}
export interface SearchablePage<T extends SearchableOption> {
  items: T[];
  page: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}
export interface SearchableRequest {
  search: string;
  page: number;
  pageSize: number;
  signal: AbortSignal;
}
export type SearchableLoader<T extends SearchableOption> = (
  request: SearchableRequest,
) => Promise<SearchablePage<T>>;
