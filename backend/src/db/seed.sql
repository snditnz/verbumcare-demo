-- VerbumCare Demo Seed Data
-- Realistic Japanese healthcare data for demonstration

-- Insert demo facility
INSERT INTO facilities (facility_id, facility_name, facility_name_ja, facility_name_zh, timezone, language)
VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Nagoya General Hospital', '名古屋総合病院', '名古屋綜合醫院', 'Asia/Tokyo', 'ja');

-- Insert demo staff (2 nurses, 1 physician)
INSERT INTO staff (staff_id, facility_id, employee_number, family_name, given_name, family_name_kana, given_name_kana, role, username, password_hash)
VALUES
    ('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440001', 'N001', '佐藤', '美咲', 'サトウ', 'ミサキ', 'registered_nurse', 'sato.misaki', '$2a$10$YourHashHere'),
    ('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440001', 'N002', '鈴木', '花子', 'スズキ', 'ハナコ', 'registered_nurse', 'suzuki.hanako', '$2a$10$YourHashHere'),
    ('550e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440001', 'D001', '田中', '健一', 'タナカ', 'ケンイチ', 'physician', 'tanaka.kenichi', '$2a$10$YourHashHere');

-- Insert 5 demo patients
INSERT INTO patients (patient_id, facility_id, mrn, family_name, given_name, family_name_kana, given_name_kana, family_name_en, given_name_en, date_of_birth, gender, room, bed, blood_type, admission_date, height_cm, weight_kg, allergies, medications_summary, key_notes, risk_factors, status)
VALUES
    ('550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440001', 'MRN001', '山田', '太郎', 'ヤマダ', 'タロウ', 'Yamada', 'Taro', '1955-03-15', 'male', '305', 'A', 'A+', '2024-01-10', 165.5, 68.2, ARRAY['ペニシリン系抗生物質', 'Penicillin'], 'アムロジピン5mg 1日1回、メトホルミン500mg 1日2回', '糖尿病・高血圧の既往あり。食事制限中。', ARRAY['転倒リスク', '糖尿病', '高血圧'], 'yellow'),
    ('550e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440001', 'MRN002', '田中', '優希', 'タナカ', 'ユウキ', 'Tanaka', 'Yuki', '1978-07-22', 'female', '307', 'B', 'B+', '2024-01-12', 158.0, 52.5, ARRAY['なし', 'None'], '術後鎮痛剤、抗生物質', '術後ケア中。創部の観察が必要。', ARRAY['術後感染リスク'], 'green'),
    ('550e8400-e29b-41d4-a716-446655440203', '550e8400-e29b-41d4-a716-446655440001', 'MRN003', '佐藤', '健二', 'サトウ', 'ケンジ', 'Sato', 'Kenji', '1951-11-08', 'male', '309', 'C', 'O+', '2024-01-08', 172.0, 75.8, ARRAY['造影剤', 'Contrast dye'], 'ワーファリン2mg 1日1回、アスピリン100mg 1日1回', '心臓疾患あり。抗凝固薬服用中。出血リスクに注意。', ARRAY['出血リスク', '心疾患'], 'yellow'),
    ('550e8400-e29b-41d4-a716-446655440204', '550e8400-e29b-41d4-a716-446655440001', 'MRN004', '鈴木', '愛子', 'スズキ', 'アイコ', 'Suzuki', 'Aiko', '1968-05-30', 'female', '311', 'A', 'AB+', '2024-01-14', 155.0, 48.0, ARRAY['卵', 'Eggs'], 'セフェム系抗生物質、解熱鎮痛剤', '抗生物質治療中。アレルギー歴に注意。', ARRAY['薬剤アレルギー'], 'green'),
    ('550e8400-e29b-41d4-a716-446655440205', '550e8400-e29b-41d4-a716-446655440001', 'MRN005', '渡辺', '博', 'ワタナベ', 'ヒロシ', 'Watanabe', 'Hiroshi', '1943-12-25', 'male', '315', 'B', 'A-', '2024-01-09', 168.0, 58.5, ARRAY['なし', 'None'], '認知症治療薬（ドネペジル）、血圧降下剤', '認知症あり。見当識障害のため見守り必要。徘徊リスクあり。', ARRAY['認知症', '徘徊リスク', '転倒リスク'], 'red');

