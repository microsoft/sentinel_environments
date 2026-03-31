/**
 * MicroMail Type Definitions
 *
 * Type definitions for the MicroMail environment (Outlook-like email platform).
 * Actual data is stored in .jsonl files in this directory.
 */

export interface MicromailEmail {
  id: string;
  task: string;
  order: number;
  sender_id: string;
  subject: string;
  body: string;
  isRead?: boolean;
  isFlagged?: boolean;
  isJunk?: boolean;
  hasAttachment?: boolean;
  folder?: string;
}

export interface MicromailAttachment {
  id: string;
  email_id: string;
  name: string;
  size: string;
}
