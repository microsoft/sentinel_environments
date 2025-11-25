TRUNCATE submission_votes;
DELETE FROM comments WHERE timestamp >= '2023-02-19 00:00:00+00';
DELETE FROM submissions WHERE timestamp >= '2023-02-19 00:00:00+00';

-- Update the comment counts in the submission table
BEGIN;
UPDATE submissions SET comment_count = 0;
UPDATE submissions s
  SET comment_count = c.cnt
  FROM (
    SELECT submission_id, COUNT(*) AS cnt
    FROM comments
    GROUP BY submission_id
  ) AS c
  WHERE c.submission_id = s.id;
COMMIT;

-- Shift everything forward in time
BEGIN;
CREATE TEMP TABLE t_delta AS SELECT now() - max("timestamp") AS delta FROM submissions;

UPDATE submissions SET
    "timestamp" = "timestamp" + (SELECT delta FROM t_delta),
    edited_at = NULL,
    "last_active" = "last_active" + (SELECT delta FROM t_delta);

UPDATE comments SET
    "timestamp" = "timestamp" + (SELECT delta FROM t_delta),
    edited_at = NULL;
COMMIT;

-- Clean up --
SET max_parallel_maintenance_workers = 0;
SET maintenance_work_mem = '64MB';
VACUUM FULL ANALYZE;
