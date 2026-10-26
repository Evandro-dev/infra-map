/** Simple typed JSON client. Never claim a JSON body on empty GET/DELETE requests. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch('/api/v1' + path, { ...options, headers });
  if (!response.ok) {
    const json: unknown = await response.json().catch(() => null);
    const message =
      json && typeof json === 'object' && 'error' in json && typeof json.error === 'string'
        ? json.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (response.status === 204 || response.status === 205) return undefined as T;
  return response.json() as Promise<T>;
}
