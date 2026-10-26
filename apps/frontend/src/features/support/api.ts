import { api } from '@/lib/api';

export function secureRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('x-support-token', token);
  return api<T>('/support' + path, { ...options, headers, cache: 'no-store' });
}
