export type DrawingStatus = "indexed" | "dirty" | "saved" | "stale" | "conflict";

export type EditorSaveStatus = "loading" | "saved" | "dirty" | "saving" | "stale" | "conflict" | "error";

export type EditorSaveState = {
  status: EditorSaveStatus;
  baseSha?: string;
  remoteSha?: string;
  commitSha?: string;
  message?: string;
};

export type UserRole = "owner" | "collaborator" | "viewer";
export type SessionRole = UserRole;
export type SessionLifecycleStatus = "active" | "closed" | "saved";

export type DrawingFile = {
  path: string;
  sha: string;
  lastCommit: string;
  status: DrawingStatus;
  repositoryId?: string;
};

export type DrawingContent = {
  path: string;
  sha: string;
  content: unknown;
};

export type SaveDrawingInput = {
  path: string;
  sha: string;
  content: unknown;
  message?: string;
};

export type SaveDrawingResult = {
  path: string;
  commitSha: string;
  contentSha: string;
};

export type Participant = {
  handle: string;
  role: UserRole;
  scope: string;
  lastJoined: string;
};

export type RepositoryRecord = {
  id: string;
  githubRepositoryId: number;
  owner: string;
  name: string;
  branch: string;
  htmlUrl: string;
  apiUrl: string;
  private: boolean;
  status: "ready" | "syncing" | "empty" | "error";
  lastScanAt?: string;
  drawingCount?: number;
  error?: string;
};

export type AvailableGitHubRepository = {
  githubRepositoryId: number;
  owner: string;
  name: string;
  fullName: string;
  branch: string;
  htmlUrl: string;
  apiUrl: string;
  private: boolean;
};

export type RepositoryInput = {
  owner: string;
  name: string;
  branch: string;
};

export type CollaborationSession = {
  id: string;
  repositoryId: string;
  drawingPath: string;
  status: SessionLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  shareLinks?: {
    collaborator: string;
    viewer: string;
  };
  participants?: SessionParticipant[];
  collab?: CollabSessionRuntime;
};

export type SessionParticipant = {
  sessionId: string;
  githubUserId: number;
  githubLogin: string;
  displayName: string;
  avatarUrl: string | null;
  assignedRole: "collaborator" | "viewer";
  firstJoinedAt: string;
  lastJoinedAt: string;
};

export type CollaborationSessionSnapshot = {
  sessionId: string;
  drawingPath: string;
  revision: number;
  content: unknown;
  updatedAt: string;
  updatedBy: string;
};

export type SessionSaveResult = {
  path: string;
  commitSha: string;
  contentSha: string;
  snapshotRevision: number;
};

export type SessionAuditEvent = {
  id: string;
  type:
    | "session_created"
    | "session_joined"
    | "snapshot_updated"
    | "yjs_updated"
    | "client_kicked"
    | "session_status_changed"
    | "session_closed";
  at: string;
  actor: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type CollabSessionRuntime = {
  status: "registered" | "unreachable" | "error" | "unknown";
  serverUrl: string;
  sessionStatus?: SessionLifecycleStatus;
  snapshotRevision?: number;
  snapshotUpdatedAt?: string | null;
  snapshotUpdatedBy?: string | null;
  yjsRevision?: number;
  yjsStateBytes?: number;
  yjsUpdatedAt?: string | null;
  yjsUpdatedBy?: string | null;
  presenceCount?: number;
  presence?: CollabPresenceClient[];
  audit?: SessionAuditEvent[];
  roomName?: string;
  lastCheckedAt: string;
  error?: string;
};

export type CollabPresenceClient = {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  role?: SessionRole;
  joinedAt: string;
};

export type CollabCursor = {
  socketId: string;
  pointer: { x: number; y: number } | null;
  button?: "up" | "down";
  displayName?: string;
  color?: string;
  selectedElementIds?: string[];
};

export type CollabServerStatus = {
  url: string;
  reachable: boolean;
  service?: string;
  transport?: string;
  checkedAt: string;
  sessionCount: number;
  activeSessionCount: number;
  error?: string;
};
