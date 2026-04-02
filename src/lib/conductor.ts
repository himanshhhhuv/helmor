export type GroupTone = "done" | "review" | "progress" | "backlog" | "canceled";

export type WorkspaceRow = {
  id: string;
  title: string;
  avatar: string;
  active?: boolean;
  directoryName?: string;
  repoName?: string;
  state?: string;
  derivedStatus?: string;
  manualStatus?: string | null;
  branch?: string | null;
  activeSessionId?: string | null;
  activeSessionTitle?: string | null;
  activeSessionAgentType?: string | null;
  activeSessionStatus?: string | null;
  prTitle?: string | null;
  sessionCount?: number;
  messageCount?: number;
  attachmentCount?: number;
};

export type WorkspaceGroup = {
  id: string;
  label: string;
  tone: GroupTone;
  rows: WorkspaceRow[];
};

export type ConductorFixtureInfo = {
  dataMode: string;
  fixtureRoot: string;
  dbPath: string;
  archiveRoot: string;
};

export type WorkspaceSummary = {
  id: string;
  title: string;
  directoryName: string;
  repoName: string;
  state: string;
  derivedStatus: string;
  manualStatus?: string | null;
  active: boolean;
  branch?: string | null;
  activeSessionId?: string | null;
  activeSessionTitle?: string | null;
  activeSessionAgentType?: string | null;
  activeSessionStatus?: string | null;
  prTitle?: string | null;
  sessionCount?: number;
  messageCount?: number;
  attachmentCount?: number;
};

export type WorkspaceDetail = {
  id: string;
  title: string;
  repoId: string;
  repoName: string;
  remoteUrl?: string | null;
  defaultBranch?: string | null;
  rootPath?: string | null;
  directoryName: string;
  state: string;
  derivedStatus: string;
  manualStatus?: string | null;
  active: boolean;
  activeSessionId?: string | null;
  activeSessionTitle?: string | null;
  activeSessionAgentType?: string | null;
  activeSessionStatus?: string | null;
  branch?: string | null;
  initializationParentBranch?: string | null;
  intendedTargetBranch?: string | null;
  notes?: string | null;
  pinnedAt?: string | null;
  prTitle?: string | null;
  prDescription?: string | null;
  archiveCommit?: string | null;
  sessionCount: number;
  messageCount: number;
  attachmentCount: number;
};

export type WorkspaceSessionSummary = {
  id: string;
  workspaceId: string;
  title: string;
  agentType?: string | null;
  status: string;
  model?: string | null;
  permissionMode: string;
  claudeSessionId?: string | null;
  unreadCount: number;
  contextTokenCount: number;
  contextUsedPercent?: number | null;
  thinkingEnabled: boolean;
  codexThinkingLevel?: string | null;
  fastMode: boolean;
  agentPersonality?: string | null;
  createdAt: string;
  updatedAt: string;
  lastUserMessageAt?: string | null;
  resumeSessionAt?: string | null;
  isHidden: boolean;
  isCompacting: boolean;
  active: boolean;
};

export type SessionMessageRecord = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  contentIsJson: boolean;
  parsedContent?: unknown;
  createdAt: string;
  sentAt?: string | null;
  cancelledAt?: string | null;
  model?: string | null;
  sdkMessageId?: string | null;
  lastAssistantMessageId?: string | null;
  turnId?: string | null;
  isResumableMessage?: boolean | null;
  attachmentCount: number;
};

export type SessionAttachmentRecord = {
  id: string;
  sessionId: string;
  sessionMessageId?: string | null;
  attachmentType?: string | null;
  originalName?: string | null;
  path?: string | null;
  pathExists: boolean;
  isLoading: boolean;
  isDraft: boolean;
  createdAt: string;
};

