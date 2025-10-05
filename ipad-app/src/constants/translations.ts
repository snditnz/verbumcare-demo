import { Language } from '@types';

type TranslationKey = string;
type Translations = Record<Language, Record<TranslationKey, string>>;

export const translations: Translations = {
  ja: {
    // Workflow steps
    'workflow.patient-list': '患者選択',
    'workflow.patient-scan': 'バーコードスキャン',
    'workflow.vitals-capture': 'バイタル測定',
    'workflow.adl-voice': 'ADL音声記録',
    'workflow.incident-report': 'インシデント報告',
    'workflow.review-confirm': '確認・送信',

    // Patient list
    'patient-list.title': '患者一覧',
    'patient-list.scan-barcode': 'バーコードスキャン',
    'patient-list.room': '病室',
    'patient-list.bed': 'ベッド',
    'patient-list.age': '歳',
    'patient-list.risk-factors': 'リスク要因',

    // Vitals
    'vitals.title': 'バイタルサイン測定',
    'vitals.connect-device': '血圧計を接続',
    'vitals.scanning': 'デバイス検索中...',
    'vitals.connecting': '接続中...',
    'vitals.connected': '接続完了',
    'vitals.disconnected': '未接続',
    'vitals.retry': '再接続',
    'vitals.bp-systolic': '収縮期血圧',
    'vitals.bp-diastolic': '拡張期血圧',
    'vitals.pulse': '脈拍',
    'vitals.mmHg': 'mmHg',
    'vitals.bpm': '回/分',
    'vitals.take-reading': '測定開始',
    'vitals.continue': '次へ進む',

    // Voice recording
    'voice.title': 'ADL音声記録',
    'voice.instructions': '60秒以内で患者のADL状況を記録してください',
    'voice.start-recording': '録音開始',
    'voice.stop-recording': '録音停止',
    'voice.recording': '録音中...',
    'voice.uploading': 'アップロード中...',
    'voice.processing': 'AI処理中...',
    'voice.complete': '完了',
    'voice.retry': '再録音',

    // Review
    'review.title': '確認・送信',
    'review.patient-info': '患者情報',
    'review.vitals': 'バイタルサイン',
    'review.adl-data': 'ADLデータ',
    'review.processing': '処理中...',
    'review.submit': '送信',
    'review.cancel': 'キャンセル',

    // Common
    'common.back': '戻る',
    'common.next': '次へ',
    'common.cancel': 'キャンセル',
    'common.save': '保存',
    'common.error': 'エラー',
    'common.loading': '読み込み中...',
    'common.retry': '再試行',
    'common.success': '成功',
  },
  en: {
    // Workflow steps
    'workflow.patient-list': 'Patient List',
    'workflow.patient-scan': 'Barcode Scan',
    'workflow.vitals-capture': 'Vitals Capture',
    'workflow.adl-voice': 'ADL Voice',
    'workflow.incident-report': 'Incident Report',
    'workflow.review-confirm': 'Review & Confirm',

    // Patient list
    'patient-list.title': 'Patient List',
    'patient-list.scan-barcode': 'Scan Barcode',
    'patient-list.room': 'Room',
    'patient-list.bed': 'Bed',
    'patient-list.age': 'yo',
    'patient-list.risk-factors': 'Risk Factors',

    // Vitals
    'vitals.title': 'Vital Signs Measurement',
    'vitals.connect-device': 'Connect BP Monitor',
    'vitals.scanning': 'Scanning for devices...',
    'vitals.connecting': 'Connecting...',
    'vitals.connected': 'Connected',
    'vitals.disconnected': 'Disconnected',
    'vitals.retry': 'Reconnect',
    'vitals.bp-systolic': 'Systolic BP',
    'vitals.bp-diastolic': 'Diastolic BP',
    'vitals.pulse': 'Pulse',
    'vitals.mmHg': 'mmHg',
    'vitals.bpm': 'bpm',
    'vitals.take-reading': 'Take Reading',
    'vitals.continue': 'Continue',

    // Voice recording
    'voice.title': 'ADL Voice Recording',
    'voice.instructions': 'Record ADL assessment within 60 seconds',
    'voice.start-recording': 'Start Recording',
    'voice.stop-recording': 'Stop Recording',
    'voice.recording': 'Recording...',
    'voice.uploading': 'Uploading...',
    'voice.processing': 'AI Processing...',
    'voice.complete': 'Complete',
    'voice.retry': 'Re-record',

    // Review
    'review.title': 'Review & Submit',
    'review.patient-info': 'Patient Info',
    'review.vitals': 'Vital Signs',
    'review.adl-data': 'ADL Data',
    'review.processing': 'Processing...',
    'review.submit': 'Submit',
    'review.cancel': 'Cancel',

    // Common
    'common.back': 'Back',
    'common.next': 'Next',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.error': 'Error',
    'common.loading': 'Loading...',
    'common.retry': 'Retry',
    'common.success': 'Success',
  },
};

export const t = (key: TranslationKey, lang: Language = 'ja'): string => {
  return translations[lang][key] || key;
};
