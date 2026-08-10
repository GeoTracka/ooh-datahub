ALTER TABLE ooh_data.context_feature_runs
  DROP CONSTRAINT IF EXISTS context_feature_runs_snapshot_id_fkey;

ALTER TABLE ooh_data.context_feature_runs
  ADD CONSTRAINT context_feature_runs_snapshot_id_fkey
  FOREIGN KEY (snapshot_id)
  REFERENCES ooh_data.context_feature_snapshots (snapshot_id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;
