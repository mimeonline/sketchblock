export type SecurityHeader = { key: string; value: string };

type SecurityHeaderEnv = Record<string, string | undefined>;

const DEFAULT_COLLAB_URL = "http://localhost:4513";

export function collabConnectSources(raw?: string): string[] {
  try {
    const url = new URL(raw || DEFAULT_COLLAB_URL);
    if (url.protocol !== "http:" && url.protocol !== "https:") return [];
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${wsProtocol}//${url.host}`];
  } catch {
    return [];
  }
}

export function buildSecurityHeaders(env: SecurityHeaderEnv): SecurityHeader[] {
  const connectSrc = [
    "'self'",
    ...collabConnectSources(env.NEXT_PUBLIC_COLLAB_SERVER_URL),
  ].join(" ");

  const reportOnly = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com",
    "font-src 'self' data: https://esm.sh https://unpkg.com",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
  ].join("; ");

  const headers: SecurityHeader[] = [
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Content-Security-Policy",
      value:
        "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
    },
    { key: "Content-Security-Policy-Report-Only", value: reportOnly },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];

  if (env.APP_BASE_URL?.startsWith("https://")) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}
