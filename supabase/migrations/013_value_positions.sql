-- Allow value nodes to have user-defined positions on the map
alter table user_values
  add column if not exists position_x float,
  add column if not exists position_y float;
