-- Generate 7 days of heart rate history
-- 2 readings per day (8am, 8pm) × 5 patients × 7 days = 70 records

-- Yamada Taro (山田太郎) - Hypertension patient, stable HR 70-85 bpm
INSERT INTO vital_signs (patient_id, measured_at, heart_rate, input_method, recorded_by)
VALUES
  -- Day -6
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '6 days' + INTERVAL '8 hours', 74, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '6 days' + INTERVAL '20 hours', 77, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -5
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '5 days' + INTERVAL '8 hours', 72, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '5 days' + INTERVAL '20 hours', 79, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -4
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '4 days' + INTERVAL '8 hours', 76, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '4 days' + INTERVAL '20 hours', 80, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -3
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '3 days' + INTERVAL '8 hours', 73, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '3 days' + INTERVAL '20 hours', 78, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -2
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', 75, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '2 days' + INTERVAL '20 hours', 81, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -1
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 74, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '1 day' + INTERVAL '20 hours', 77, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day 0 (today)
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '12 hours', 76, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440201', NOW() - INTERVAL '4 hours', 79, 'manual', '550e8400-e29b-41d4-a716-446655440102');

-- Tanaka Yuki (田中優希) - Post-op recovery, HR 68-78 bpm, gradually improving
INSERT INTO vital_signs (patient_id, measured_at, heart_rate, input_method, recorded_by)
VALUES
  -- Day -6 (slightly elevated post-op)
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '6 days' + INTERVAL '8 hours', 76, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '6 days' + INTERVAL '20 hours', 78, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -5
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '5 days' + INTERVAL '8 hours', 74, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '5 days' + INTERVAL '20 hours', 77, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -4
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '4 days' + INTERVAL '8 hours', 72, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '4 days' + INTERVAL '20 hours', 75, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -3
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '3 days' + INTERVAL '8 hours', 70, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '3 days' + INTERVAL '20 hours', 74, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -2
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', 69, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '2 days' + INTERVAL '20 hours', 73, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -1
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 68, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '1 day' + INTERVAL '20 hours', 72, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day 0 (normalized)
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '12 hours', 68, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440202', NOW() - INTERVAL '4 hours', 71, 'manual', '550e8400-e29b-41d4-a716-446655440101');

-- Sato Kenji (佐藤健二) - Cardiac patient, HR 55-75 bpm, occasional bradycardia
INSERT INTO vital_signs (patient_id, measured_at, heart_rate, input_method, recorded_by)
VALUES
  -- Day -6
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '6 days' + INTERVAL '8 hours', 58, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '6 days' + INTERVAL '20 hours', 67, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -5
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '5 days' + INTERVAL '8 hours', 62, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '5 days' + INTERVAL '20 hours', 70, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -4 (bradycardia episode)
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '4 days' + INTERVAL '8 hours', 54, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '4 days' + INTERVAL '20 hours', 65, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -3
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '3 days' + INTERVAL '8 hours', 60, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '3 days' + INTERVAL '20 hours', 68, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -2
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', 64, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '2 days' + INTERVAL '20 hours', 72, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -1
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 61, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '1 day' + INTERVAL '20 hours', 69, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day 0
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '12 hours', 63, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440203', NOW() - INTERVAL '4 hours', 70, 'manual', '550e8400-e29b-41d4-a716-446655440102');

-- Suzuki Aiko (鈴木愛子) - Normal range, HR 72-88 bpm
INSERT INTO vital_signs (patient_id, measured_at, heart_rate, input_method, recorded_by)
VALUES
  -- Day -6
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '6 days' + INTERVAL '8 hours', 78, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '6 days' + INTERVAL '20 hours', 82, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -5
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '5 days' + INTERVAL '8 hours', 76, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '5 days' + INTERVAL '20 hours', 84, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -4
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '4 days' + INTERVAL '8 hours', 80, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '4 days' + INTERVAL '20 hours', 86, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -3
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '3 days' + INTERVAL '8 hours', 77, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '3 days' + INTERVAL '20 hours', 83, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -2
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', 79, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '2 days' + INTERVAL '20 hours', 85, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day -1
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 78, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '1 day' + INTERVAL '20 hours', 84, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  -- Day 0
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '12 hours', 80, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  ('550e8400-e29b-41d4-a716-446655440204', NOW() - INTERVAL '4 hours', 86, 'manual', '550e8400-e29b-41d4-a716-446655440101');

-- Watanabe Hiroshi (渡辺博) - Elderly dementia patient, stable HR 65-80 bpm
INSERT INTO vital_signs (patient_id, measured_at, heart_rate, input_method, recorded_by)
VALUES
  -- Day -6
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '6 days' + INTERVAL '8 hours', 70, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '6 days' + INTERVAL '20 hours', 74, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -5
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '5 days' + INTERVAL '8 hours', 68, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '5 days' + INTERVAL '20 hours', 73, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -4
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '4 days' + INTERVAL '8 hours', 71, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '4 days' + INTERVAL '20 hours', 76, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -3
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '3 days' + INTERVAL '8 hours', 69, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '3 days' + INTERVAL '20 hours', 75, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -2
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', 70, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '2 days' + INTERVAL '20 hours', 75, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day -1
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 68, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '1 day' + INTERVAL '20 hours', 74, 'manual', '550e8400-e29b-41d4-a716-446655440102'),
  -- Day 0
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '12 hours', 69, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
  ('550e8400-e29b-41d4-a716-446655440205', NOW() - INTERVAL '4 hours', 73, 'manual', '550e8400-e29b-41d4-a716-446655440102');

-- Verification query
SELECT
  p.family_name || ' ' || p.given_name as patient_name,
  COUNT(*) as reading_count,
  MIN(vs.heart_rate) as min_hr,
  MAX(vs.heart_rate) as max_hr,
  ROUND(AVG(vs.heart_rate)::numeric, 1) as avg_hr
FROM vital_signs vs
JOIN patients p ON vs.patient_id = p.patient_id
WHERE vs.heart_rate IS NOT NULL
GROUP BY p.patient_id, patient_name
ORDER BY patient_name;
