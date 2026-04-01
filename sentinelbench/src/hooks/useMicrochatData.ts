import { useCallback, useEffect, useRef, useState, useMemo } from "react";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string;
  content: string;
  isRead: boolean;
  reactions: { emoji: string; userIds: string[] }[];
  attachments: { name: string; type: string; size?: string; url?: string }[];
  replyToId: string | null;
  timestamp: string;
  order: number;
}

export interface ApiConversation {
  id: string;
  type: "direct" | "group" | "meeting" | "channel";
  name: string;
  participantIds: string[];
  participants?: { id: string; name: string; avatarUrl: string; username?: string; jobTitle?: string }[];
  avatarColor?: string;
  teamId?: string;
  isPinned: boolean;
  isMuted: boolean;
  order: number;
  unreadCount: number;
  lastMessage?: {
    content: string;
    senderName: string;
    timestamp: string;
  };
}

export interface ApiTeam {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  avatarColor: string;
  avatarInitials: string;
  memberCount: number;
  memberIds: string[];
  members?: { id: string; name: string; avatarUrl: string; username?: string; jobTitle?: string }[];
  ownerId: string;
  channels: {
    id: string;
    name: string;
    description?: string;
    unreadCount: number;
    isPinned: boolean;
  }[];
  order: number;
}

export interface ApiCall {
  id: string;
  name: string;
  userId: string | null;
  type: "incoming" | "outgoing" | "group";
  duration: string;
  time: string;
  missed: boolean;
  order: number;
}

export interface ApiTaskConfig {
  environment: string;
  duration: number;
  selfUser?: any;
}

type ReadOverrides = Map<string, boolean>;

export function useMicrochatData() {
  const [rawMessages, setRawMessages] = useState<ApiMessage[]>([]);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local overrides for optimistic UI updates
  const [readOverrides, setReadOverrides] = useState<ReadOverrides>(new Map());

  // Track whether one-time data has been loaded (refs to avoid re-creating fetchData)
  const configLoaded = useRef(false);
  const staticLoaded = useRef(false);
  const mismatch = useRef(false);

  const fetchData = useCallback(() => {
    if (mismatch.current) return;

    // Retry config until loaded
    if (!configLoaded.current) {
      fetch("/api/data/config")
        .then((r) => {
          if (!r.ok) throw new Error(`Config fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data: ApiTaskConfig) => {
          if (data.environment !== "microchat") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroChat UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {}); // Will retry on next poll
    }

    // Retry teams/calls/users until loaded
    if (!staticLoaded.current) {
      Promise.all([
        fetch("/api/data/microchat-teams").then((r) => {
          if (!r.ok) throw new Error(`Teams fetch failed: ${r.status}`);
          return r.json();
        }),
        fetch("/api/data/microchat-calls").then((r) => {
          if (!r.ok) throw new Error(`Calls fetch failed: ${r.status}`);
          return r.json();
        }),
      ])
        .then(([teamsData, callsData]) => {
          staticLoaded.current = true;
          setTeams(teamsData.teams ?? []);
          setCalls(callsData.calls ?? []);
        })
        .catch(() => {}); // Will retry on next poll
    }

    // Always poll messages + conversations
    Promise.all([
      fetch("/api/data/microchat-messages").then((r) => {
        if (!r.ok) throw new Error(`Messages fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch("/api/data/microchat-conversations").then((r) => {
        if (!r.ok) throw new Error(`Conversations fetch failed: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([msgData, convData]) => {
        setRawMessages(msgData.messages ?? []);
        setConversations(convData.conversations ?? []);
        setError(null);
        setIsLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setIsLoading(false);
      });
  }, []);

  // Poll everything every second
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // Apply local overrides to raw messages
  const messages = useMemo<ApiMessage[]>(() => {
    return rawMessages.map((msg) => {
      const isRead = readOverrides.has(msg.id)
        ? (readOverrides.get(msg.id) as boolean)
        : msg.isRead;
      return { ...msg, isRead };
    });
  }, [rawMessages, readOverrides]);

  // Mutation helpers
  const markRead = useCallback(async (messageId: string) => {
    setReadOverrides((prev) => new Map(prev).set(messageId, true));
    await fetch(`/api/data/microchat-messages/${messageId}/read`, { method: "POST" }).catch(
      () => {}
    );
  }, []);

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      await fetch(`/api/data/microchat-messages/${messageId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      }).catch(() => {});
    },
    []
  );

  const muteConversation = useCallback(async (conversationId: string) => {
    await fetch(`/api/data/microchat-conversations/${conversationId}/mute`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const pinConversation = useCallback(async (conversationId: string) => {
    await fetch(`/api/data/microchat-conversations/${conversationId}/pin`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const performAction = useCallback(
    async (action: string) => {
      const res = await fetch(`/api/data/actions/${action}`, {
        method: "POST",
      }).catch(() => null);
      if (!res) return { success: false };
      setReadOverrides(new Map());
      return res.json();
    },
    []
  );

  return {
    messages,
    conversations,
    teams,
    calls,
    config,
    isLoading,
    error,
    markRead,
    reactToMessage,
    muteConversation,
    pinConversation,
    performAction,
  };
}
