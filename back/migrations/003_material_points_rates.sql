INSERT INTO material_types (code, name, points_per_kg, rounding, active)
VALUES
  ('glass', 'Glass', 0.1, 'exact', TRUE),
  ('paper', 'Paper/Cardboard', 0.2, 'exact', TRUE),
  ('plastic', 'Plastic', 1, 'exact', TRUE),
  ('metal', 'Metals', 2, 'exact', TRUE),
  ('organic', 'Organic/Agricultural Residues', 5, 'exact', TRUE),
  ('other', 'Other Approved Material', 1, 'exact', TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    points_per_kg = EXCLUDED.points_per_kg,
    rounding = EXCLUDED.rounding,
    active = TRUE;
