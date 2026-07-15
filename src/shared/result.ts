/**
 * Universal output envelope. Every use-case / service returns its payload
 * wrapped in `data` so the JSON contract is consistent across the system.
 */
export interface Output<TData> {
  data: TData;
}

export function ok<TData>(data: TData): Output<TData> {
  return { data };
}
