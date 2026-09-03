CREATE TABLE IF NOT EXISTS evidence_sources (
  id VARCHAR(128) PRIMARY KEY,
  kind ENUM('survey_workbook', 'published_report') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  access_class VARCHAR(64) NOT NULL,
  period VARCHAR(32) NOT NULL,
  status ENUM('approved', 'blocked', 'superseded') NOT NULL DEFAULT 'approved',
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY evidence_sources_sha256_uq (sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evidence_metrics (
  id VARCHAR(160) PRIMARY KEY,
  family VARCHAR(96) NOT NULL,
  label VARCHAR(255) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  status ENUM('approved', 'blocked', 'superseded') NOT NULL DEFAULT 'approved',
  KEY evidence_metrics_family_status_idx (family, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evidence_facts (
  id VARCHAR(255) PRIMARY KEY,
  source_id VARCHAR(128) NOT NULL,
  metric_id VARCHAR(160) NOT NULL,
  label VARCHAR(255) NOT NULL,
  value DECIMAL(18,6) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  numerator INT NULL,
  denominator INT NULL,
  respondent_base INT NOT NULL,
  valid_base INT NULL,
  selection_count INT NULL,
  geography_id VARCHAR(64) NOT NULL,
  segment_hash VARCHAR(64) NOT NULL,
  segment JSON NOT NULL,
  period VARCHAR(32) NOT NULL,
  weighting ENUM('unweighted') NOT NULL,
  source_column INT NULL,
  status ENUM('approved', 'blocked', 'superseded') NOT NULL DEFAULT 'approved',
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT evidence_facts_source_fk FOREIGN KEY (source_id) REFERENCES evidence_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT evidence_facts_metric_fk FOREIGN KEY (metric_id) REFERENCES evidence_metrics(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY evidence_facts_revision_key_uq (source_id, metric_id, geography_id, segment_hash, period),
  KEY evidence_facts_metric_status_geo_idx (metric_id, status, geography_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evidence_citations (
  id VARCHAR(255) PRIMARY KEY,
  fact_id VARCHAR(255) NOT NULL,
  source_id VARCHAR(128) NOT NULL,
  workbook_field VARCHAR(96) NULL,
  page INT NULL,
  caveat TEXT NOT NULL,
  CONSTRAINT evidence_citations_fact_fk FOREIGN KEY (fact_id) REFERENCES evidence_facts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT evidence_citations_source_fk FOREIGN KEY (source_id) REFERENCES evidence_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY evidence_citations_fact_idx (fact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evidence_disputes (
  id VARCHAR(160) PRIMARY KEY,
  source_id VARCHAR(128) NOT NULL,
  metric_id VARCHAR(160) NULL,
  status ENUM('approved', 'blocked', 'superseded') NOT NULL DEFAULT 'blocked',
  workbook_value DECIMAL(18,6) NULL,
  report_value DECIMAL(18,6) NULL,
  note TEXT NOT NULL,
  CONSTRAINT evidence_disputes_source_fk FOREIGN KEY (source_id) REFERENCES evidence_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY evidence_disputes_metric_status_idx (metric_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evidence_excerpts (
  id VARCHAR(160) PRIMARY KEY,
  source_id VARCHAR(128) NOT NULL,
  metric_id VARCHAR(160) NULL,
  page INT NOT NULL,
  theme VARCHAR(160) NOT NULL,
  geography_id VARCHAR(64) NOT NULL,
  period VARCHAR(32) NOT NULL,
  evidence_type VARCHAR(48) NOT NULL,
  paraphrase TEXT NOT NULL,
  caveat TEXT NOT NULL,
  status ENUM('approved', 'blocked', 'superseded') NOT NULL,
  CONSTRAINT evidence_excerpts_source_fk FOREIGN KEY (source_id) REFERENCES evidence_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY evidence_excerpts_metric_status_idx (metric_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
