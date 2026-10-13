INSERT INTO material_types (code, name, points_per_kg, active)
VALUES ('metal', 'Metals', 5, TRUE)
ON CONFLICT (code) DO UPDATE
SET active = TRUE,
    points_per_kg = CASE
      WHEN material_types.points_per_kg <= 0 THEN EXCLUDED.points_per_kg
      ELSE material_types.points_per_kg
    END;
