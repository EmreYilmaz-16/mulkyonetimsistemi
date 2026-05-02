ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20);

UPDATE payments
SET payment_type = CASE
  WHEN COALESCE(notes, '') ILIKE 'Depozito%' THEN 'deposit'
  ELSE 'rent'
END
WHERE payment_type IS NULL;

ALTER TABLE payments
  ALTER COLUMN payment_type SET DEFAULT 'rent';

UPDATE payments
SET payment_type = 'rent'
WHERE payment_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_payment_type_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_payment_type_check
      CHECK (payment_type IN ('rent', 'deposit'));
  END IF;
END $$;

ALTER TABLE payments
  ALTER COLUMN payment_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS deposit_returned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS deposit_return_date DATE;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS deposit_return_amount NUMERIC(12,2);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS termination_notes TEXT;