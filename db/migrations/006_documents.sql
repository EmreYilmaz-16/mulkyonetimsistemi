CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type     VARCHAR(20) NOT NULL CHECK (entity_type IN ('property', 'tenant', 'contract')),
    entity_id       UUID NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    original_name   VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(120),
    file_size       BIGINT NOT NULL DEFAULT 0,
    uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);CREATE TABLE IF NOT EXISTS documents (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type    VARCHAR(20) NOT NULL
                     CHECK (entity_type IN ('property','tenant','contract')),
    entity_id      UUID NOT NULL,
    original_name  VARCHAR(255) NOT NULL,
    stored_name    VARCHAR(255) NOT NULL,
    mime_type      VARCHAR(150),
    file_size      BIGINT,
    storage_path   VARCHAR(500) NOT NULL,
    uploaded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_documents_updated_at'
  ) THEN
    CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;