import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type {
  CollabSessionRuntime,
  DrawingStatus,
  EditorSaveStatus,
  SessionLifecycleStatus,
  UserRole,
} from "@/types/sketchblock";

type StatusBadgeProps = {
  value:
    | DrawingStatus
    | EditorSaveStatus
    | SessionLifecycleStatus
    | UserRole
    | CollabSessionRuntime["status"]
    | "active"
    | "offline"
    | "online"
    | "ready"
    | "empty"
    | "syncing"
    | "indexed"
    | "error";
};

const styles: Record<StatusBadgeProps["value"], string> = {
  indexed: "border-success/25 bg-success/8 text-success-foreground",
  active: "border-success/25 bg-success/8 text-success-foreground",
  closed: "border-border bg-muted text-muted-foreground",
  online: "border-success/25 bg-success/8 text-success-foreground",
  registered: "border-success/25 bg-success/8 text-success-foreground",
  ready: "border-success/25 bg-success/8 text-success-foreground",
  empty: "border-warning/25 bg-warning/10 text-warning-foreground",
  syncing: "border-info/25 bg-info/8 text-info-foreground",
  saved: "border-success/25 bg-success/8 text-success-foreground",
  loading: "border-border bg-muted text-muted-foreground",
  offline: "border-border bg-muted text-muted-foreground",
  unknown: "border-border bg-muted text-muted-foreground",
  dirty: "border-warning/25 bg-warning/10 text-warning-foreground",
  saving: "border-info/25 bg-info/8 text-info-foreground",
  stale: "border-warning/25 bg-warning/10 text-warning-foreground",
  conflict: "border-destructive/25 bg-destructive/8 text-destructive",
  error: "border-destructive/25 bg-destructive/8 text-destructive",
  unreachable: "border-destructive/25 bg-destructive/8 text-destructive",
  owner: "border-info/25 bg-info/8 text-info-foreground",
  collaborator: "border-primary/20 bg-primary/8 text-primary",
  viewer: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const t = useTranslations("Common.status");
  return (
    <Badge variant="outline" className={styles[value]}>
      {t(value)}
    </Badge>
  );
}
