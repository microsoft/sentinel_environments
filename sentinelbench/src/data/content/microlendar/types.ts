/**
 * MicroLendar Type Definitions
 *
 * Type definitions for the MicroLendar environment (calendar platform).
 * Actual data is stored in .jsonl files in this directory.
 */

export interface MicroLendarEvent {
  id: string;
  owner_id: string;
  title: string;
  description?: string;
  start_time: string | null;
  end_time: string | null;
  category: 'Work' | 'Personal' | 'Family';
  is_task: boolean;
  is_completed: boolean;
  is_conflict: boolean;
  attendees: string[];
  location?: string;
  task_type: 'events' | 'today' | 'work' | 'tasks' | 'conflict' | 'noise';
  order: number;
}
