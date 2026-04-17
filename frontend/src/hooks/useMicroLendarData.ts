import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiSelfUser } from "../types/selfUser";

export interface ApiCalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  color: string;
  calendar: string;
  description?: string;
  location?: string;
  attendees?: { id: string; name: string; avatarUrl: string }[];
  isTask?: boolean;
  isCompleted?: boolean;
  isConflict?: boolean;
  taskType?: string;
  order?: number;
  rsvpStatus?: "yes" | "maybe" | "no" | null;
}

export interface ApiTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string | null;
}

export interface ApiTaskConfig {
  environment: string;
  duration: number;
  selfUser?: ApiSelfUser;
}

export function useMicroLendarData() {
  const [events, setEvents] = useState<ApiCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [config, setConfig] = useState<ApiTaskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configLoaded = useRef(false);
  const mismatch = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(() => {
    if (mismatch.current) return;

    if (!configLoaded.current) {
      fetch("/api/data/config")
        .then((r) => {
          if (!r.ok) throw new Error(`Config fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data: ApiTaskConfig) => {
          if (data.environment !== "microlendar") {
            mismatch.current = true;
            setError(
              `Environment mismatch: server is running "${data.environment}" but this is the MicroLendar UI.`
            );
            setIsLoading(false);
            return;
          }
          configLoaded.current = true;
          setConfig(data);
        })
        .catch(() => {});
    }

    // Poll events and tasks in parallel
    Promise.all([
      fetch("/api/data/microlendar-events"),
      fetch("/api/data/microlendar-tasks"),
    ])
      .then(async ([eventsRes, tasksRes]) => {
        if (!eventsRes.ok) throw new Error(`Events fetch failed: ${eventsRes.status}`);
        if (!tasksRes.ok) throw new Error(`Tasks fetch failed: ${tasksRes.status}`);

        const [eventsData, tasksData] = await Promise.all([
          eventsRes.json(),
          tasksRes.json(),
        ]);

        setEvents(eventsData.events ?? []);
        setTasks(tasksData.tasks ?? []);
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

  // Mutation helpers

  const createEvent = useCallback(
    async (body: {
      title: string;
      date: string;
      time?: string;
      endTime?: string;
      calendar?: string;
      description?: string;
      location?: string;
    }): Promise<{ success: boolean; event?: ApiCalendarEvent }> => {
      const res = await fetch("/api/data/microlendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (!res) return { success: false };
      return res.json();
    },
    []
  );

  const updateEvent = useCallback(
    async (
      eventId: string,
      body: {
        title?: string;
        date?: string;
        time?: string;
        endTime?: string;
        calendar?: string;
        description?: string;
        location?: string;
      }
    ): Promise<{ success: boolean }> => {
      const res = await fetch(`/api/data/microlendar-events/${eventId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (!res) return { success: false };
      return res.json();
    },
    []
  );

  const deleteEvent = useCallback(async (eventId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/data/microlendar-events/${eventId}/delete`, {
      method: "POST",
    }).catch(() => null);
    if (!res) return { success: false };
    return res.json();
  }, []);

  const createTask = useCallback(
    async (body: {
      title: string;
      dueDate?: string;
    }): Promise<{ success: boolean; task?: ApiTask }> => {
      const res = await fetch("/api/data/microlendar-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (!res) return { success: false };
      return res.json();
    },
    []
  );

  const toggleTask = useCallback(async (taskId: string): Promise<{ success: boolean; completed?: boolean }> => {
    const res = await fetch(`/api/data/microlendar-tasks/${taskId}/complete`, {
      method: "POST",
    }).catch(() => null);
    if (!res) return { success: false };
    return res.json();
  }, []);

  const deleteTask = useCallback(async (taskId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/data/microlendar-tasks/${taskId}/delete`, {
      method: "POST",
    }).catch(() => null);
    if (!res) return { success: false };
    return res.json();
  }, []);

  return {
    events,
    tasks,
    config,
    isLoading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    createTask,
    toggleTask,
    deleteTask,
  };
}
