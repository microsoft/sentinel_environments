import { useCallback, useEffect, useRef, useState, useMemo } from "react";

export interface ApiEmail {
  id: string;
  sender: { name: string; email: string; avatarUrl: string };
  subject: string;
  body: string;
  folder: string;
  isRead: boolean;
  isFlagged: boolean;
  isExternal: boolean;
  isCC: boolean;
  hasAttachment: boolean;
  attachment?: { id: string; name: string; size: string };
  recipients: string[];
  cc: string[];
  mentionsMe: boolean;
  importance: string;
  timestamp: string;
}

export interface ApiTaskConfig {
  environment: string;
  duration: number;
}

type ReadOverrides = Map<string, boolean>;
type FlagOverrides = Map<string, boolean>;

export function useMicromailData() {
  const [rawEmails, setRawEmails] = useState<ApiEmail[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local overrides for optimistic UI updates
  const [readOverrides, setReadOverrides] = useState<ReadOverrides>(new Map());
  const [flagOverrides, setFlagOverrides] = useState<FlagOverrides>(new Map());

  // Track whether config has been loaded
  const configLoaded = useRef(false);
  const mismatch = useRef(false);

  // Poll emails every second; retry config until loaded
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          if (data.environment !== "micromail") {
            mismatch.current = true;
            setError(`Environment mismatch: server is running "${data.environment}" but this is the MicroMail UI.`);
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {}); // Will retry on next poll
    }

    // Always poll emails
    fetch("/api/data/micromail-emails")
      .then((r) => {
        if (!r.ok) throw new Error(`Emails fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setRawEmails(data.emails ?? []);
        setError(null);
        setIsLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // Apply local overrides to raw emails
  const emails = useMemo<ApiEmail[]>(() => {
    return rawEmails.map((email) => {
      const isRead = readOverrides.has(email.id)
        ? (readOverrides.get(email.id) as boolean)
        : email.isRead;
      const isFlagged = flagOverrides.has(email.id)
        ? (flagOverrides.get(email.id) as boolean)
        : email.isFlagged;
      return { ...email, isRead, isFlagged };
    });
  }, [rawEmails, readOverrides, flagOverrides]);

  // Mutation helpers
  const markRead = useCallback(async (emailId: string) => {
    setReadOverrides((prev) => new Map(prev).set(emailId, true));
    await fetch(`/api/data/micromail-emails/${emailId}/read`, { method: "POST" }).catch(() => {});
  }, []);

  const markUnread = useCallback(async (emailId: string) => {
    setReadOverrides((prev) => new Map(prev).set(emailId, false));
    await fetch(`/api/data/micromail-emails/${emailId}/unread`, { method: "POST" }).catch(() => {});
  }, []);

  const flagEmail = useCallback(async (emailId: string) => {
    const current = rawEmails.find((e) => e.id === emailId);
    const currentFlagged = flagOverrides.has(emailId)
      ? (flagOverrides.get(emailId) as boolean)
      : current?.isFlagged ?? false;
    setFlagOverrides((prev) => new Map(prev).set(emailId, !currentFlagged));
    await fetch(`/api/data/micromail-emails/${emailId}/flag`, { method: "POST" }).catch(() => {});
  }, [rawEmails, flagOverrides]);

  const moveEmail = useCallback(async (emailId: string, folder: string) => {
    await fetch(`/api/data/micromail-emails/${emailId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    }).catch(() => {});
  }, []);

  const performAction = useCallback(async (action: string) => {
    const res = await fetch(`/api/data/actions/${action}`, { method: "POST" }).catch(() => null);
    if (!res) return { success: false };
    setReadOverrides(new Map());
    setFlagOverrides(new Map());
    return res.json();
  }, []);

  return {
    emails,
    config,
    isLoading,
    error,
    markRead,
    markUnread,
    flagEmail,
    moveEmail,
    performAction,
  };
}