-- Insert medication orders for patients
-- Yamada Taro (山田太郎) - Patient 1
INSERT INTO medication_orders (order_id, patient_id, order_number, medication_name_ja, medication_name_en, medication_name_zh, hot_code, dose, dose_unit, route, frequency, scheduled_time, start_datetime, prn, status, ordered_by)
VALUES
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440201', 'ORD001-01', 'アスピリン', 'Aspirin', '阿司匹林', '1140001', '100', 'mg', 'oral', 'BID', '08:00', '2024-01-10 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440201', 'ORD001-02', 'アスピリン', 'Aspirin', '阿司匹林', '1140001', '100', 'mg', 'oral', 'BID', '20:00', '2024-01-10 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440201', 'ORD001-03', 'メトホルミン', 'Metformin', '二甲雙胍', '3961007', '500', 'mg', 'oral', 'TID', '08:00', '2024-01-10 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440201', 'ORD001-04', 'メトホルミン', 'Metformin', '二甲雙胍', '3961007', '500', 'mg', 'oral', 'TID', '12:00', '2024-01-10 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440201', 'ORD001-05', 'メトホルミン', 'Metformin', '二甲雙胍', '3961007', '500', 'mg', 'oral', 'TID', '18:00', '2024-01-10 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440201', 'ORD001-06', 'アムロジピン', 'Amlodipine', '氨氯地平', '2171022', '5', 'mg', 'oral', 'QD', '09:00', '2024-01-10 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103');

-- Tanaka Yuki (田中優希) - Patient 2
INSERT INTO medication_orders (order_id, patient_id, order_number, medication_name_ja, medication_name_en, medication_name_zh, hot_code, dose, dose_unit, route, frequency, scheduled_time, start_datetime, prn, prn_reason, status, ordered_by)
VALUES
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440202', 'ORD002-01', 'アセトアミノフェン', 'Acetaminophen', '對乙酰氨基酚', '1141007', '500', 'mg', 'oral', 'PRN', NULL, '2024-01-12 00:00:00', true, '疼痛時', 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440202', 'ORD002-02', 'オメプラゾール', 'Omeprazole', '奧美拉唑', '2329023', '20', 'mg', 'oral', 'QD', '08:00', '2024-01-12 00:00:00', false, NULL, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440202', 'ORD002-03', 'レボフロキサシン', 'Levofloxacin', '左氧氟沙星', '6241013', '500', 'mg', 'oral', 'QD', '12:00', '2024-01-12 00:00:00', false, NULL, 'active', '550e8400-e29b-41d4-a716-446655440103');

-- Sato Kenji (佐藤健二) - Patient 3
INSERT INTO medication_orders (order_id, patient_id, order_number, medication_name_ja, medication_name_en, medication_name_zh, hot_code, dose, dose_unit, route, frequency, scheduled_time, start_datetime, prn, status, ordered_by)
VALUES
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440203', 'ORD003-01', 'ワーファリン', 'Warfarin', '華法林', '3332001', '2', 'mg', 'oral', 'QD', '18:00', '2024-01-08 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440203', 'ORD003-02', 'フロセミド', 'Furosemide', '呋塞米', '2139005', '40', 'mg', 'oral', 'BID', '08:00', '2024-01-08 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440203', 'ORD003-03', 'フロセミド', 'Furosemide', '呋塞米', '2139005', '40', 'mg', 'oral', 'BID', '14:00', '2024-01-08 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440203', 'ORD003-04', 'リシノプリル', 'Lisinopril', '賴諾普利', '2144009', '10', 'mg', 'oral', 'QD', '09:00', '2024-01-08 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103');

-- Suzuki Aiko (鈴木愛子) - Patient 4
INSERT INTO medication_orders (order_id, patient_id, order_number, medication_name_ja, medication_name_en, medication_name_zh, hot_code, dose, dose_unit, route, frequency, scheduled_time, start_datetime, prn, prn_reason, status, ordered_by)
VALUES
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440204', 'ORD004-01', 'セファゾリン', 'Cefazolin', '頭孢唑林', '6132400', '1', 'g', 'iv', 'Q8H', '06:00', '2024-01-14 00:00:00', false, NULL, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440204', 'ORD004-02', 'セファゾリン', 'Cefazolin', '頭孢唑林', '6132400', '1', 'g', 'iv', 'Q8H', '14:00', '2024-01-14 00:00:00', false, NULL, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440204', 'ORD004-03', 'セファゾリン', 'Cefazolin', '頭孢唑林', '6132400', '1', 'g', 'iv', 'Q8H', '22:00', '2024-01-14 00:00:00', false, NULL, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440204', 'ORD004-04', 'モルヒネ', 'Morphine', '嗎啡', '8114006', '2', 'mg', 'iv', 'PRN', NULL, '2024-01-14 00:00:00', true, '疼痛時（4時間毎まで）', 'active', '550e8400-e29b-41d4-a716-446655440103');

