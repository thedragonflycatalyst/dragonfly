-- User-selectable trend responsiveness. Default preserves the original 10% per day behavior.
-- The column must be deployed before the app starts persisting this setting.
alter table public.coach_scale_settings
  add column if not exists trend_smoothing numeric(4,2) not null default 0.10
  check (trend_smoothing in (0.05, 0.10, 0.20, 0.35));
