-- Migration: Update demo patients with realistic aged care data
-- Date: 2025-10-06
-- This updates the existing 5 demo patients to match the frontend DEMO_PATIENTS

-- Update Patient 1: 山田 花子 (Yamada Hanako) - 82yo female
UPDATE patients
SET
    family_name = '山田',
    given_name = '花子',
    family_name_en = 'Yamada',
    given_name_en = 'Hanako',
    gender = 'female',
    date_of_birth = '1942-03-15',  -- 82 years old
    room = '301',
    bed = 'A',
    height_cm = 152,
    weight_kg = 48,
    allergies = 'ペニシリン系抗生物質',
    medications_summary = 'アリセプト 5mg、アムロジピン 5mg、ワーファリン 2mg',
    key_notes = '認知症により服薬管理に介助が必要。転倒予防のため夜間は見守りを強化。',
    risk_factors = ARRAY['認知症', '転倒リスク'],
    status = 'yellow'
WHERE mrn = 'MRN001';

-- Update Patient 2: 佐藤 太郎 (Sato Taro) - 78yo male
UPDATE patients
SET
    family_name = '佐藤',
    given_name = '太郎',
    family_name_en = 'Sato',
    given_name_en = 'Taro',
    gender = 'male',
    date_of_birth = '1946-07-22',  -- 78 years old
    room = '302',
    bed = 'A',
    height_cm = 168,
    weight_kg = 62,
    allergies = 'なし',
    medications_summary = 'レボドパ 100mg、ビ・シフロール 0.5mg、メネシット 100mg',
    key_notes = '車椅子での移動が主。リハビリテーション継続中。嚥下機能は良好。',
    risk_factors = ARRAY[]::TEXT[],
    status = 'green'
WHERE mrn = 'MRN002';

-- Update Patient 3: 鈴木 美智子 (Suzuki Michiko) - 89yo female
UPDATE patients
SET
    family_name = '鈴木',
    given_name = '美智子',
    family_name_en = 'Suzuki',
    given_name_en = 'Michiko',
    gender = 'female',
    date_of_birth = '1935-11-08',  -- 89 years old
    room = '303',
    bed = 'B',
    height_cm = 148,
    weight_kg = 38,
    allergies = 'NSAID (ロキソニン、ボルタレン)',
    medications_summary = 'ラシックス 20mg、アルダクトン 25mg、ラックビー R 散',
    key_notes = '全介助。褥瘡予防のため2時間毎の体位交換が必要。経管栄養実施中。',
    risk_factors = ARRAY['寝たきり', '褥瘡リスク', '嚥下障害'],
    status = 'red'
WHERE mrn = 'MRN003';

-- Update Patient 4: 田中 次郎 (Tanaka Jiro) - 75yo male
UPDATE patients
SET
    family_name = '田中',
    given_name = '次郎',
    family_name_en = 'Tanaka',
    given_name_en = 'Jiro',
    gender = 'male',
    date_of_birth = '1949-05-30',  -- 75 years old
    room = '304',
    bed = 'A',
    height_cm = 172,
    weight_kg = 68,
    allergies = 'なし',
    medications_summary = 'メマリー 10mg、マイスリー 5mg、ルネスタ 2mg',
    key_notes = '軽度認知障害。夜間の徘徊防止のためセンサーマット使用。日中の活動を促す。',
    risk_factors = ARRAY[]::TEXT[],
    status = 'green'
WHERE mrn = 'MRN004';

-- Update Patient 5: 伊藤 幸子 (Ito Sachiko) - 91yo female
UPDATE patients
SET
    family_name = '伊藤',
    given_name = '幸子',
    family_name_en = 'Ito',
    given_name_en = 'Sachiko',
    gender = 'female',
    date_of_birth = '1933-12-25',  -- 91 years old
    room = '305',
    bed = 'A',
    height_cm = 145,
    weight_kg = 35,
    allergies = 'なし',
    medications_summary = 'ラシックス 40mg、ジゴキシン 0.125mg、スピロノラクトン 25mg、エンシュア 1日2缶',
    key_notes = '心不全管理のため毎日の体重測定と水分管理が重要。低栄養のため栄養補助食品を使用。',
    risk_factors = ARRAY['心不全', '転倒歴あり', '低栄養'],
    status = 'red'
WHERE mrn = 'MRN005';

-- Insert Barthel Index assessments for each patient
INSERT INTO barthel_assessments (patient_id, total_score, category_scores, assessed_at, assessed_by, input_method)
SELECT
    patient_id,
    65,
    '{"eating": 10, "transfer": 10, "toileting": 5, "walking": 10, "grooming": 5, "bathing": 0, "stairs": 5, "dressing": 10, "bowel": 5, "bladder": 5}'::jsonb,
    CURRENT_DATE - INTERVAL '1 day',
    '550e8400-e29b-41d4-a716-446655440101',
    'form'
FROM patients WHERE mrn = 'MRN001'
ON CONFLICT DO NOTHING;

INSERT INTO barthel_assessments (patient_id, total_score, category_scores, assessed_at, assessed_by, input_method)
SELECT
    patient_id,
    75,
    '{"eating": 10, "transfer": 10, "toileting": 10, "walking": 10, "grooming": 5, "bathing": 5, "stairs": 5, "dressing": 10, "bowel": 5, "bladder": 5}'::jsonb,
    CURRENT_DATE - INTERVAL '2 days',
    '550e8400-e29b-41d4-a716-446655440101',
    'form'
FROM patients WHERE mrn = 'MRN002'
ON CONFLICT DO NOTHING;

INSERT INTO barthel_assessments (patient_id, total_score, category_scores, assessed_at, assessed_by, input_method)
SELECT
    patient_id,
    15,
    '{"eating": 5, "transfer": 0, "toileting": 0, "walking": 0, "grooming": 0, "bathing": 0, "stairs": 0, "dressing": 5, "bowel": 0, "bladder": 5}'::jsonb,
    CURRENT_DATE - INTERVAL '3 days',
    '550e8400-e29b-41d4-a716-446655440102',
    'form'
FROM patients WHERE mrn = 'MRN003'
ON CONFLICT DO NOTHING;

INSERT INTO barthel_assessments (patient_id, total_score, category_scores, assessed_at, assessed_by, input_method)
SELECT
    patient_id,
    85,
    '{"eating": 10, "transfer": 15, "toileting": 10, "walking": 10, "grooming": 5, "bathing": 5, "stairs": 5, "dressing": 10, "bowel": 10, "bladder": 5}'::jsonb,
    CURRENT_DATE - INTERVAL '1 day',
    '550e8400-e29b-41d4-a716-446655440101',
    'form'
FROM patients WHERE mrn = 'MRN004'
ON CONFLICT DO NOTHING;

INSERT INTO barthel_assessments (patient_id, total_score, category_scores, assessed_at, assessed_by, input_method)
SELECT
    patient_id,
    45,
    '{"eating": 5, "transfer": 5, "toileting": 5, "walking": 5, "grooming": 5, "bathing": 0, "stairs": 0, "dressing": 5, "bowel": 10, "bladder": 5}'::jsonb,
    CURRENT_DATE - INTERVAL '2 days',
    '550e8400-e29b-41d4-a716-446655440102',
    'form'
FROM patients WHERE mrn = 'MRN005'
ON CONFLICT DO NOTHING;

COMMENT ON MIGRATION IS 'Updated demo patients to match frontend DEMO_PATIENTS with realistic aged care data';
