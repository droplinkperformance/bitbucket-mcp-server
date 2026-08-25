export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HttpRequest {
  method?: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  parse?: 'json' | 'text';
  timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
  url: string;
}

export interface HttpClient {
  request<T>(request: HttpRequest): Promise<HttpResponse<T>>;
}

export interface HttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly data: unknown;
  readonly url: string;

  constructor(message: string, options: { status: number; headers: Record<string, string>; data: unknown; url: string }) {
    super(message);
    this.name = 'HttpError';
    this.status = options.status;
    this.headers = options.headers;
    this.data = options.data;
    this.url = options.url;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const defaultTimeoutMs = options.timeoutMs ?? 60_000;
  const defaultHeaders = options.headers ?? {};

  return {
    async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
      const url = resolveUrl(options.baseUrl, request.url, request.query);
      const timeoutMs = request.timeoutMs ?? defaultTimeoutMs;
      const headers: Record<string, string> = { ...defaultHeaders, ...request.headers };
      const init: RequestInit = {
        method: request.method ?? 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      };

      if (request.body !== undefined && request.body !== null && init.method !== 'GET') {
        init.body = encodeBody(request.body, headers);
      }

      const response = await fetch(url, init);
      const responseHeaders = headersFromResponse(response);
      const parse = request.parse ?? 'json';
      const data = (await parseBody(response, parse)) as T;

      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status} for ${url}`, {
          status: response.status,
          headers: responseHeaders,
          data,
          url,
        });
      }

      return { data, status: response.status, headers: responseHeaders, url };
    },
  };
}

function resolveUrl(baseUrl: string | undefined, url: string, query?: Record<string, unknown>): string {
  const resolved =
    !baseUrl || /^https?:\/\//i.test(url)
      ? url
      : new URL(url.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  const result = new URL(resolved);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      result.searchParams.set(key, String(value));
    }
  }
  return result.toString();
}

function encodeBody(body: unknown, headers: Record<string, string>): NonNullable<RequestInit['body']> {
  if (body instanceof URLSearchParams) {
    if (!hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    return body;
  }
  if (typeof body === 'string' || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return body as NonNullable<RequestInit['body']>;
  }
  if (!hasHeader(headers, 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }
  return JSON.stringify(body);
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

function headersFromResponse(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

async function parseBody(response: Response, parse: 'json' | 'text'): Promise<unknown> {
  const text = await response.text();
  if (parse === 'text') {
    return text;
  }
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
