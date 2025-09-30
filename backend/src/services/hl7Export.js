import dayjs from 'dayjs';

const HL7_FIELD_SEPARATOR = '|';
const HL7_COMPONENT_SEPARATOR = '^';
const HL7_REPETITION_SEPARATOR = '~';
const HL7_ESCAPE_CHARACTER = '\\';
const HL7_SUBCOMPONENT_SEPARATOR = '&';

function formatHL7DateTime(date) {
  return dayjs(date).format('YYYYMMDDHHMMSS');
}

function escapeHL7Text(text) {
  if (!text) return '';
  return text
    .replace(/\|/g, '\\F\\')
    .replace(/\^/g, '\\S\\')
    .replace(/&/g, '\\T\\')
    .replace(/~/g, '\\R\\')
    .replace(/\\/g, '\\E\\')
    .replace(/\r\n/g, '\\X0D\\X0A\\')
    .replace(/\n/g, '\\X0A\\')
    .replace(/\r/g, '\\X0D\\');
}

function generateMSH(sendingApplication = 'VerbumCare', receivingApplication = 'EMR', messageType = 'ADT^A01', controlId = null) {
  const timestamp = formatHL7DateTime(new Date());
  const messageControlId = controlId || `MSG${timestamp}${Math.random().toString(36).substring(2, 8)}`;

  return [
    'MSH',
    `${HL7_FIELD_SEPARATOR}${HL7_COMPONENT_SEPARATOR}${HL7_REPETITION_SEPARATOR}${HL7_ESCAPE_CHARACTER}${HL7_SUBCOMPONENT_SEPARATOR}`,
    sendingApplication,
    '',
    receivingApplication,
    '',
    timestamp,
    '',
    messageType,
    messageControlId,
    'P',
    '2.5',
    '',
    '',
    '',
    '',
    'JP'
  ].join(HL7_FIELD_SEPARATOR);
}

function generatePID(patientData, facilityData = {}) {
  const age = patientData.age || '';
  const fullNameKana = `${patientData.family_name_kana || ''}^${patientData.given_name_kana || ''}`;
  const fullName = `${patientData.family_name || ''}^${patientData.given_name || ''}`;
  const dateOfBirth = patientData.date_of_birth ? dayjs(patientData.date_of_birth).format('YYYYMMDD') : '';

  return [
    'PID',
    '1',
    patientData.mrn || '',
    patientData.patient_id || '',
    '',
    `${fullName}^${fullNameKana}`,
    '',
    dateOfBirth,
    patientData.gender === 'male' ? 'M' : patientData.gender === 'female' ? 'F' : 'U',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ].join(HL7_FIELD_SEPARATOR);
}

function generatePV1(patientData, facilityData = {}) {
  const room = patientData.room || '';
  const bed = patientData.bed || '';
  const location = room && bed ? `${room}^${bed}` : room || bed || '';

  return [
    'PV1',
    '1',
    'I',
    location,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ].join(HL7_FIELD_SEPARATOR);
}

export function generateHL7_ADT_A01(patientData, facilityData = {}) {
  const controlId = `ADT${formatHL7DateTime(new Date())}`;

  const segments = [
    generateMSH('VerbumCare', facilityData.facility_name || 'Hospital', 'ADT^A01^ADT_A01', controlId),
    generatePID(patientData, facilityData),
    generatePV1(patientData, facilityData)
  ];

  return segments.join('\r');
}

