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

-- Make space in the sequences (Not sure why there are two sequences each for both tables)
-- Submissions scheduled by init() can range from 200,000 - 299,999
-- Comments scheduled by init() can range from 3,000,000 - 3,999,999
SELECT setval('submission_id_seq', 300000, true);
SELECT setval('submissions_id_seq', 300000, true);
SELECT setval('comment_id_seq', 4000000, true);
SELECT setval('comments_id_seq', 4000000, true);

-- Clean up --
SET max_parallel_maintenance_workers = 0;
SET maintenance_work_mem = '64MB';
VACUUM FULL ANALYZE;
