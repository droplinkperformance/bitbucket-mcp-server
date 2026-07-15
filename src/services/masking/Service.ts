export interface Input {
  value: unknown;
}

export interface Data {
  masked: unknown;
}

export interface Output {
  data: Data;
}

const SENSITIVE_KEY_PATTERN =
  /(authorization|auth|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|api[_-]?key|bearer|cookie|set-cookie)/i;

const TOKEN_LIKE_PATTERNS: RegExp[] = [
  // Bearer/Basic headers
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,
  // access_token / refresh_token query or body params
  /((?:access|refresh)_token=)[^&\s"]+/gi,
  // JWT-like tokens
  /\beyJ[A-Za-z0-9._-]{10,}/g,
];

const REDACTED = '[REDACTED]';

/**
 * Provider-agnostic secret masking. Used everywhere we log or surface request
 * metadata so tokens, refresh tokens, authorization headers and secrets are
 * never written out.
 */
export class Service {
  execute(input: Input): Output {
    return { data: { masked: this.mask(input.value) } };
  }

  mask<T>(value: T): T {
    return this.maskValue(value, 0) as T;
  }

  maskString(value: string): string {
    let out = value;
    for (const pattern of TOKEN_LIKE_PATTERNS) {
      out = out.replace(pattern, (match, p1) => {
        // For "key=value" style patterns keep the key prefix.
        if (typeof p1 === 'string' && p1.endsWith('=')) {
          return `${p1}${REDACTED}`;
        }
        if (typeof p1 === 'string' && (p1 === 'Bearer' || p1 === 'Basic')) {
          return `${p1} ${REDACTED}`;
        }
        return REDACTED;
      });
    }
    return out;
  }

  private maskValue(value: unknown, depth: number): unknown {
    if (depth > 8) {
      return value;
    }
    if (typeof value === 'string') {
      return this.maskString(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.maskValue(item, depth + 1));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          out[key] = REDACTED;
        } else {
          out[key] = this.maskValue(val, depth + 1);
        }
      }
      return out;
    }
    return value;
  }
}

export const maskingService = new Service();
