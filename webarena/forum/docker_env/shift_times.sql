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