-- Watanabe Hiroshi (渡辺博) - Patient 5
INSERT INTO medication_orders (order_id, patient_id, order_number, medication_name_ja, medication_name_en, medication_name_zh, hot_code, dose, dose_unit, route, frequency, scheduled_time, start_datetime, prn, status, ordered_by)
VALUES
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440205', 'ORD005-01', 'ドネペジル', 'Donepezil', '多奈哌齊', '1190012', '5', 'mg', 'oral', 'QHS', '21:00', '2024-01-09 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440205', 'ORD005-02', 'リスペリドン', 'Risperidone', '利培酮', '1179038', '0.5', 'mg', 'oral', 'BID', '08:00', '2024-01-09 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440205', 'ORD005-03', 'リスペリドン', 'Risperidone', '利培酮', '1179038', '0.5', 'mg', 'oral', 'BID', '20:00', '2024-01-09 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103');

-- Insert sample vital signs
INSERT INTO vital_signs (patient_id, measured_at, temperature_celsius, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, respiratory_rate, oxygen_saturation, pain_score, input_method, recorded_by)
VALUES
    ('550e8400-e29b-41d4-a716-446655440201', CURRENT_TIMESTAMP - INTERVAL '2 hours', 36.8, 142, 88, 78, 16, 98, 0, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
    ('550e8400-e29b-41d4-a716-446655440202', CURRENT_TIMESTAMP - INTERVAL '3 hours', 37.2, 120, 75, 72, 14, 99, 2, 'iot_sensor', '550e8400-e29b-41d4-a716-446655440102'),
    ('550e8400-e29b-41d4-a716-446655440203', CURRENT_TIMESTAMP - INTERVAL '1 hour', 36.5, 138, 85, 65, 15, 97, 0, 'manual', '550e8400-e29b-41d4-a716-446655440101'),
    ('550e8400-e29b-41d4-a716-446655440204', CURRENT_TIMESTAMP - INTERVAL '30 minutes', 37.1, 115, 72, 88, 18, 96, 4, 'voice', '550e8400-e29b-41d4-a716-446655440102'),
    ('550e8400-e29b-41d4-a716-446655440205', CURRENT_TIMESTAMP - INTERVAL '4 hours', 36.9, 125, 78, 70, 16, 98, 0, 'manual', '550e8400-e29b-41d4-a716-446655440101');

-- Insert sample medication administrations with hash chain
INSERT INTO medication_administrations (
    order_id,
    patient_id,
    scheduled_datetime,
    administered_datetime,
    patient_barcode_scanned,
    patient_barcode_value,
    medication_barcode_scanned,
    medication_barcode_value,
    dose_given,
    route_given,
    status,
    administered_by,
    record_hash,
    previous_hash
)
SELECT
    o.order_id,
    o.patient_id,
    CURRENT_DATE + o.scheduled_time,
    CURRENT_DATE + o.scheduled_time + INTERVAL '5 minutes',
    true,
    'PAT-' || p.mrn,
    true,
    'MED-' || o.hot_code || '-' || o.order_number,
    o.dose,
    o.route,
    'administered',
    '550e8400-e29b-41d4-a716-446655440101',
    encode(sha256((o.order_id::text || o.patient_id::text || (CURRENT_DATE + o.scheduled_time)::text)::bytea), 'hex'),
    CASE
        WHEN ROW_NUMBER() OVER (ORDER BY o.order_id) = 1 THEN '0000000000000000000000000000000000000000000000000000000000000000'
        ELSE LAG(encode(sha256((o.order_id::text || o.patient_id::text || (CURRENT_DATE + o.scheduled_time)::text)::bytea), 'hex')) OVER (ORDER BY o.order_id)
    END
FROM medication_orders o
JOIN patients p ON o.patient_id = p.patient_id
WHERE o.scheduled_time < CURRENT_TIME
  AND o.prn = false
  AND o.status = 'active'
LIMIT 10;

-- Insert Problem Templates for Care Plans (Multilingual)
INSERT INTO problem_templates (category, japanese_text, english_text, chinese_text, suggested_long_term_goals, suggested_short_term_goals, suggested_interventions)
VALUES
  (
    'ADL',
    'トイレ動作の自立困難',
    'Difficulty with independent toileting',
    '如廁動作自理困難',
    '{"ja": ["日中、見守りのみでトイレ動作ができる", "転倒せずにトイレ動作を完了できる"], "en": ["Able to perform toileting with supervision only during daytime", "Complete toileting without falling"], "zh": ["白天僅需監督即可完成如廁動作", "完成如廁動作而不跌倒"]}'::jsonb,
    '{"ja": ["手すりを使用してトイレまで歩行できる", "座位から立位への移乗が安全にできる"], "en": ["Able to walk to toilet using handrails", "Safely transfer from sitting to standing"], "zh": ["能使用扶手步行至廁所", "能安全地從坐姿轉為站姿"]}'::jsonb,
    '{"ja": [{"type": "observation", "description": "トイレ動作時の様子、転倒リスクを毎回観察"}, {"type": "care", "description": "歩行器使用指導、手すり活用支援"}, {"type": "education", "description": "安全なトイレ動作の指導"}], "en": [{"type": "observation", "description": "Observe toileting behavior and fall risk each time"}, {"type": "care", "description": "Walker usage training, handrail utilization support"}, {"type": "education", "description": "Safe toileting technique education"}], "zh": [{"type": "observation", "description": "每次觀察如廁行為及跌倒風險"}, {"type": "care", "description": "助行器使用指導、扶手運用協助"}, {"type": "education", "description": "安全如廁技巧衛教"}]}'::jsonb
  ),
  (
    'fall_prevention',
    '転倒リスクが高い',
    'High risk of falling',
    '跌倒風險高',
    '{"ja": ["6ヶ月間転倒事故ゼロを維持する", "安全な移動方法を習得する"], "en": ["Maintain zero fall incidents for 6 months", "Master safe mobility methods"], "zh": ["維持6個月零跌倒事故", "掌握安全移動方法"]}'::jsonb,
    '{"ja": ["歩行器を正しく使用できる", "ベッドからの起き上がりが安全にできる"], "en": ["Able to use walker correctly", "Safely get up from bed"], "zh": ["能正確使用助行器", "能安全地從床上起身"]}'::jsonb,
    '{"ja": [{"type": "observation", "description": "ふらつき、バランス、歩行状態の継続観察"}, {"type": "care", "description": "環境整備（段差解消、手すり設置）"}, {"type": "education", "description": "転倒予防のための生活指導"}], "en": [{"type": "observation", "description": "Continuous observation of unsteadiness, balance, and gait"}, {"type": "care", "description": "Environmental modifications (remove steps, install handrails)"}, {"type": "education", "description": "Fall prevention lifestyle education"}], "zh": [{"type": "observation", "description": "持續觀察不穩、平衡和步態"}, {"type": "care", "description": "環境改善（消除高低差、設置扶手）"}, {"type": "education", "description": "跌倒預防生活指導"}]}'::jsonb
  ),
  (
    'nutrition',
    '食事摂取量の低下',
    'Decreased food intake',
    '進食量減少',
    '{"ja": ["適正体重を維持する（BMI 18.5-25）", "必要栄養量の80%以上を摂取できる"], "en": ["Maintain appropriate weight (BMI 18.5-25)", "Achieve 80%+ of required nutritional intake"], "zh": ["維持適當體重（BMI 18.5-25）", "達到所需營養攝取量的80%以上"]}'::jsonb,
    '{"ja": ["1日3食、50%以上の摂取ができる", "好みの食事形態を見つける"], "en": ["Achieve 50%+ intake for 3 meals daily", "Find preferred food textures"], "zh": ["每日三餐達到50%以上攝取", "找到喜好的食物質地"]}'::jsonb,
    '{"ja": [{"type": "observation", "description": "食事摂取量、体重変化の記録"}, {"type": "care", "description": "食事形態の工夫、間食の提供"}, {"type": "education", "description": "栄養の重要性について指導"}], "en": [{"type": "observation", "description": "Record food intake and weight changes"}, {"type": "care", "description": "Modify food textures, provide snacks"}, {"type": "education", "description": "Education on importance of nutrition"}], "zh": [{"type": "observation", "description": "記錄進食量和體重變化"}, {"type": "care", "description": "調整食物質地、提供點心"}, {"type": "education", "description": "營養重要性衛教"}]}'::jsonb
  ),
  (
    'pain_management',
    '慢性的な腰痛がある',
    'Chronic low back pain',
    '慢性下背痛',
    '{"ja": ["痛みが日常生活に支障をきたさないレベルまで軽減する", "痛みのセルフマネジメントができる"], "en": ["Reduce pain to level that does not interfere with daily living", "Able to self-manage pain"], "zh": ["將疼痛減輕至不影響日常生活的程度", "能自我管理疼痛"]}'::jsonb,
    '{"ja": ["安静時の痛みがNRS 3以下になる", "痛み軽減のための工夫を3つ以上実践できる"], "en": ["Resting pain reduces to NRS 3 or below", "Implement 3+ pain relief strategies"], "zh": ["靜止時疼痛降至NRS 3以下", "實踐3種以上疼痛緩解策略"]}'::jsonb,
    '{"ja": [{"type": "observation", "description": "痛みの程度、部位、性質の評価（毎日）"}, {"type": "care", "description": "体位変換、温罨法、マッサージの実施"}, {"type": "education", "description": "痛み軽減のためのポジショニング指導"}], "en": [{"type": "observation", "description": "Daily assessment of pain intensity, location, and quality"}, {"type": "care", "description": "Position changes, heat therapy, massage"}, {"type": "education", "description": "Positioning education for pain relief"}], "zh": [{"type": "observation", "description": "每日評估疼痛程度、部位和性質"}, {"type": "care", "description": "變換姿勢、熱敷、按摩"}, {"type": "education", "description": "疼痛緩解姿勢衛教"}]}'::jsonb
  ),
  (
    'cognition',
    '認知機能の低下（見当識障害）',
    'Cognitive decline (disorientation)',
    '認知功能下降（定向力障礙）',
    '{"ja": ["日時の見当識を維持する", "穏やかに施設生活を送ることができる"], "en": ["Maintain time and date orientation", "Live peacefully in facility"], "zh": ["維持時間和日期定向力", "能平和地在機構生活"]}'::jsonb,
    '{"ja": ["曜日と時間帯がわかる", "職員の顔と名前を覚える"], "en": ["Recognize day of week and time of day", "Remember staff faces and names"], "zh": ["能辨識星期和時段", "記住工作人員的臉和姓名"]}'::jsonb,
    '{"ja": [{"type": "observation", "description": "見当識、記憶力、判断力の定期評価"}, {"type": "care", "description": "オリエンテーション支援（カレンダー、時計の活用）"}, {"type": "education", "description": "家族への認知症ケアの指導"}], "en": [{"type": "observation", "description": "Regular assessment of orientation, memory, and judgment"}, {"type": "care", "description": "Orientation support (calendar and clock use)"}, {"type": "education", "description": "Dementia care education for family"}], "zh": [{"type": "observation", "description": "定期評估定向力、記憶力和判斷力"}, {"type": "care", "description": "定向力支援（利用日曆和時鐘）"}, {"type": "education", "description": "失智症照護家屬衛教"}]}'::jsonb
  ),
  (
    'psychosocial',
    '社会的孤立・活動量の低下',
    'Social isolation and decreased activity',
    '社交孤立與活動量減少',
    '{"ja": ["施設内で親しい仲間を作る", "楽しみを見つけ、活動的に過ごす"], "en": ["Make close friends within facility", "Find enjoyment and stay active"], "zh": ["在機構內建立親密友誼", "找到樂趣並保持活躍"]}'::jsonb,
    '{"ja": ["レクリエーションに週3回以上参加する", "他の利用者と会話を楽しむ"], "en": ["Participate in recreation 3+ times per week", "Enjoy conversations with other residents"], "zh": ["每週參加3次以上康樂活動", "享受與其他住民的交談"]}'::jsonb,
    '{"ja": [{"type": "observation", "description": "表情、活動参加状況、他者との交流の観察"}, {"type": "care", "description": "レクリエーション参加の声かけ、趣味活動の提供"}, {"type": "education", "description": "社会参加の重要性について説明"}], "en": [{"type": "observation", "description": "Observe facial expressions, activity participation, social interactions"}, {"type": "care", "description": "Encourage recreation participation, provide hobby activities"}, {"type": "education", "description": "Explain importance of social participation"}], "zh": [{"type": "observation", "description": "觀察表情、活動參與、與他人互動"}, {"type": "care", "description": "鼓勵參與康樂活動、提供嗜好活動"}, {"type": "education", "description": "說明社交參與的重要性"}]}'::jsonb
  );