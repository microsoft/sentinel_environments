import { useState, useEffect, useRef, useMemo, useCallback } from "react";

import { useHashRoute } from "../hooks/useHashRoute";
import { useMicroLendarData, ApiCalendarEvent, ApiTask } from "../hooks/useMicroLendarData";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Search,
  CheckCircle2,
  CheckSquare,
  Plus,
  ChevronDown,
  X,
  Settings,
  LogOut,
  User,
  Users,
  Clock,
  MapPin,
  Bell,
  Calendar as CalendarIcon,
  Trash2,
  Edit3,
  Mail,
  Briefcase,
  Lock,
  MoreVertical,
  Eye,
  EyeOff,
  Check
} from "lucide-react";

export const TASK_ID_MICROLENDAR = "microlendar";

// ============================================================================
// TASK CONFIGURATION (server-driven)
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================



interface CalendarEvent extends ApiCalendarEvent {
  rsvpStatus?: 'yes' | 'maybe' | 'no' | null;
}

interface CalendarCategory {
  id: string;
  name: string;
  color: string;
  checked: boolean;
}

const VIEW = {
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  YEAR: 'year',
  SCHEDULE: 'schedule',
  FOUR_DAYS: '4days',
} as const;

type ViewMode = (typeof VIEW)[keyof typeof VIEW];

const DAY_OFFSETS: Partial<Record<ViewMode, number>> = {
  [VIEW.DAY]: 1,
  [VIEW.WEEK]: 7,
  [VIEW.FOUR_DAYS]: 4,
};

type Task = ApiTask;


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Convert time string to minutes for comparison
const timeToMinutes = (timeStr: string): number => {
  // Handle "HH:MM" format
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1]) * 60 + parseInt(match24[2]);
  }

  // Handle "HH:MMam/pm" format
  const match12 = timeStr.match(/(\d+):(\d+)(am|pm)/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = parseInt(match12[2]);
    const period = match12[3].toLowerCase();
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  return 0;
};



