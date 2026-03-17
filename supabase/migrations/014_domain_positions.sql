-- Allow domain nodes to have user-defined positions on the Life Map
alter table life_domains
  add column if not exists position_x float,
  add column if not exists position_y float;
