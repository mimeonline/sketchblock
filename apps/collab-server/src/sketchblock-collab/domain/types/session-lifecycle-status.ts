export type SessionLifecycleStatus = "active" | "closed" | "saved";

export const sessionLifecycleStatuses = ["active", "closed", "saved"] as const satisfies readonly SessionLifecycleStatus[];
