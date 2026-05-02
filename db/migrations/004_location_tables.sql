-- Migration 004: Location lookup tables
-- cities, districts, and add FK columns to properties

CREATE TABLE IF NOT EXISTS cities (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  plate_code INTEGER
);

CREATE TABLE IF NOT EXISTS districts (
  id      SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name    VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_districts_city_id ON districts(city_id);

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS city_id         INTEGER REFERENCES cities(id),
  ADD COLUMN IF NOT EXISTS district_id     INTEGER REFERENCES districts(id),
  ADD COLUMN IF NOT EXISTS neighborhood    VARCHAR(200);
