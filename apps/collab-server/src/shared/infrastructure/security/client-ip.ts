export type ResolveClientIpInput = {
  forwardedFor?: string | string[] | null;
  remoteAddress?: string | null;
  trustProxy: boolean;
};

export function resolveClientIp({ forwardedFor, remoteAddress, trustProxy }: ResolveClientIpInput): string {
  if (trustProxy) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const first = raw?.split(",")[0]?.trim();
    if (first) return first;
  }

  return remoteAddress || "unknown";
}
