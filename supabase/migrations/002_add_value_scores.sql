ALTER TABLE user_values ADD COLUMN score integer NOT NULL DEFAULT 5
  CHECK (score >= 1 AND score <= 10);
ALTER TABLE user_values ADD COLUMN sufficiency_mark integer NOT NULL DEFAULT 4
  CHECK (sufficiency_mark >= 1 AND sufficiency_mark <= 10);

CREATE OR REPLACE FUNCTION seed_default_map_data(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO user_values (user_id, name, value_type, sort_order, score, sufficiency_mark) VALUES
    (p_user_id, 'Safety',                'preventive',   0, 5, 4),
    (p_user_id, 'Financial Sufficiency', 'preventive',   1, 5, 4),
    (p_user_id, 'Health',                'preventive',   2, 5, 4),
    (p_user_id, 'Belonging',             'preventive',   3, 5, 4),
    (p_user_id, 'Freedom',               'promotional',  4, 5, 4),
    (p_user_id, 'Creative Expression',   'promotional',  5, 5, 4),
    (p_user_id, 'Purpose & Meaning',     'promotional',  6, 5, 4),
    (p_user_id, 'Adventure',             'promotional',  7, 5, 4);

  INSERT INTO life_domains (user_id, name, sort_order) VALUES
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
