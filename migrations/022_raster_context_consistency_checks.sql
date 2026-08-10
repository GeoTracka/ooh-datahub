ALTER TABLE ooh_data.site_population_radius_context
  DROP CONSTRAINT IF EXISTS site_population_radius_cell_accounting_check;
ALTER TABLE ooh_data.site_population_radius_context
  ADD CONSTRAINT site_population_radius_cell_accounting_check
  CHECK (candidate_cell_count = valid_population_cell_count + nodata_population_cell_count);

ALTER TABLE ooh_data.site_accessible_population_context
  DROP CONSTRAINT IF EXISTS site_accessible_population_cell_accounting_check;
ALTER TABLE ooh_data.site_accessible_population_context
  ADD CONSTRAINT site_accessible_population_cell_accounting_check
  CHECK (candidate_population_cell_count = valid_population_cell_count + nodata_population_cell_count);

ALTER TABLE ooh_data.site_accessible_population_context
  DROP CONSTRAINT IF EXISTS site_accessible_population_reachable_check;
ALTER TABLE ooh_data.site_accessible_population_context
  ADD CONSTRAINT site_accessible_population_reachable_check
  CHECK (reachable_population_cell_count <= valid_population_cell_count);

ALTER TABLE ooh_data.site_accessible_population_context
  DROP CONSTRAINT IF EXISTS site_accessible_population_friction_unavailable_check;
ALTER TABLE ooh_data.site_accessible_population_context
  ADD CONSTRAINT site_accessible_population_friction_unavailable_check
  CHECK (friction_unavailable_population_cell_count <= valid_population_cell_count);

ALTER TABLE ooh_data.site_accessible_population_context
  DROP CONSTRAINT IF EXISTS site_accessible_population_threshold_frontier_check;
ALTER TABLE ooh_data.site_accessible_population_context
  ADD CONSTRAINT site_accessible_population_threshold_frontier_check
  CHECK (max_reached_minutes <= threshold_minutes::double precision + 1e-9);
