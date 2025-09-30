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
INSERT INTO patients (patient_id, facility_id, mrn, family_name, given_name, family_name_kana, given_name_kana, date_of_birth, gender, room, bed, blood_type, admission_date)
VALUES
    ('550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440001', 'MRN001', '山田', '太郎', 'ヤマダ', 'タロウ', '1955-03-15', 'male', '305', 'A', 'A+', '2024-01-10'),
    ('550e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440001', 'MRN002', '田中', '優希', 'タナカ', 'ユウキ', '1978-07-22', 'female', '307', 'B', 'B+', '2024-01-12'),
    ('550e8400-e29b-41d4-a716-446655440203', '550e8400-e29b-41d4-a716-446655440001', 'MRN003', '佐藤', '健二', 'サトウ', 'ケンジ', '1951-11-08', 'male', '309', 'C', 'O+', '2024-01-08'),
    ('550e8400-e29b-41d4-a716-446655440204', '550e8400-e29b-41d4-a716-446655440001', 'MRN004', '鈴木', '愛子', 'スズキ', 'アイコ', '1968-05-30', 'female', '311', 'A', 'AB+', '2024-01-14'),
    ('550e8400-e29b-41d4-a716-446655440205', '550e8400-e29b-41d4-a716-446655440001', 'MRN005', '渡辺', '博', 'ワタナベ', 'ヒロシ', '1943-12-25', 'male', '315', 'B', 'A-', '2024-01-09');

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
INSERT INTO medication_orders (order_id, patient_id, order_number, medication_name_ja, medication_name_en, medication_name_zh, hot_code, dose, dose_unit, route, frequency, scheduled_time, start_datetime, prn, status, ordered_by)
VALUES
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440204', 'ORD004-01', 'セファゾリン', 'Cefazolin', '頭孢唑林', '6132400', '1', 'g', 'iv', 'Q8H', '06:00', '2024-01-14 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440204', 'ORD004-02', 'セファゾリン', 'Cefazolin', '頭孢唑林', '6132400', '1', 'g', 'iv', 'Q8H', '14:00', '2024-01-14 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440204', 'ORD004-03', 'セファゾリン', 'Cefazolin', '頭孢唑林', '6132400', '1', 'g', 'iv', 'Q8H', '22:00', '2024-01-14 00:00:00', false, 'active', '550e8400-e29b-41d4-a716-446655440103'),
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