-- Fix trigger functions to use explicit search_path and public. prefixes
-- Required for triggers on auth.users to find public schema tables

CREATE OR REPLACE FUNCTION public.seed_default_map_data(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_values (user_id, name, value_type, sort_order, score, sufficiency_mark) VALUES
    (p_user_id, 'Safety',                'preventive',   0, 5, 4),
    (p_user_id, 'Financial Sufficiency', 'preventive',   1, 5, 4),
    (p_user_id, 'Health',                'preventive',   2, 5, 4),
    (p_user_id, 'Belonging',             'preventive',   3, 5, 4),
    (p_user_id, 'Freedom',               'promotional',  4, 5, 4),
    (p_user_id, 'Creative Expression',   'promotional',  5, 5, 4),
    (p_user_id, 'Purpose & Meaning',     'promotional',  6, 5, 4),
    (p_user_id, 'Adventure',             'promotional',  7, 5, 4);

  INSERT INTO public.life_domains (user_id, name, sort_order) VALUES
    (p_user_id, 'Home',                 0),
    (p_user_id, 'Work & Career',        1),
    (p_user_id, 'Finances',             2),
    (p_user_id, 'Health',               3),
    (p_user_id, 'Family',               4),
    (p_user_id, 'Friends & Community',  5),
    (p_user_id, 'Recreation & Play',    6),
    (p_user_id, 'Inner Life',           7),
    (p_user_id, 'Downtime',             8),
    (p_user_id, 'Public Life',          9);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id) VALUES (new.id);
  PERFORM public.seed_default_map_data(new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
