ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS payment_day INTEGER;

UPDATE contracts
SET payment_day = 1
WHERE payment_day IS NULL;

ALTER TABLE contracts
  ALTER COLUMN payment_day SET DEFAULT 1;

ALTER TABLE contracts
  ALTER COLUMN payment_day SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_payment_day_check'
      AND conrelid = 'contracts'::regclass
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_payment_day_check
      CHECK (payment_day BETWEEN 1 AND 28);
  END IF;
END
$$;