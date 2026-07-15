-- Adds google_place_id to stays, tours, and events so the automatic
-- Google Places import (scripts/pull-google-places.ts) can dedupe
-- against these tables the same way it already does for
-- restaurants/places. Safe to re-run.

ALTER TABLE stays ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS google_place_id text;

-- Partial unique index: allows many rows with NULL (manually created
-- records that were never imported from Google) but guarantees a given
-- Google place can only ever exist once per table.
CREATE UNIQUE INDEX IF NOT EXISTS stays_google_place_id_key
  ON stays (google_place_id) WHERE google_place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tours_google_place_id_key
  ON tours (google_place_id) WHERE google_place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_google_place_id_key
  ON events (google_place_id) WHERE google_place_id IS NOT NULL;

-- restaurants/places already have google_place_id + a uniqueness
-- constraint (the dashboard's "already in the database" duplicate-key
-- error depends on it) -- these are here only as a safety net in case
-- that constraint is missing on a given environment.
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_google_place_id_key
  ON restaurants (google_place_id) WHERE google_place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS places_google_place_id_key
  ON places (google_place_id) WHERE google_place_id IS NOT NULL;