const DEFAULT_WORKSPACE_GROUPS: WorkspaceGroup[] = [
  {
    id: "done",
    label: "Done",
    tone: "done",
    rows: [
      {
        id: "task-detail",
        title: "feat: task detail window with e...",
        avatar: "F",
      },
    ],
  },
  {
    id: "review",
    label: "In review",
    tone: "review",
    rows: [
      {
        id: "coda-publish",
        title: "feat: add Coda publish function...",
        avatar: "F",
      },
      {
        id: "marketing-site",
        title: "Implement new marketing site ...",
        avatar: "I",
      },
      {
        id: "gitlab-publish",
        title: "feat: add GitLab publish suppor...",
        avatar: "F",
      },
    ],
  },
  {
    id: "progress",
    label: "In progress",
    tone: "progress",
    rows: [
      {
        id: "cambridge",
        title: "Cambridge",
        avatar: "C",
      },
      {
        id: "project-paths",
        title: "Show project paths",
        avatar: "S",
        active: true,
      },
      {
        id: "mermaid",
        title: "Investigate mermaid confluence",
        avatar: "I",
      },
      {
        id: "seo",
        title: "Feat seo optimization",
        avatar: "F",
      },
      {
        id: "autoresearch",
        title: "Explore autoresearch",
        avatar: "E",
      },
      {
        id: "chat-list",
        title: "Fix chat list pending",
        avatar: "F",
      },
      {
        id: "doc-sync",
        title: "Investigate doc sync",
        avatar: "I",
      },
    ],
  },
  {
    id: "backlog",
    label: "Backlog",
    tone: "backlog",
    rows: [],
  },
  {
    id: "canceled",
    label: "Canceled",
    tone: "canceled",
    rows: [],
  },
];

const DEFAULT_ARCHIVED_WORKSPACES: WorkspaceSummary[] = [
  {
    id: "archived-coda-publish",
    title: "feat: add Coda publish function...",
    directoryName: "coda-publish",
    repoName: "sample",
    state: "archived",
    derivedStatus: "done",
    active: false,
  },
  {
    id: "archived-marketing-site",
    title: "Implement new marketing site ...",
    directoryName: "marketing-site",
    repoName: "sample",
    state: "archived",
    derivedStatus: "review",
    active: false,
  },
  {
    id: "archived-gitlab-publish",
    title: "feat: add GitLab publish suppor...",
    directoryName: "gitlab-publish",
    repoName: "sample",
    state: "archived",
    derivedStatus: "review",
    active: false,
  },
];

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

async function getTauriInvoke(): Promise<TauriInvoke | null> {
  try {
    const api = await import("@tauri-apps/api/core");
    return api.invoke as TauriInvoke;
  } catch {
    return null;
  }
}

export async function loadWorkspaceGroups(): Promise<WorkspaceGroup[]> {
  const invoke = await getTauriInvoke();

  if (!invoke) {
    return DEFAULT_WORKSPACE_GROUPS;
  }

  try {
    return await invoke<WorkspaceGroup[]>("list_workspace_groups");
  } catch {
    return DEFAULT_WORKSPACE_GROUPS;
  }
}

export async function loadFixtureInfo(): Promise<ConductorFixtureInfo | null> {
  const invoke = await getTauriInvoke();

  if (!invoke) {
    return null;
  }

  try {
    return await invoke<ConductorFixtureInfo>("get_conductor_fixture_info");
  } catch {
    return null;
  }
}

export async function loadArchivedWorkspaces(): Promise<WorkspaceSummary[]> {
  const invoke = await getTauriInvoke();

  if (!invoke) {
    return DEFAULT_ARCHIVED_WORKSPACES;
  }

  try {
    return await invoke<WorkspaceSummary[]>("list_archived_workspaces");
  } catch {
    return DEFAULT_ARCHIVED_WORKSPACES;
  }
}

export async function loadWorkspaceDetail(
  workspaceId: string,
): Promise<WorkspaceDetail | null> {
  const invoke = await getTauriInvoke();

  if (!invoke) {
    return null;
  }

  try {
    return await invoke<WorkspaceDetail>("get_workspace", { workspaceId });
  } catch {
    return null;
  }
}

export async function loadWorkspaceSessions(
  workspaceId: string,
): Promise<WorkspaceSessionSummary[]> {
  const invoke = await getTauriInvoke();

  if (!invoke) {
    return [];
  }

  try {
    return await invoke<WorkspaceSessionSummary[]>("list_workspace_sessions", {
      workspaceId,
    });
  } catch {
    return [];
  }
}

export async function loadSessionMessages(
  sessionId: string,
): Promise<SessionMessageRecord[]> {
  const invoke = await getTauriInvoke();

  if (!invoke) {
    return [];
  }

  try {
    return await invoke<SessionMessageRecord[]>("list_session_messages", {
      sessionId,
    });
  } catch {
    return [];
  }
}

export async function loadSessionAttachments(
  sessionId: string,
): Promise<SessionAttachmentRecord[]> {
  const invoke = await getTauriInvoke();

  if (!invoke) {
    return [];
  }

  try {
    return await invoke<SessionAttachmentRecord[]>("list_session_attachments", {
      sessionId,
    });
  } catch {
    return [];
  }
}

export { DEFAULT_WORKSPACE_GROUPS };
