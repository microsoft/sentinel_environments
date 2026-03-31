/**
 * MicroScholar Type Definitions
 *
 * Type definitions for the MicroScholar environment (academic search platform).
 * Actual data is stored in .jsonl files in this directory.
 *
 * Note: Timestamps are NOT stored statically. The `order` field controls
 * when items appear during a task, and display times are computed dynamically
 * based on when items actually appeared in the session.
 */

// ============================================================================
// PAPER TYPES
// ============================================================================

export interface MicroScholarPaper {
  id: string;
  title: string;
  titleHtml: string;
  authorIds: string[];
  authors: string;
  source: string;
  year: number;
  snippet: string;
  citedBy: number;
  pdfLink?: string;
  pdfSource?: string;
  isBook?: boolean;
  isTargetPaper?: boolean;
  order: number;
  taskType?: 'target' | 'noise' | 'generated';
}

// ============================================================================
// ALERT TYPES
// ============================================================================

export interface MicroScholarAlert {
  id: string;
  type: 'citation' | 'new_paper' | 'keyword';
  title: string;
  description: string;
  isRead: boolean;
  relatedPaperId?: string;
  order: number;
}

// ============================================================================
// COAUTHOR TYPES
// ============================================================================

export interface MicroScholarCoauthor {
  authorId1: string;
  authorId2: string;
  sharedPapers: string[];
  order: number;
}

// ============================================================================
// CITATION TYPES
// ============================================================================

export interface MicroScholarCitation {
  id: string;
  paperId: string;
  citingPaperId: string;
  order: number;
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface MicroScholarSearchQuery {
  query: string;
  order: number;
}
