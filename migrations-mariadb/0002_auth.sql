CREATE TABLE IF NOT EXISTS app_users (
  id BINARY(16) PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY app_users_email_uq (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_sessions (
  id BINARY(16) PRIMARY KEY,
  token_hash BINARY(32) NOT NULL,
  user_id BINARY(16) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash BINARY(32) NULL,
  user_agent_hash BINARY(32) NULL,
  CONSTRAINT app_sessions_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY app_sessions_token_hash_uq (token_hash),
  KEY app_sessions_user_expiry_idx (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
