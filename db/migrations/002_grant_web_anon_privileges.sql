-- Defensive hardening: ensure web_anon can always advance every table's
-- id sequence (INSERT ... DEFAULT nextval(...)), including for tables
-- created in the future. Existing grants on events/places/restaurants/
-- stays/tours already looked correct when checked, but this closes any
-- gap (e.g. a sequence created outside the original grant statement)
-- and is safe to re-run.

GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO web_anon;