// Get event duration string
const getEventDuration = (startTime: string, endTime?: string): string => {
  if (!endTime) return '1h';
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const durationMinutes = end - start;

  if (durationMinutes < 60) return `${durationMinutes}m`;
  if (durationMinutes % 60 === 0) return `${durationMinutes / 60}h`;
  return `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;
};


// Generate initial calendars
const generateInitialCalendars = (): CalendarCategory[] => [
  { id: 'work', name: 'Work', color: '#039BE5', checked: true },
  { id: 'family', name: 'Family', color: '#33B679', checked: true },
  { id: 'personal', name: 'Personal', color: '#7986CB', checked: true },
  { id: 'tasks', name: 'Tasks', color: '#F6BF26', checked: true },
];

// Fallback date when no scenario-provided initial_date is available.
const FALLBACK_INITIAL_DATE = new Date(2024, 6, 18); // July 18, 2024

// Parse YYYY-MM-DD into a local Date at midnight. Returns null on invalid input.
const parseIsoDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  return Number.isNaN(date.getTime()) ? null : date;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MicroLendar = () => {
  // ---------------------------------------------------------------------------
  // API Data Hook
  // ---------------------------------------------------------------------------
  const {
    events: apiEvents,
    tasks: apiTasks,
    config,
    isLoading: apiIsLoading,
    error,
    createEvent: apiCreateEvent,
    updateEvent: apiUpdateEvent,
    deleteEvent: apiDeleteEvent,
    createTask: apiCreateTask,
    toggleTask: apiToggleTask,
    deleteTask: apiDeleteTask,
  } = useMicroLendarData();

  const currentUser = useMemo(() => {
    const raw = config?.selfUser;
    if (!raw) return null;
    return {
      id: raw.id,
      name: raw.name,
      avatarUrl: raw.avatarUrl,
      email: raw.email,
      username: raw.username,
      jobTitle: raw.jobTitle ?? "",
      location: raw.location ?? "",
      bio: raw.bio ?? "",
      interests: raw.interests ?? [],
    };
  }, [config?.selfUser]);

  const getAttendeeInfo = useCallback((attendee: { id?: string; name?: string; avatarUrl?: string }): { name: string; initials: string; avatarUrl?: string; color: string } => {
    if (!attendee || !attendee.name) {
      return { name: 'Unknown', initials: '?', color: '#9CA3AF' };
    }

    const nameParts = attendee.name.split(' ');
    const initials = nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : attendee.name[0];

    const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899'];
    const colorIndex = parseInt((attendee.id || '').replace('user', ''), 10) % colors.length;

    return {
      name: attendee.name,
      initials: initials.toUpperCase(),
      avatarUrl: attendee.avatarUrl,
      color: colors[colorIndex],
    };
  }, []);

  // Map API data to local CalendarEvent/Task types (add client-only fields like rsvpStatus)
  const events: CalendarEvent[] = useMemo(() =>
    apiEvents.map(e => ({ ...e, rsvpStatus: null as 'yes' | 'maybe' | 'no' | null })),
    [apiEvents]
  );
  const tasks: Task[] = apiTasks;

  // Lock screen state
  const [isSignedOut, setIsSignedOut] = useState(false);

  // UI State
  const [showSidebar, setShowSidebar] = useState(true);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showCreateReminderModal, setShowCreateReminderModal] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formErrors, setFormErrors] = useState<{title?: string; date?: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const [showMoreEventsModal, setShowMoreEventsModal] = useState(false);
  const [selectedDayForMore, setSelectedDayForMore] = useState<Date | null>(null);
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);
  const [otherCalendarsExpanded, setOtherCalendarsExpanded] = useState(true);
  const [myCalendarsExpanded, setMyCalendarsExpanded] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [otherCalendars, setOtherCalendars] = useState([
    { id: 'holidays', name: 'Holidays in US', color: '#8E24AA', checked: true },
    { id: 'birthdays', name: 'Birthdays', color: '#616161', checked: true },
    { id: 'sports', name: 'Sports', color: '#0B8043', checked: false },
  ]);
  const [newCalendarUrl, setNewCalendarUrl] = useState('');
  const [calendarDropdown, setCalendarDropdown] = useState<{ id: string; x: number; y: number } | null>(null);

  // Calendar / navigation state
  const [lendarRoute, setLendarRoute] = useHashRoute<ViewMode>([VIEW.MONTH, VIEW.WEEK, VIEW.DAY, VIEW.YEAR, VIEW.SCHEDULE, VIEW.FOUR_DAYS] as const, VIEW.MONTH);
  const viewMode = lendarRoute.view;
  const setViewMode = useCallback((mode: ViewMode) => setLendarRoute(mode), [setLendarRoute]);
  const [selectedDate, setSelectedDate] = useState(FALLBACK_INITIAL_DATE);
  const [currentMonth, setCurrentMonth] = useState(new Date(FALLBACK_INITIAL_DATE.getFullYear(), FALLBACK_INITIAL_DATE.getMonth(), 1));
  const [calendars, setCalendars] = useState<CalendarCategory[]>(generateInitialCalendars());

  // "Today" marker — scenario-configured start date if provided, else fallback.
  const todayDate = useMemo(() => parseIsoDate(config?.initial_date) ?? FALLBACK_INITIAL_DATE, [config?.initial_date]);

  // When scenario-provided initial_date arrives, jump the view to it once.
  const initialDateApplied = useRef(false);
  useEffect(() => {
    if (initialDateApplied.current) return;
    const parsed = parseIsoDate(config?.initial_date);
    if (!parsed) return;
    setSelectedDate(parsed);
    setCurrentMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    initialDateApplied.current = true;
  }, [config?.initial_date]);

  // Form state
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    time: '09:00',
    endTime: '10:00',
    calendar: 'Work',
    description: '',
    location: '',
    repeat: 'none',
    guests: '',
    notification: '30',
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    dueDate: '',
    notes: '',
  });

  const [reminderForm, setReminderForm] = useState({
    title: '',
    date: '',
    time: '09:00',
  });

  // Settings state
  const [settings, setSettings] = useState({
    defaultView: VIEW.MONTH as ViewMode,
    weekStartsOn: 'sunday' as 'sunday' | 'monday',
    timeFormat: '12h' as '12h' | '24h',
    defaultEventDuration: 60,
    defaultReminder: 30,
    showDeclinedEvents: false,
    showWeekNumbers: false,
    showWeekends: true,
    autoAddInvites: true,
    enableNotifications: true,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (showSearchModal && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchModal]);

  // ---------------------------------------------------------------------------
  // MicroLendar Logo Component
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const navigate = useCallback((direction: 1 | -1) => {
    const dayOffset = DAY_OFFSETS[viewMode];
    if (dayOffset) {
      const offset = direction * dayOffset;
      setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + offset));
      const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + offset);
      setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
    } else if (viewMode === VIEW.YEAR) {
      setCurrentMonth(prev => new Date(prev.getFullYear() + direction, prev.getMonth(), 1));
    } else {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    }
  }, [viewMode, selectedDate]);

  const navigatePrevious = useCallback(() => navigate(-1), [navigate]);
  const navigateNext = useCallback(() => navigate(1), [navigate]);

  const goToToday = useCallback(() => {
    setCurrentMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
    setSelectedDate(todayDate);
  }, [todayDate]);

  const toggleCalendar = useCallback((calendarId: string) => {
    setCalendars(prev => prev.map(cal =>
      cal.id === calendarId ? { ...cal, checked: !cal.checked } : cal
    ));
  }, []);

  const openCreateModal = useCallback((date?: Date) => {
    const eventDate = date || selectedDate;
    setEventForm({
      title: '',
      date: eventDate.toISOString().split('T')[0],
      time: '09:00',
      endTime: '10:00',
      calendar: 'Work',
      description: '',
      location: '',
      repeat: 'none',
      guests: '',
      notification: '30',
    });
    setIsEditMode(false);
    setShowCreateModal(true);
    setShowCreateDropdown(false);
  }, [selectedDate]);

  const openEditModal = useCallback((event: CalendarEvent) => {
    setEventForm({
      title: event.title,
      date: event.date,
      time: event.time || '09:00',
      endTime: event.endTime || '10:00',
      calendar: event.calendar,
      description: event.description || '',
      location: event.location || '',
      repeat: 'none',
      guests: '',
      notification: '30',
    });
    setSelectedEvent(event);
    setIsEditMode(true);
    setShowEventDetails(false);
    setShowCreateModal(true);
  }, []);

  const createEvent = useCallback(async () => {
    const errors: {title?: string; date?: string} = {};
    if (!eventForm.title.trim()) errors.title = 'Title is required';
    if (!eventForm.date) errors.date = 'Date is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsLoading(true);
    await apiCreateEvent({
      title: eventForm.title.trim(),
      date: eventForm.date,
      time: eventForm.time,
      endTime: eventForm.endTime,
      calendar: eventForm.calendar,
      description: eventForm.description,
      location: eventForm.location,
    });
    setShowCreateModal(false);
    setFormErrors({});
    setIsLoading(false);
  }, [eventForm, apiCreateEvent]);

  const updateEvent = useCallback(async () => {
    if (!eventForm.title.trim() || !selectedEvent) return;

    setIsLoading(true);
    await apiUpdateEvent(selectedEvent.id, {
      title: eventForm.title,
      date: eventForm.date,
      time: eventForm.time,
      endTime: eventForm.endTime,
      calendar: eventForm.calendar,
      description: eventForm.description,
      location: eventForm.location,
    });
    setShowCreateModal(false);
    setIsEditMode(false);
    setIsLoading(false);
  }, [eventForm, selectedEvent, apiUpdateEvent]);

  const deleteEvent = useCallback(async (eventId: string) => {
    setIsLoading(true);
    await apiDeleteEvent(eventId);
    setShowEventDetails(false);
    setSelectedEvent(null);
    setIsLoading(false);
  }, [apiDeleteEvent]);

  const createTask = useCallback(async () => {
    if (!taskForm.title.trim()) {
      setFormErrors({ title: 'Task title is required' });
      return;
    }

    setIsLoading(true);
    await apiCreateTask({
      title: taskForm.title.trim(),
      dueDate: taskForm.dueDate || undefined,
    });
    setShowCreateTaskModal(false);
    setTaskForm({ title: '', dueDate: '', notes: '' });
    setFormErrors({});
    setIsLoading(false);
  }, [taskForm, apiCreateTask]);

  const createReminder = useCallback(async () => {
    if (!reminderForm.title.trim()) {
      setFormErrors({ title: 'Reminder title is required' });
      return;
    }

    setIsLoading(true);
    await apiCreateEvent({
      title: reminderForm.title.trim(),
      date: reminderForm.date || selectedDate.toISOString().split('T')[0],
      time: reminderForm.time,
      calendar: 'Personal',
      description: 'Reminder',
    });
    setShowCreateReminderModal(false);
    setReminderForm({ title: '', date: '', time: '09:00' });
    setFormErrors({});
    setIsLoading(false);
  }, [reminderForm, selectedDate, apiCreateEvent]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);
    // Add a visual cue
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedEvent(null);
    setDragOverDate(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(date);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);

    if (!draggedEvent) return;

    // Update the event's date via API
    const newDateStr = targetDate.toISOString().split('T')[0];
    apiUpdateEvent(draggedEvent.id, { date: newDateStr });

    setDraggedEvent(null);
  }, [draggedEvent, apiUpdateEvent]);

  // Show all events for a day ("+X more" button)
  const handleShowMoreEvents = useCallback((day: Date) => {
    setSelectedDayForMore(day);
    setShowMoreEventsModal(true);
  }, []);

  // RSVP handler (cosmetic, client-side only)
  const handleRsvp = useCallback((eventId: string, status: 'yes' | 'maybe' | 'no') => {
    if (selectedEvent?.id === eventId) {
      setSelectedEvent(prev => prev ? { ...prev, rsvpStatus: status } : null);
    }
  }, [selectedEvent]);

  // Toggle other calendar visibility
  const toggleOtherCalendar = useCallback((calendarId: string) => {
    setOtherCalendars(prev => prev.map(cal =>
      cal.id === calendarId ? { ...cal, checked: !cal.checked } : cal
    ));
  }, []);

  // Calendar dropdown menu handler
  const handleCalendarContextMenu = useCallback((e: React.MouseEvent, calendarId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCalendarDropdown({ id: calendarId, x: rect.right + 5, y: rect.top });
  }, []);

  // Show only this calendar
  const showOnlyCalendar = useCallback((calendarId: string) => {
    setCalendars(prev => prev.map(cal => ({
      ...cal,
      checked: cal.id === calendarId
    })));
    setCalendarDropdown(null);
  }, []);

  // Show all calendars
  const showAllCalendars = useCallback(() => {
    setCalendars(prev => prev.map(cal => ({ ...cal, checked: true })));
    setCalendarDropdown(null);
  }, []);

  // Add new calendar from URL
  const handleAddCalendar = useCallback(() => {
    if (!newCalendarUrl.trim()) return;

    const newCal = {
      id: `cal-${Date.now()}`,
      name: newCalendarUrl.includes('@') ? newCalendarUrl : `Calendar ${otherCalendars.length + 1}`,
      color: ['#D50000', '#F4511E', '#33B679', '#039BE5', '#7986CB'][Math.floor(Math.random() * 5)],
      checked: true,
    };

    setOtherCalendars(prev => [...prev, newCal]);
    setNewCalendarUrl('');
    setShowAddCalendarModal(false);
  }, [newCalendarUrl, otherCalendars.length]);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    apiToggleTask(taskId);
  }, [apiToggleTask]);

  const deleteTask = useCallback((taskId: string) => {
    apiDeleteTask(taskId);
  }, [apiDeleteTask]);

  // ---------------------------------------------------------------------------
  // Derived Values
  // ---------------------------------------------------------------------------

  const getCalendarDays = useCallback(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: daysInPrevMonth - i,
        isCurrentMonth: false,
        fullDate: new Date(year, month - 1, daysInPrevMonth - i)
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        isCurrentMonth: true,
        fullDate: new Date(year, month, i)
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        isCurrentMonth: false,
        fullDate: new Date(year, month + 1, i)
      });
    }

    return days;
  }, [currentMonth]);

  const getEventsForDate = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const visibleCalendars = calendars.filter(c => c.checked).map(c => c.name);
    return events.filter(e =>
      e.date === dateStr && visibleCalendars.includes(e.calendar) && !e.isTask
    );
  }, [events, calendars]);

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getVisibleMonthEventCount = useCallback(() => {
    const visibleCalendars = calendars.filter(c => c.checked).map(c => c.name);
    const selectedDateStr = selectedDate.toISOString().split('T')[0];

    return events.filter(e => {
      if (e.isTask) return false;
      if (!visibleCalendars.includes(e.calendar)) return false;
      const [eYear, eMonth] = e.date.split('-').map(Number);

      if (viewMode === VIEW.DAY) {
        return e.date === selectedDateStr;
      } else if (viewMode === VIEW.WEEK) {
        const weekStart = new Date(selectedDate);
        weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const startStr = weekStart.toISOString().split('T')[0];
        const endStr = weekEnd.toISOString().split('T')[0];
        return e.date >= startStr && e.date <= endStr;
      } else if (viewMode === VIEW.FOUR_DAYS) {
        const rangeEnd = new Date(selectedDate);
        rangeEnd.setDate(selectedDate.getDate() + 3);
        const startStr = selectedDateStr;
        const endStr = rangeEnd.toISOString().split('T')[0];
        return e.date >= startStr && e.date <= endStr;
      } else if (viewMode === VIEW.YEAR) {
        return eYear === currentMonth.getFullYear();
      } else {
        return eYear === currentMonth.getFullYear() && eMonth === currentMonth.getMonth() + 1;
      }
    }).length;
  }, [events, calendars, currentMonth, viewMode, selectedDate]);

  const searchEvents = useCallback(() => {
    if (!searchQuery.trim()) return events.filter(e => !e.isTask);
    const query = searchQuery.toLowerCase();
    return events.filter(e =>
      !e.isTask && (
        e.title.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query)
      )
    );
  }, [events, searchQuery]);


  // ---------------------------------------------------------------------------
  // Loading Gate
  // ---------------------------------------------------------------------------
  if (!config || apiIsLoading) {
    const isNetworkError = error && /failed to fetch|networkerror/i.test(error);
    const isNoSession = error && /409/.test(error);
    const isMismatch = error && /environment mismatch/i.test(error);
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md px-6">
          <div className="text-4xl mb-3">📅</div>
          <h1 className="text-xl font-semibold mb-6 text-gray-900">MicroLendar</h1>
          {!error ? (
            <>
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Connecting to MicroLendar...</p>
            </>
          ) : isNetworkError ? (
            <>
              <p className="font-medium mb-2 text-gray-900">Could not connect to the server</p>
              <p className="text-sm text-gray-500 mb-3">Make sure the API server is running on port 8000.</p>
              <p className="text-xs font-mono bg-gray-100 rounded px-3 py-2 text-gray-600 mt-2">uvicorn server.server:app --port 8000</p>
            </>
          ) : isNoSession ? (
            <>
              <p className="font-medium mb-2 text-gray-900">No scenario initialized</p>
              <p className="text-sm text-gray-500 mb-3">The server is running but no scenario has been loaded. Use the CLI harness or POST /init to start a scenario.</p>
              <p className="text-xs font-mono bg-gray-100 rounded px-3 py-2 text-gray-600 mt-2">python -m server.run_simulation &lt;scenario.json&gt;</p>
            </>
          ) : isMismatch ? (
            <>
              <p className="font-medium mb-2 text-gray-900">Wrong environment</p>
              <p className="text-sm text-gray-500 mb-3">{error}</p>
              <p className="text-sm text-gray-500">Navigate to the correct environment from the desktop, or re-init with a MicroLendar scenario.</p>
            </>
          ) : (
            <>
              <p className="font-medium mb-2 text-gray-900">Connection Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-white flex">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left section */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2">
              <img src="desktop/microlendar-icon.png" alt="MicroLendar" className="w-10 h-10 object-contain" />
              <span className="text-xl text-gray-700">MicroLendar</span>
            </div>

            <button onClick={goToToday} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
              Today
            </button>

            <div className="flex items-center gap-2">
              <button onClick={navigatePrevious} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft size={20} />
              </button>
              <button onClick={navigateNext} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xl text-gray-700">
                {viewMode === VIEW.MONTH && monthName}
                {viewMode === VIEW.WEEK && (() => {
                  const weekStart = new Date(selectedDate);
                  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekStart.getDate() + 6);
                  if (weekStart.getMonth() === weekEnd.getMonth()) {
                    return `${weekStart.toLocaleDateString('en-US', { month: 'long' })} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
                  }
                  return `${weekStart.toLocaleDateString('en-US', { month: 'short' })} ${weekStart.getDate()} - ${weekEnd.toLocaleDateString('en-US', { month: 'short' })} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
                })()}
                {viewMode === VIEW.DAY && selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                {viewMode === VIEW.FOUR_DAYS && (() => {
                  const rangeEnd = new Date(selectedDate);
                  rangeEnd.setDate(selectedDate.getDate() + 3);
                  if (selectedDate.getMonth() === rangeEnd.getMonth()) {
                    return `${selectedDate.toLocaleDateString('en-US', { month: 'long' })} ${selectedDate.getDate()} - ${rangeEnd.getDate()}, ${selectedDate.getFullYear()}`;
                  }
                  return `${selectedDate.toLocaleDateString('en-US', { month: 'short' })} ${selectedDate.getDate()} - ${rangeEnd.toLocaleDateString('en-US', { month: 'short' })} ${rangeEnd.getDate()}, ${rangeEnd.getFullYear()}`;
                })()}
                {viewMode === VIEW.YEAR && currentMonth.getFullYear()}
                {viewMode === VIEW.SCHEDULE && monthName}
              </span>
              <span className="text-sm text-gray-500 font-medium px-3 py-1 bg-gray-100 rounded-full">
                {getVisibleMonthEventCount()} {getVisibleMonthEventCount() === 1 ? 'event' : 'events'}
              </span>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearchModal(true)} className="p-2 hover:bg-gray-100 rounded-full">
              <Search size={20} />
            </button>
            <button onClick={() => setShowTasksPanel(!showTasksPanel)} className="p-2 hover:bg-gray-100 rounded-full">
              <CheckCircle2 size={20} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowViewDropdown(!showViewDropdown)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm capitalize">{viewMode}</span>
                <ChevronDown size={16} />
              </button>

              {showViewDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {([
                    { value: VIEW.DAY, label: 'Day' },
                    { value: VIEW.WEEK, label: 'Week' },
                    { value: VIEW.MONTH, label: 'Month' },
                    { value: VIEW.YEAR, label: 'Year' },
                    { value: VIEW.SCHEDULE, label: 'Schedule' },
                    { value: VIEW.FOUR_DAYS, label: '4 Days' },
                  ] as { value: ViewMode; label: string }[]).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { setViewMode(value); setShowViewDropdown(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${viewMode === value ? 'bg-blue-50 text-blue-600' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
                title={currentUser?.name || 'User'}
              >
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                    {currentUser ? currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'U'}
                  </div>
                )}
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      {currentUser?.avatarUrl ? (
                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                          {currentUser ? currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'U'}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold">{currentUser?.name || 'User Account'}</p>
                        <p className="text-xs text-gray-500">{currentUser?.email || 'user@microlendar.com'}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowProfileModal(true); setShowProfileDropdown(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                  >
                    <User size={16} />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => { setShowSettingsModal(true); setShowProfileDropdown(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                  >
                    <Settings size={16} />
                    <span>Settings</span>
                  </button>
                  <div className="border-t border-gray-200"></div>
                  <button
                    onClick={() => setIsSignedOut(true)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 text-red-600"
                  >
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div className={`fixed left-0 top-14 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto pt-4 px-4`}>
          {/* Create button */}
          <div className="relative mb-6">
            <button
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-full hover:bg-gray-50 shadow-sm w-full"
            >
              <Plus size={20} className="text-blue-600" />
              <span className="font-medium">Create</span>
              <ChevronDown size={16} className="ml-auto" />
            </button>

            {showCreateDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => openCreateModal()}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                >
                  <CalendarIcon size={16} />
                  <span>Event</span>
                </button>
                <button
                  onClick={() => { setShowCreateTaskModal(true); setShowCreateDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                >
                  <CheckSquare size={16} />
                  <span>Task</span>
                </button>
                <button
                  onClick={() => { setShowCreateReminderModal(true); setShowCreateDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                >
                  <Bell size={16} />
                  <span>Reminder</span>
                </button>
              </div>
            )}
          </div>

          {/* Mini Month Calendar */}
          <div className="mb-6">
            {(() => {
              const miniCalendarDays = (() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                const startDayOfWeek = firstDay.getDay();

                const days: { date: number; isCurrentMonth: boolean; fullDate: Date }[] = [];

                // Previous month days
                const prevMonthLastDay = new Date(year, month, 0).getDate();
                for (let i = startDayOfWeek - 1; i >= 0; i--) {
                  days.push({
                    date: prevMonthLastDay - i,
                    isCurrentMonth: false,
                    fullDate: new Date(year, month - 1, prevMonthLastDay - i),
                  });
                }

                // Current month days
                for (let i = 1; i <= daysInMonth; i++) {
                  days.push({
                    date: i,
                    isCurrentMonth: true,
                    fullDate: new Date(year, month, i),
                  });
                }

                // Next month days
                const remainingDays = 42 - days.length;
                for (let i = 1; i <= remainingDays; i++) {
                  days.push({
                    date: i,
                    isCurrentMonth: false,
                    fullDate: new Date(year, month + 1, i),
                  });
                }

                return days;
              })();

              const today = todayDate;

              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-0 text-center text-xs">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="py-1 text-gray-500 font-medium">{day}</div>
                    ))}
                    {miniCalendarDays.map((day, i) => {
                      const isToday = day.fullDate.toDateString() === today.toDateString();
                      const isSelected = day.fullDate.toDateString() === selectedDate.toDateString();
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedDate(day.fullDate);
                            setCurrentMonth(new Date(day.fullDate.getFullYear(), day.fullDate.getMonth(), 1));
                          }}
                          className={`py-1 text-xs rounded-full w-6 h-6 mx-auto flex items-center justify-center
                            ${!day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                            ${isToday ? 'bg-blue-600 text-white font-bold' : ''}
                            ${isSelected && !isToday ? 'bg-blue-100 text-blue-600' : ''}
                            ${!isToday && !isSelected ? 'hover:bg-gray-100' : ''}
                          `}
                        >
                          {day.date}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>

          {/* My calendars */}
          <div className="mb-6">
            <button
              onClick={() => setMyCalendarsExpanded(!myCalendarsExpanded)}
              className="w-full text-sm font-semibold mb-2 flex items-center justify-between hover:bg-gray-50 rounded px-1 py-1"
            >
              My calendars
              <ChevronDown
                size={16}
                className={`transition-transform ${myCalendarsExpanded ? '' : '-rotate-90'}`}
              />
            </button>
            {myCalendarsExpanded && calendars.map(cal => (
              <div key={cal.id} className="group flex items-center gap-2 py-1.5 hover:bg-gray-50 rounded px-2">
                <input
                  type="checkbox"
                  checked={cal.checked}
                  onChange={() => toggleCalendar(cal.id)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: cal.color }}
                />
                <span
                  className="text-sm flex-1 cursor-pointer"
                  onClick={(e) => handleCalendarContextMenu(e, cal.id)}
                >
                  {cal.name}
                </span>
                <button
                  onClick={(e) => handleCalendarContextMenu(e, cal.id)}
                  className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical size={14} className="text-gray-500" />
                </button>
              </div>
            ))}
          </div>

          {/* Other calendars */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setOtherCalendarsExpanded(!otherCalendarsExpanded)}
                className="flex-1 text-left text-sm font-semibold flex items-center gap-1 hover:bg-gray-50 rounded px-1 py-1"
              >
                Other calendars
                <ChevronDown
                  size={16}
                  className={`transition-transform ${otherCalendarsExpanded ? '' : '-rotate-90'}`}
                />
              </button>
              <button
                onClick={() => setShowAddCalendarModal(true)}
                className="p-1 hover:bg-gray-100 rounded"
                title="Add other calendar"
              >
                <Plus size={14} />
              </button>
            </div>
            {otherCalendarsExpanded && (
              <div className="space-y-0">
                {otherCalendars.map(cal => (
                  <label key={cal.id} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-2">
                    <input
                      type="checkbox"
                      checked={cal.checked}
                      onChange={() => toggleOtherCalendar(cal.id)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: cal.color }}
                    />
                    <span className="text-sm">{cal.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Calendar Context Menu Dropdown */}
      {calendarDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCalendarDropdown(null)}
          />
          <div
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 w-56"
            style={{ left: calendarDropdown.x, top: calendarDropdown.y }}
          >
            <button
              onClick={() => showOnlyCalendar(calendarDropdown.id)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-3"
            >
              <Eye size={16} className="text-gray-500" />
              Display only this calendar
            </button>
            <button
              onClick={() => {
                toggleCalendar(calendarDropdown.id);
                setCalendarDropdown(null);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-3"
            >
              <EyeOff size={16} className="text-gray-500" />
              Hide from list
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={showAllCalendars}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-3"
            >
              <Check size={16} className="text-gray-500" />
              Show all calendars
            </button>
          </div>
        </>
      )}

      {/* Main calendar grid */}
      <div className={`flex-1 ${showSidebar ? 'ml-64' : 'ml-0'} mt-14 p-4`}>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Month View */}
          {viewMode === VIEW.MONTH && (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-gray-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 border-r border-gray-200 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {getCalendarDays().map((day, i) => {
                  const dayEvents = getEventsForDate(day.fullDate);
                  const visibleEvents = dayEvents.slice(0, 3);
                  const moreCount = dayEvents.length - visibleEvents.length;
                  const isSelected = day.fullDate.toDateString() === selectedDate.toDateString();
                  const isToday = day.fullDate.toDateString() === todayDate.toDateString();

                  const isDragOver = dragOverDate?.toDateString() === day.fullDate.toDateString();

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDate(day.fullDate)}
                      onDoubleClick={() => openCreateModal(day.fullDate)}
                      onDragOver={(e) => handleDragOver(e, day.fullDate)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day.fullDate)}
                      className={`min-h-[120px] p-2 border-r border-b border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                        isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                      } ${isDragOver ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}`}
                      style={{ backgroundColor: isDragOver ? '#DBEAFE' : (day.isCurrentMonth ? (isSelected ? '#EFF6FF' : 'white') : '#fafafa') }}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {isToday ? (
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                            {day.date}
                          </div>
                        ) : (
                          <div className={`text-sm font-medium ${
                            isSelected ? 'text-blue-600' : (day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400')
                          }`}>
                            {day.date}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        {visibleEvents.map(event => (
                          <button
                            key={event.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, event)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                            className={`w-full text-left px-2 py-1 rounded text-xs hover:opacity-80 cursor-grab active:cursor-grabbing ${
                              draggedEvent?.id === event.id ? 'opacity-50' : ''
                            }`}
                            style={{ backgroundColor: event.color, color: 'white' }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="truncate flex-1">
                                <span className="opacity-90">{event.time}</span>
                                <span className="ml-1">{event.title}</span>
                              </div>
                              <span className="text-[10px] bg-black bg-opacity-20 px-1 py-0.5 rounded">
                                {getEventDuration(event.time, event.endTime)}
                              </span>
                            </div>
                          </button>
                        ))}

                        {moreCount > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleShowMoreEvents(day.fullDate); }}
                            className="text-xs text-blue-600 hover:underline px-2"
                          >
                            +{moreCount} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Week View */}
          {viewMode === VIEW.WEEK && (
            <>
              {/* Time + Weekday headers */}
              <div className="flex border-b border-gray-200">
                <div className="w-16 flex-shrink-0 p-2 text-center text-sm font-medium text-gray-400 border-r border-gray-200">

                </div>
                <div className="flex-1 grid grid-cols-7">
                  {(() => {
                    const weekStart = new Date(selectedDate);
                    weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
                    return Array.from({ length: 7 }, (_, i) => {
                      const day = new Date(weekStart);
                      day.setDate(weekStart.getDate() + i);
                      const isToday = day.toDateString() === todayDate.toDateString();
                      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      return (
                        <div key={i} className={`p-2 text-center border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                          <div className="text-sm font-medium text-gray-600">{dayNames[i]}</div>
                          <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>{day.getDate()}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Time slots */}
              <div className="max-h-[600px] overflow-y-auto">
                {Array.from({ length: 24 }, (_, hour) => {
                  const weekStart = new Date(selectedDate);
                  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
                  return (
                    <div key={hour} className="flex border-b border-gray-100">
                      <div className="w-16 flex-shrink-0 p-1 text-xs text-gray-400 text-right pr-2 border-r border-gray-200">
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </div>
                      <div className="flex-1 grid grid-cols-7">
                        {Array.from({ length: 7 }, (_, dayIndex) => {
                          const day = new Date(weekStart);
                          day.setDate(weekStart.getDate() + dayIndex);
                          const dateStr = day.toISOString().split('T')[0];
                          const hourEvents = events.filter(e => {
                            if (e.date !== dateStr || !e.time) return false;
                            const eventHour = timeToMinutes(e.time) / 60;
                            return Math.floor(eventHour) === hour;
                          });
                          const isWeekDragOver = dragOverDate?.toDateString() === day.toDateString();
                          return (
                            <div
                              key={dayIndex}
                              onClick={() => { setSelectedDate(day); openCreateModal(day); }}
                              onDragOver={(e) => handleDragOver(e, day)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, day)}
                              className={`min-h-[50px] p-1 border-r border-gray-100 last:border-r-0 hover:bg-gray-50 cursor-pointer transition-colors ${
                                isWeekDragOver ? 'bg-blue-100' : ''
                              }`}
                            >
                              {hourEvents.map(event => (
                                <button
                                  key={event.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, event)}
                                  onDragEnd={handleDragEnd}
                                  onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                                  className={`w-full text-left px-1 py-0.5 rounded text-xs mb-0.5 hover:opacity-80 cursor-grab active:cursor-grabbing ${
                                    draggedEvent?.id === event.id ? 'opacity-50' : ''
                                  }`}
                                  style={{ backgroundColor: event.color, color: 'white' }}
                                >
                                  <div className="truncate">{event.time} {event.title}</div>
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Day View */}
          {viewMode === VIEW.DAY && (
            <>
              {/* Day header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="text-center">
                  <div className="text-sm text-gray-500">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className={`text-3xl font-bold ${selectedDate.toDateString() === todayDate.toDateString() ? 'text-blue-600' : 'text-gray-900'}`}>
                    {selectedDate.getDate()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Time slots for day */}
              <div className="max-h-[600px] overflow-y-auto">
                {Array.from({ length: 24 }, (_, hour) => {
                  const dateStr = selectedDate.toISOString().split('T')[0];
                  const hourEvents = events.filter(e => {
                    if (e.date !== dateStr || !e.time) return false;
                    const eventHour = timeToMinutes(e.time) / 60;
                    return Math.floor(eventHour) === hour;
                  });
                  const isDayDragOver = dragOverDate?.toDateString() === selectedDate.toDateString();
                  return (
                    <div key={hour} className="flex border-b border-gray-100">
                      <div className="w-20 p-2 text-sm text-gray-400 text-right pr-4 border-r border-gray-200 flex-shrink-0">
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </div>
                      <div
                        onClick={() => openCreateModal(selectedDate)}
                        onDragOver={(e) => handleDragOver(e, selectedDate)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, selectedDate)}
                        className={`flex-1 min-h-[60px] p-2 hover:bg-gray-50 cursor-pointer transition-colors ${
                          isDayDragOver ? 'bg-blue-100' : ''
                        }`}
                      >
                        {hourEvents.map(event => (
                          <button
                            key={event.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, event)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                            className={`w-full text-left px-3 py-2 rounded mb-1 hover:opacity-90 cursor-grab active:cursor-grabbing ${
                              draggedEvent?.id === event.id ? 'opacity-50' : ''
                            }`}
                            style={{ backgroundColor: event.color, color: 'white' }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{event.title}</div>
                                <div className="text-sm opacity-90">{event.time} - {event.endTime || 'End'}</div>
                              </div>
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="flex -space-x-2">
                                  {event.attendees.slice(0, 3).map((att) => {
                                    const info = getAttendeeInfo(att);
                                    return info.avatarUrl ? (
                                      <img
                                        key={att.id}
                                        src={info.avatarUrl}
                                        alt={info.name}
                                        className="w-6 h-6 rounded-full object-cover border-2 border-white"
                                        title={info.name}
                                      />
                                    ) : (
                                      <div
                                        key={att.id}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white"
                                        style={{ backgroundColor: info.color }}
                                        title={info.name}
                                      >
                                        {info.initials}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {event.location && (
                              <div className="text-sm opacity-75 flex items-center gap-1 mt-1">
                                <MapPin size={12} />
                                {event.location}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Year View */}
          {viewMode === VIEW.YEAR && (
            <div className="p-4">
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, monthIndex) => {
                  const year = currentMonth.getFullYear();
                  const monthDate = new Date(year, monthIndex, 1);
                  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                  const firstDayOfWeek = monthDate.getDay();
                  const today = todayDate;

                  const days: { date: number; isCurrentMonth: boolean; fullDate: Date }[] = [];

                  // Previous month padding
                  for (let i = 0; i < firstDayOfWeek; i++) {
                    days.push({ date: 0, isCurrentMonth: false, fullDate: new Date() });
                  }

                  // Current month days
                  for (let i = 1; i <= daysInMonth; i++) {
                    days.push({
                      date: i,
                      isCurrentMonth: true,
                      fullDate: new Date(year, monthIndex, i),
                    });
                  }

                  const monthEvents = events.filter(e => {
                    const eventDate = new Date(e.date);
                    return eventDate.getMonth() === monthIndex && eventDate.getFullYear() === year;
                  });

                  return (
                    <div key={monthIndex} className="border border-gray-200 rounded-lg p-2">
                      <h4 className="text-sm font-semibold mb-2 text-center">
                        {monthDate.toLocaleDateString('en-US', { month: 'long' })}
                      </h4>
                      <div className="grid grid-cols-7 gap-0 text-center text-[10px]">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                          <div key={i} className="py-0.5 text-gray-400 font-medium">{d}</div>
                        ))}
                        {days.map((day, i) => {
                          if (!day.isCurrentMonth) {
                            return <div key={i} className="py-0.5" />;
                          }
                          const isToday = day.fullDate.toDateString() === today.toDateString();
                          const hasEvents = monthEvents.some(e => new Date(e.date).getDate() === day.date);
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setSelectedDate(day.fullDate);
                                setCurrentMonth(new Date(year, monthIndex, 1));
                                setViewMode(VIEW.DAY);
                              }}
                              className={`py-0.5 text-[10px] rounded-full w-5 h-5 mx-auto flex items-center justify-center
                                ${isToday ? 'bg-blue-600 text-white font-bold' : 'text-gray-700'}
                                ${hasEvents && !isToday ? 'bg-blue-100' : ''}
                                hover:bg-gray-100
                              `}
                            >
                              {day.date}
                            </button>
                          );
                        })}
                      </div>
                      {monthEvents.length > 0 && (
                        <div className="mt-1 text-[10px] text-gray-500 text-center">
                          {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Schedule/Agenda View */}
          {viewMode === VIEW.SCHEDULE && (
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">Upcoming Events</h3>
              {(() => {
                const sortedEvents = [...events]
                  .filter(e => {
                    const d = new Date(e.date);
                    return d.getFullYear() === currentMonth.getFullYear() && d.getMonth() === currentMonth.getMonth();
                  })
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const groupedByDate: { [key: string]: CalendarEvent[] } = {};

                sortedEvents.forEach(event => {
                  if (!groupedByDate[event.date]) {
                    groupedByDate[event.date] = [];
                  }
                  groupedByDate[event.date].push(event);
                });

                const dates = Object.keys(groupedByDate).sort();

                if (dates.length === 0) {
                  return (
                    <div className="text-center text-gray-500 py-8">
                      <CalendarIcon size={48} className="mx-auto mb-2 text-gray-300" />
                      <p>No upcoming events</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {dates.map(date => {
                      const eventDate = new Date(date);
                      const today = todayDate;
                      const isToday = eventDate.toDateString() === today.toDateString();

                      return (
                        <div key={date}>
                          <h4 className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                            {isToday ? 'Today' : eventDate.toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </h4>
                          <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                            {groupedByDate[date].map(event => (
                              <button
                                key={event.id}
                                onClick={() => handleEventClick(event)}
                                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 flex items-center gap-3"
                              >
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: event.color }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{event.title}</div>
                                  <div className="text-sm text-gray-500">
                                    {event.time}{event.endTime ? ` - ${event.endTime}` : ''}
                                    {event.location && ` · ${event.location}`}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 4 Days View */}
          {viewMode === VIEW.FOUR_DAYS && (
            <>
              {/* Time + Day headers */}
              <div className="flex border-b border-gray-200">
                <div className="w-16 flex-shrink-0 p-2 text-center text-sm font-medium text-gray-400 border-r border-gray-200">
                </div>
                <div className="flex-1 grid grid-cols-4">
                  {(() => {
                    return Array.from({ length: 4 }, (_, i) => {
                      const day = new Date(selectedDate);
                      day.setDate(selectedDate.getDate() + i);
                      const isToday = day.toDateString() === todayDate.toDateString();
                      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      return (
                        <div key={i} className={`p-2 text-center border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                          <div className="text-sm font-medium text-gray-600">{dayNames[day.getDay()]}</div>
                          <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>{day.getDate()}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Time slots */}
              <div className="max-h-[600px] overflow-y-auto">
                {Array.from({ length: 24 }, (_, hour) => {
                  return (
                    <div key={hour} className="flex border-b border-gray-100">
                      <div className="w-16 flex-shrink-0 p-1 text-xs text-gray-400 text-right pr-2 border-r border-gray-200">
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </div>
                      <div className="flex-1 grid grid-cols-4">
                        {Array.from({ length: 4 }, (_, dayIndex) => {
                          const day = new Date(selectedDate);
                          day.setDate(selectedDate.getDate() + dayIndex);
                          const dateStr = day.toISOString().split('T')[0];
                          const hourEvents = events.filter(e => {
                            if (e.date !== dateStr || !e.time) return false;
                            const eventHour = timeToMinutes(e.time) / 60;
                            return Math.floor(eventHour) === hour;
                          });
                          const is4DaysDragOver = dragOverDate?.toDateString() === day.toDateString();
                          return (
                            <div
                              key={dayIndex}
                              onClick={() => { setSelectedDate(day); openCreateModal(day); }}
                              onDragOver={(e) => handleDragOver(e, day)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, day)}
                              className={`min-h-[50px] p-1 border-r border-gray-100 last:border-r-0 hover:bg-gray-50 cursor-pointer transition-colors ${
                                is4DaysDragOver ? 'bg-blue-100' : ''
                              }`}
                            >
                              {hourEvents.map(event => (
                                <button
                                  key={event.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, event)}
                                  onDragEnd={handleDragEnd}
                                  onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                                  className={`w-full text-left px-1 py-0.5 rounded text-xs mb-0.5 hover:opacity-80 cursor-grab active:cursor-grabbing ${
                                    draggedEvent?.id === event.id ? 'opacity-50' : ''
                                  }`}
                                  style={{ backgroundColor: event.color, color: 'white' }}
                                >
                                  <div className="truncate">{event.time} {event.title}</div>
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tasks Panel */}
      {showTasksPanel && (
        <div className={`fixed right-0 top-14 bottom-0 w-80 bg-white border-l border-gray-200 shadow-lg p-4 overflow-y-auto z-40`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <button onClick={() => setShowTasksPanel(false)} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                <p>No tasks yet</p>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 group">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      className="mt-1 w-4 h-4 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className={`text-sm ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {task.title}
                      </p>
                      {task.dueDate && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Search size={20} className="text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events..."
                  className="flex-1 outline-none text-lg"
                />
                <button onClick={() => { setShowSearchModal(false); setSearchQuery(''); }} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {searchQuery && searchEvents().map(event => (
                <button
                  key={event.id}
                  onClick={() => { handleEventClick(event); setShowSearchModal(false); setSearchQuery(''); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-1 h-12 rounded" style={{ backgroundColor: event.color }}></div>
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {event.time}
                      </p>
                      {event.location && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin size={12} />
                          {event.location}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {searchQuery && searchEvents().length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <p>No events found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{isEditMode ? 'Edit Event' : 'Create Event'}</h2>
              <button onClick={() => { setShowCreateModal(false); setIsEditMode(false); }} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => { setEventForm({ ...eventForm, title: e.target.value }); setFormErrors({}); }}
                  placeholder="Event title"
                  className={`w-full px-3 py-2 border rounded-lg ${formErrors.title ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.title && <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(e) => { setEventForm({ ...eventForm, date: e.target.value }); setFormErrors({}); }}
                    className={`w-full px-3 py-2 border rounded-lg ${formErrors.date ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {formErrors.date && <p className="text-red-500 text-xs mt-1">{formErrors.date}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Calendar</label>
                  <select
                    value={eventForm.calendar}
                    onChange={(e) => setEventForm({ ...eventForm, calendar: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {calendars.map(cal => (
                      <option key={cal.id} value={cal.name}>{cal.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    value={eventForm.endTime}
                    onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    placeholder="Add location"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Guests</label>
                <div className="relative">
                  <Users size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={eventForm.guests}
                    onChange={(e) => setEventForm({ ...eventForm, guests: e.target.value })}
                    placeholder="Add guests (comma-separated emails)"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Repeat</label>
                  <select
                    value={eventForm.repeat}
                    onChange={(e) => setEventForm({ ...eventForm, repeat: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekdays">Every weekday (Mon-Fri)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notification</label>
                  <div className="relative">
                    <Bell size={18} className="absolute left-3 top-2.5 text-gray-400" />
                    <select
                      value={eventForm.notification}
                      onChange={(e) => setEventForm({ ...eventForm, notification: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="none">No notification</option>
                      <option value="0">At time of event</option>
                      <option value="5">5 minutes before</option>
                      <option value="10">10 minutes before</option>
                      <option value="15">15 minutes before</option>
                      <option value="30">30 minutes before</option>
                      <option value="60">1 hour before</option>
                      <option value="1440">1 day before</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Add description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateModal(false); setIsEditMode(false); }}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={isEditMode ? updateEvent : createEvent}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                <span>{isLoading ? 'Saving...' : (isEditMode ? 'Update' : 'Create')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Create Task</h2>
                <button onClick={() => { setShowCreateTaskModal(false); setFormErrors({}); }} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Add task title"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {formErrors.title && <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={taskForm.notes}
                    onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Add notes"
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowCreateTaskModal(false); setFormErrors({}); }}
                  disabled={isLoading}
                  className="px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={createTask}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{isLoading ? 'Creating...' : 'Create Task'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Reminder Modal */}
      {showCreateReminderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Create Reminder</h2>
                <button onClick={() => { setShowCreateReminderModal(false); setFormErrors({}); }} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Title *</label>
                  <input
                    type="text"
                    value={reminderForm.title}
                    onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Add reminder"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {formErrors.title && <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={reminderForm.date}
                      onChange={e => setReminderForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={reminderForm.time}
                      onChange={e => setReminderForm(f => ({ ...f, time: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowCreateReminderModal(false); setFormErrors({}); }}
                  disabled={isLoading}
                  className="px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={createReminder}
                  disabled={isLoading}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
                >
                  {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{isLoading ? 'Creating...' : 'Create Reminder'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-1 h-16 rounded" style={{ backgroundColor: selectedEvent.color }}></div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold mb-2">{selectedEvent.title}</h2>
                  </div>
                </div>
                <button onClick={() => setShowEventDetails(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={18} />
                  <div className="flex-1">
                    <p className="font-medium">
                      {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-sm">{selectedEvent.time} - {selectedEvent.endTime || 'End time'}</p>
                  </div>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={18} />
                    <p>{selectedEvent.location}</p>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="flex items-start gap-2 text-gray-600">
                    <Bell size={18} className="mt-0.5" />
                    <p>{selectedEvent.description}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-600">
                  <CalendarIcon size={18} />
                  <p className="text-sm">Calendar: {selectedEvent.calendar}</p>
                </div>

                {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                  <div className="flex items-start gap-2 text-gray-600">
                    <Users size={18} className="mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-2">Attendees ({selectedEvent.attendees.length + 1})</p>
                      <div className="space-y-2">
                        {/* Current user (organizer) */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                            {currentUser ? currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{currentUser?.name || 'You'}</p>
                            <p className="text-xs text-gray-400">Organizer</p>
                          </div>
                        </div>
                        {/* Other attendees */}
                        {selectedEvent.attendees.map((att) => {
                          const info = getAttendeeInfo(att);
                          return (
                            <div key={att.id} className="flex items-center gap-2">
                              {info.avatarUrl ? (
                                <img
                                  src={info.avatarUrl}
                                  alt={info.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                                  style={{ backgroundColor: info.color }}
                                >
                                  {info.initials}
                                </div>
                              )}
                              <p className="text-sm">{info.name}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RSVP Options - Calendar Style */}
              <div className="mb-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-3">Going?</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRsvp(selectedEvent.id, 'yes')}
                    className={`px-4 py-1.5 text-sm rounded-full transition-all ${
                      selectedEvent.rsvpStatus === 'yes'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {selectedEvent.rsvpStatus === 'yes' && <Check size={14} className="inline mr-1" />}
                    Yes
                  </button>
                  <button
                    onClick={() => handleRsvp(selectedEvent.id, 'maybe')}
                    className={`px-4 py-1.5 text-sm rounded-full transition-all ${
                      selectedEvent.rsvpStatus === 'maybe'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {selectedEvent.rsvpStatus === 'maybe' && <Check size={14} className="inline mr-1" />}
                    Maybe
                  </button>
                  <button
                    onClick={() => handleRsvp(selectedEvent.id, 'no')}
                    className={`px-4 py-1.5 text-sm rounded-full transition-all ${
                      selectedEvent.rsvpStatus === 'no'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {selectedEvent.rsvpStatus === 'no' && <Check size={14} className="inline mr-1" />}
                    No
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(selectedEvent)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit3 size={16} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => { setEventToDelete(selectedEvent); setShowDeleteConfirm(true); }}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && eventToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h2 className="text-lg font-semibold">Delete event</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "<span className="font-medium">{eventToDelete.title}</span>"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteConfirm(false); setEventToDelete(null); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteEvent(eventToDelete.id);
                  setShowDeleteConfirm(false);
                  setEventToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Profile</h2>
                <button onClick={() => setShowProfileModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
              </div>
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-2xl font-semibold">
                    {currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{currentUser.name}</h3>
                  <p className="text-gray-500">{currentUser.jobTitle}</p>
                  <p className="text-sm text-gray-400">{currentUser.location}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3"><Mail size={18} className="text-gray-400" /><div><p className="text-xs text-gray-400">Email</p><p className="text-sm">{currentUser.email}</p></div></div>
                <div className="flex items-center gap-3"><User size={18} className="text-gray-400" /><div><p className="text-xs text-gray-400">Username</p><p className="text-sm">@{currentUser.username}</p></div></div>
                <div className="flex items-center gap-3"><Briefcase size={18} className="text-gray-400" /><div><p className="text-xs text-gray-400">Role</p><p className="text-sm">{currentUser.jobTitle}</p></div></div>
                <div className="flex items-center gap-3"><MapPin size={18} className="text-gray-400" /><div><p className="text-xs text-gray-400">Location</p><p className="text-sm">{currentUser.location}</p></div></div>
                {currentUser.bio && (<div className="pt-4 border-t border-gray-200"><p className="text-xs text-gray-400 mb-1">About</p><p className="text-sm text-gray-600">{currentUser.bio}</p></div>)}
                {currentUser.interests && (<div className="pt-4 border-t border-gray-200"><p className="text-xs text-gray-400 mb-2">Interests</p><div className="flex flex-wrap gap-2">{currentUser.interests.map((interest: string) => (<span key={interest} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{interest}</span>))}</div></div>)}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button onClick={() => setShowProfileModal(false)} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Settings</h2>
                <button onClick={() => setShowSettingsModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
              </div>
              <div className="space-y-6">
                {/* View Options */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><CalendarIcon size={16} />View Options</h3>
                  <div className="space-y-4 pl-6">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Default view</label>
                      <select
                        value={settings.defaultView}
                        onChange={(e) => setSettings(prev => ({ ...prev, defaultView: e.target.value as ViewMode }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                        <option value="schedule">Schedule</option>
                        <option value="4days">4 Days</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Start week on</label>
                      <select
                        value={settings.weekStartsOn}
                        onChange={(e) => setSettings(prev => ({ ...prev, weekStartsOn: e.target.value as 'sunday' | 'monday' }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="sunday">Sunday</option>
                        <option value="monday">Monday</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Time format</label>
                      <select
                        value={settings.timeFormat}
                        onChange={(e) => setSettings(prev => ({ ...prev, timeFormat: e.target.value as '12h' | '24h' }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="12h">12-hour (1:00 PM)</option>
                        <option value="24h">24-hour (13:00)</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Show week numbers</label>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, showWeekNumbers: !prev.showWeekNumbers }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.showWeekNumbers ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showWeekNumbers ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Show weekends</label>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, showWeekends: !prev.showWeekends }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.showWeekends ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showWeekends ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Show declined events</label>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, showDeclinedEvents: !prev.showDeclinedEvents }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.showDeclinedEvents ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showDeclinedEvents ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Event Defaults */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock size={16} />Event Defaults</h3>
                  <div className="space-y-4 pl-6">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Default duration</label>
                      <select
                        value={settings.defaultEventDuration}
                        onChange={(e) => setSettings(prev => ({ ...prev, defaultEventDuration: parseInt(e.target.value) }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Default reminder</label>
                      <select
                        value={settings.defaultReminder}
                        onChange={(e) => setSettings(prev => ({ ...prev, defaultReminder: parseInt(e.target.value) }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={0}>None</option>
                        <option value={5}>5 minutes before</option>
                        <option value={10}>10 minutes before</option>
                        <option value={15}>15 minutes before</option>
                        <option value={30}>30 minutes before</option>
                        <option value={60}>1 hour before</option>
                        <option value={1440}>1 day before</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Bell size={16} />Notifications</h3>
                  <div className="space-y-4 pl-6">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Enable notifications</label>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, enableNotifications: !prev.enableNotifications }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enableNotifications ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enableNotifications ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Auto-add invitations</label>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, autoAddInvites: !prev.autoAddInvites }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoAddInvites ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.autoAddInvites ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Privacy */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Lock size={16} />Privacy</h3>
                  <div className="pl-6">
                    <p className="text-sm text-gray-500">Your calendar data is stored locally and not shared with third parties.</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setSettings({
                      defaultView: VIEW.MONTH,
                      weekStartsOn: 'sunday',
                      timeFormat: '12h',
                      defaultEventDuration: 60,
                      defaultReminder: 30,
                      showDeclinedEvents: false,
                      showWeekNumbers: false,
                      showWeekends: true,
                      autoAddInvites: true,
                      enableNotifications: true,
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Reset to defaults
                </button>
                <button onClick={() => setShowSettingsModal(false)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* More Events Modal */}
      {showMoreEventsModal && selectedDayForMore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {selectedDayForMore.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h2>
                <button
                  onClick={() => { setShowMoreEventsModal(false); setSelectedDayForMore(null); }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {getEventsForDate(selectedDayForMore).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No events for this day</p>
              ) : (
                <div className="space-y-2">
                  {getEventsForDate(selectedDayForMore).map(event => (
                    <button
                      key={event.id}
                      onClick={() => {
                        handleEventClick(event);
                        setShowMoreEventsModal(false);
                        setSelectedDayForMore(null);
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-200 flex items-center gap-3"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{event.title}</div>
                        <div className="text-sm text-gray-500">
                          {event.time}{event.endTime ? ` - ${event.endTime}` : ''}
                          {event.location && ` · ${event.location}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  openCreateModal(selectedDayForMore);
                  setShowMoreEventsModal(false);
                  setSelectedDayForMore(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={16} />
                <span>Add Event</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Calendar Modal */}
      {showAddCalendarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Add other calendar</h2>
                <button
                  onClick={() => { setShowAddCalendarModal(false); setNewCalendarUrl(''); }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Subscribe to a calendar by entering the calendar URL or email address.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calendar URL or Email
                  </label>
                  <input
                    type="text"
                    value={newCalendarUrl}
                    onChange={(e) => setNewCalendarUrl(e.target.value)}
                    placeholder="Enter URL or email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="text-xs text-gray-500">
                  <p className="font-medium mb-1">Examples:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>john@example.com</li>
                    <li>https://calendar.microlendar.app/...</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setShowAddCalendarModal(false); setNewCalendarUrl(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCalendar}
                disabled={!newCalendarUrl.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock Screen */}
      {isSignedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="bg-white rounded-lg shadow-2xl p-8 w-[360px] flex flex-col items-center">
            <div className="text-2xl font-bold mb-6" style={{ color: "#4285F4" }}>MicroLendar</div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ backgroundColor: "#4285F4" }}>
              U
            </div>
            <div className="text-lg font-semibold text-gray-900 mb-1">User</div>
            <div className="text-sm text-gray-500 mb-6">user@microlendar.com</div>
            <input type="password" readOnly value="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded mb-4 text-center text-gray-400 bg-gray-50" />
            <button onClick={() => setIsSignedOut(false)} className="w-full py-2 text-white rounded font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: "#4285F4" }}>
              Sign in
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MicroLendar;