export function generateHL7_ORU_R01(vitalSignsData, patientData, facilityData = {}) {
  const controlId = `ORU${formatHL7DateTime(new Date())}`;
  const timestamp = formatHL7DateTime(vitalSignsData.measured_at || new Date());

  const segments = [
    generateMSH('VerbumCare', facilityData.facility_name || 'Hospital', 'ORU^R01^ORU_R01', controlId),
    generatePID(patientData, facilityData),
    generatePV1(patientData, facilityData)
  ];

  const obrSegment = [
    'OBR',
    '1',
    '',
    '',
    'VS^Vital Signs^L',
    '',
    timestamp,
    '',
    '',
    '',
    '',
    '',
    timestamp,
    '',
    '',
    vitalSignsData.recorded_by_name || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    timestamp,
    '',
    '',
    ''
  ].join(HL7_FIELD_SEPARATOR);

  segments.push(obrSegment);

  let observationIndex = 1;

  if (vitalSignsData.blood_pressure_systolic && vitalSignsData.blood_pressure_diastolic) {
    const bpSegment = [
      'OBX',
      observationIndex++,
      'NM',
      '8480-6^Systolic blood pressure^LN',
      '',
      vitalSignsData.blood_pressure_systolic,
      'mm[Hg]',
      '90-140',
      vitalSignsData.blood_pressure_systolic > 140 || vitalSignsData.blood_pressure_systolic < 90 ? 'A' : 'N',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      ''
    ].join(HL7_FIELD_SEPARATOR);

    const dbpSegment = [
      'OBX',
      observationIndex++,
      'NM',
      '8462-4^Diastolic blood pressure^LN',
      '',
      vitalSignsData.blood_pressure_diastolic,
      'mm[Hg]',
      '60-90',
      vitalSignsData.blood_pressure_diastolic > 90 || vitalSignsData.blood_pressure_diastolic < 60 ? 'A' : 'N',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      ''
    ].join(HL7_FIELD_SEPARATOR);

    segments.push(bpSegment, dbpSegment);
  }

  if (vitalSignsData.heart_rate) {
    const hrSegment = [
      'OBX',
      observationIndex++,
      'NM',
      '8867-4^Heart rate^LN',
      '',
      vitalSignsData.heart_rate,
      '/min',
      '60-100',
      vitalSignsData.heart_rate > 100 || vitalSignsData.heart_rate < 60 ? 'A' : 'N',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      ''
    ].join(HL7_FIELD_SEPARATOR);

    segments.push(hrSegment);
  }

  if (vitalSignsData.temperature_celsius) {
    const tempSegment = [
      'OBX',
      observationIndex++,
      'NM',
      '8310-5^Body temperature^LN',
      '',
      vitalSignsData.temperature_celsius,
      'Cel',
      '36.0-37.5',
      vitalSignsData.temperature_celsius > 37.5 || vitalSignsData.temperature_celsius < 36.0 ? 'A' : 'N',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      ''
    ].join(HL7_FIELD_SEPARATOR);

    segments.push(tempSegment);
  }

  if (vitalSignsData.respiratory_rate) {
    const rrSegment = [
      'OBX',
      observationIndex++,
      'NM',
      '9279-1^Respiratory rate^LN',
      '',
      vitalSignsData.respiratory_rate,
      '/min',
      '12-20',
      vitalSignsData.respiratory_rate > 20 || vitalSignsData.respiratory_rate < 12 ? 'A' : 'N',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      ''
    ].join(HL7_FIELD_SEPARATOR);

    segments.push(rrSegment);
  }

  if (vitalSignsData.oxygen_saturation) {
    const spo2Segment = [
      'OBX',
      observationIndex++,
      'NM',
      '2708-6^Oxygen saturation^LN',
      '',
      vitalSignsData.oxygen_saturation,
      '%',
      '95-100',
      vitalSignsData.oxygen_saturation < 95 ? 'L' : 'N',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      ''
    ].join(HL7_FIELD_SEPARATOR);

    segments.push(spo2Segment);
  }

  if (vitalSignsData.pain_score !== null && vitalSignsData.pain_score !== undefined) {
    const painSegment = [
      'OBX',
      observationIndex++,
      'NM',
      '72133-2^Pain severity^LN',
      '',
      vitalSignsData.pain_score,
      '{score}',
      '0-3',
      vitalSignsData.pain_score > 3 ? 'H' : 'N',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      ''
    ].join(HL7_FIELD_SEPARATOR);

    segments.push(painSegment);
  }

  return segments.join('\r');
}

