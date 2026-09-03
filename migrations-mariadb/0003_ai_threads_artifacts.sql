CREATE TABLE ai_threads (
  id BINARY(16) NOT NULL,
  owner_user_id BINARY(16) NOT NULL,
  title VARCHAR(80) NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ai_threads_owner_updated_idx (owner_user_id, updated_at),
  CONSTRAINT ai_threads_owner_fk FOREIGN KEY (owner_user_id) REFERENCES app_users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_messages (
  id BINARY(16) NOT NULL,
  thread_id BINARY(16) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  sequence_number INT UNSIGNED NOT NULL,
  content JSON NOT NULL,
  provider_response_id VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ai_messages_thread_sequence_uq (thread_id, sequence_number),
  KEY ai_messages_thread_created_idx (thread_id, created_at),
  CONSTRAINT ai_messages_thread_fk FOREIGN KEY (thread_id) REFERENCES ai_threads(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_tool_runs (
  id BINARY(16) NOT NULL,
  thread_id BINARY(16) NOT NULL,
  assistant_message_id BINARY(16) NULL,
  provider_call_id VARCHAR(255) NOT NULL,
  tool_name VARCHAR(96) NOT NULL,
  arguments_json JSON NOT NULL,
  output_json JSON NULL,
  status ENUM('running', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'running',
  duration_ms INT UNSIGNED NULL,
  error_code VARCHAR(96) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ai_tool_runs_provider_call_uq (thread_id, provider_call_id),
  KEY ai_tool_runs_thread_created_idx (thread_id, created_at),
  CONSTRAINT ai_tool_runs_thread_fk FOREIGN KEY (thread_id) REFERENCES ai_threads(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ai_tool_runs_message_fk FOREIGN KEY (assistant_message_id) REFERENCES ai_messages(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_usage_events (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  thread_id BINARY(16) NULL,
  provider VARCHAR(32) NOT NULL,
  model VARCHAR(96) NOT NULL,
  input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  total_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ai_usage_events_user_created_idx (user_id, created_at),
  CONSTRAINT ai_usage_events_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ai_usage_events_thread_fk FOREIGN KEY (thread_id) REFERENCES ai_threads(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_rate_limits (
  user_id BINARY(16) NOT NULL,
  scope VARCHAR(48) NOT NULL,
  window_started_at TIMESTAMP NOT NULL,
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, scope),
  CONSTRAINT ai_rate_limits_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_artifacts (
  id BINARY(16) NOT NULL,
  owner_user_id BINARY(16) NOT NULL,
  thread_id BINARY(16) NULL,
  type ENUM('plan', 'map', 'audience', 'evidence') NOT NULL,
  save_state ENUM('draft', 'saved') NOT NULL DEFAULT 'draft',
  current_revision_number INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY campaign_artifacts_owner_updated_idx (owner_user_id, updated_at),
  KEY campaign_artifacts_thread_idx (thread_id),
  CONSTRAINT campaign_artifacts_owner_fk FOREIGN KEY (owner_user_id) REFERENCES app_users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT campaign_artifacts_thread_fk FOREIGN KEY (thread_id) REFERENCES ai_threads(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_artifact_revisions (
  artifact_id BINARY(16) NOT NULL,
  revision_number INT UNSIGNED NOT NULL,
  parent_revision_number INT UNSIGNED NULL,
  created_by_user_id BINARY(16) NOT NULL,
  payload JSON NOT NULL,
  reason VARCHAR(240) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (artifact_id, revision_number),
  KEY campaign_artifact_revisions_created_idx (created_at),
  CONSTRAINT campaign_artifact_revisions_artifact_fk FOREIGN KEY (artifact_id) REFERENCES campaign_artifacts(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT campaign_artifact_revisions_user_fk FOREIGN KEY (created_by_user_id) REFERENCES app_users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE artifact_citations (
  id BINARY(16) NOT NULL,
  artifact_id BINARY(16) NOT NULL,
  revision_number INT UNSIGNED NOT NULL,
  fact_id VARCHAR(255) NULL,
  excerpt_id VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY artifact_citations_fact_uq (artifact_id, revision_number, fact_id),
  UNIQUE KEY artifact_citations_excerpt_uq (artifact_id, revision_number, excerpt_id),
  KEY artifact_citations_revision_idx (artifact_id, revision_number),
  CONSTRAINT artifact_citations_revision_fk FOREIGN KEY (artifact_id, revision_number)
    REFERENCES campaign_artifact_revisions(artifact_id, revision_number)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT artifact_citations_fact_fk FOREIGN KEY (fact_id) REFERENCES evidence_facts(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT artifact_citations_excerpt_fk FOREIGN KEY (excerpt_id) REFERENCES evidence_excerpts(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT artifact_citations_one_source CHECK (
    (fact_id IS NOT NULL AND excerpt_id IS NULL) OR
    (fact_id IS NULL AND excerpt_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
