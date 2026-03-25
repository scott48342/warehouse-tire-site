-- Catalog Tables Migration
-- Stores Wheel-Size catalog data (makes, models, years) in PostgreSQL
-- This eliminates repeated API calls and provides consistent YMM across all instances

-- ============================================================================
-- catalog_makes - All vehicle makes from Wheel-Size API
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_makes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS catalog_makes_slug_idx ON catalog_makes (slug);
CREATE INDEX IF NOT EXISTS catalog_makes_name_idx ON catalog_makes (LOWER(name));

-- ============================================================================
-- catalog_models - Models with their valid years
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  make_slug VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  years INTEGER[] NOT NULL DEFAULT '{}',  -- Array of valid years
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(make_slug, slug)
);

CREATE INDEX IF NOT EXISTS catalog_models_make_slug_idx ON catalog_models (make_slug);
CREATE INDEX IF NOT EXISTS catalog_models_slug_idx ON catalog_models (slug);
CREATE INDEX IF NOT EXISTS catalog_models_name_idx ON catalog_models (LOWER(name));

-- ============================================================================
-- catalog_sync_log - Track when catalog data was last synced
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL,  -- 'makes', 'models', 'modifications'
  entity_key VARCHAR(255),            -- e.g., make_slug for models
  synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  record_count INTEGER NOT NULL DEFAULT 0,
  
  UNIQUE(entity_type, entity_key)
);

CREATE INDEX IF NOT EXISTS catalog_sync_log_entity_idx ON catalog_sync_log (entity_type, entity_key);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_catalog_makes_updated_at ON catalog_makes;
CREATE TRIGGER update_catalog_makes_updated_at
  BEFORE UPDATE ON catalog_makes
  FOR EACH ROW
  EXECUTE FUNCTION update_catalog_updated_at();

DROP TRIGGER IF EXISTS update_catalog_models_updated_at ON catalog_models;
CREATE TRIGGER update_catalog_models_updated_at
  BEFORE UPDATE ON catalog_models
  FOR EACH ROW
  EXECUTE FUNCTION update_catalog_updated_at();