export function generateHL7_RDE_O11(medicationAdminData, orderData, patientData, facilityData = {}) {
  const controlId = `RDE${formatHL7DateTime(new Date())}`;
  const timestamp = formatHL7DateTime(medicationAdminData.administered_datetime || new Date());

  const segments = [
    generateMSH('VerbumCare', facilityData.facility_name || 'Hospital', 'RDE^O11^RDE_O11', controlId),
    generatePID(patientData, facilityData),
    generatePV1(patientData, facilityData)
  ];

  const orcSegment = [
    'ORC',
    'RE',
    orderData.order_number || '',
    '',
    '',
    '',
    '',
    '',
    timestamp,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ].join(HL7_FIELD_SEPARATOR);

  segments.push(orcSegment);

  const medicationName = escapeHL7Text(orderData.medication_name_en || orderData.medication_name_ja || '');
  const hotCode = orderData.hot_code || '';

  const rxeSegment = [
    'RXE',
    '',
    `${hotCode}^${medicationName}^L`,
    orderData.dose || '',
    orderData.dose_unit || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ].join(HL7_FIELD_SEPARATOR);

  segments.push(rxeSegment);

  const rxaSegment = [
    'RXA',
    '0',
    '1',
    timestamp,
    timestamp,
    `${hotCode}^${medicationName}^L`,
    medicationAdminData.dose_given || orderData.dose || '',
    orderData.dose_unit || '',
    '',
    '',
    medicationAdminData.administered_by || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    medicationAdminData.status === 'administered' ? 'CP' : medicationAdminData.status === 'refused' ? 'RE' : 'NA',
    '',
    '',
    '',
    '',
    '',
    ''
  ].join(HL7_FIELD_SEPARATOR);

  segments.push(rxaSegment);

  return segments.join('\r');
}

export function generateHL7_MDM_T02(assessmentData, patientData, facilityData = {}) {
  const controlId = `MDM${formatHL7DateTime(new Date())}`;
  const timestamp = formatHL7DateTime(assessmentData.assessment_datetime || new Date());

  const segments = [
    generateMSH('VerbumCare', facilityData.facility_name || 'Hospital', 'MDM^T02^MDM_T02', controlId),
    generatePID(patientData, facilityData),
    generatePV1(patientData, facilityData)
  ];

  const tdaSegment = [
    'TXA',
    '1',
    'PN',
    assessmentData.assessment_type || 'nursing',
    '',
    timestamp,
    '',
    timestamp,
    '',
    '',
    '',
    assessmentData.assessed_by || '',
    '',
    '',
    '',
    '',
    'AU',
    'AV',
    '',
    ''
  ].join(HL7_FIELD_SEPARATOR);

  segments.push(tdaSegment);

  if (assessmentData.narrative_notes) {
    const obxSegment = [
      'OBX',
      '1',
      'TX',
      'NOTE^Clinical Note^L',
      '',
      escapeHL7Text(assessmentData.narrative_notes),
      '',
      '',
      '',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      ''
    ].join(HL7_FIELD_SEPARATOR);

    segments.push(obxSegment);
  }

  return segments.join('\r');
}

export function generateSS_MIX2_Export(data, facilityData = {}) {
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const header = {
    version: '2.0',
    facility: facilityData.facility_name || 'VerbumCare Demo Hospital',
    export_timestamp: timestamp,
    record_count: data.length
  };

  const records = data.map(record => ({
    patient_id: record.patient_id,
    mrn: record.mrn,
    name: {
      family: record.family_name,
      given: record.given_name,
      family_kana: record.family_name_kana,
      given_kana: record.given_name_kana
    },
    demographics: {
      date_of_birth: record.date_of_birth,
      gender: record.gender,
      blood_type: record.blood_type
    },
    admission: {
      date: record.admission_date,
      room: record.room,
      bed: record.bed
    },
    medications: record.medications || [],
    vital_signs: record.vital_signs || [],
    assessments: record.assessments || []
  }));

  return {
    header,
    records
  };
}

export default {
  generateHL7_ADT_A01,
  generateHL7_ORU_R01,
  generateHL7_RDE_O11,
  generateHL7_MDM_T02,
  generateSS_MIX2_Export
};