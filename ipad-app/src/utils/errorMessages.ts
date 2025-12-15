import { Language } from '@models';

/**
 * Error Messages Utility
 * 
 * Provides user-friendly error messages for all error types in the voice categorization system
 */

export interface ErrorContext {
  operation: string;
  details?: any;
  code?: string;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  actionText?: string;
  action?: () => void;
  type: 'error' | 'warning' | 'info';
}

/**
 * Voice Processing Error Messages
 */
export const VOICE_PROCESSING_ERRORS = {
  RECORDING_FAILED: {
    en: {
      title: 'Recording Failed',
      message: 'Unable to record audio. Please check microphone permissions and try again.',
      actionText: 'Retry Recording',
    },
    ja: {
      title: '録音に失敗しました',
      message: 'オーディオを録音できません。マイクの許可を確認して、もう一度お試しください。',
      actionText: '録音を再試行',
    },
    'zh-TW': {
      title: '錄音失敗',
      message: '無法錄製音頻。請檢查麥克風權限並重試。',
      actionText: '重試錄音',
    },
  },
  TRANSCRIPTION_FAILED: {
    en: {
      title: 'Transcription Failed',
      message: 'Unable to convert speech to text. The audio may be unclear or the service is temporarily unavailable.',
      actionText: 'Try Again',
    },
    ja: {
      title: '文字起こしに失敗しました',
      message: '音声をテキストに変換できません。音声が不明瞭であるか、サービスが一時的に利用できない可能性があります。',
      actionText: 'もう一度試す',
    },
    'zh-TW': {
      title: '轉錄失敗',
      message: '無法將語音轉換為文字。音頻可能不清楚或服務暫時不可用。',
      actionText: '重試',
    },
  },
  CATEGORIZATION_FAILED: {
    en: {
      title: 'AI Analysis Failed',
      message: 'Unable to analyze and categorize the transcript. Please try re-analyzing or edit the data manually.',
      actionText: 'Re-analyze',
    },
    ja: {
      title: 'AI分析に失敗しました',
      message: 'トランスクリプトの分析と分類ができません。再分析するか、データを手動で編集してください。',
      actionText: '再分析',
    },
    'zh-TW': {
      title: 'AI 分析失敗',
      message: '無法分析和分類轉錄內容。請嘗試重新分析或手動編輯數據。',
      actionText: '重新分析',
    },
  },
  EXTRACTION_FAILED: {
    en: {
      title: 'Data Extraction Failed',
      message: 'Unable to extract structured data from the transcript. The content may not contain recognizable medical information.',
      actionText: 'Edit Manually',
    },
    ja: {
      title: 'データ抽出に失敗しました',
      message: 'トランスクリプトから構造化データを抽出できません。内容に認識可能な医療情報が含まれていない可能性があります。',
      actionText: '手動で編集',
    },
    'zh-TW': {
      title: '數據提取失敗',
      message: '無法從轉錄中提取結構化數據。內容可能不包含可識別的醫療信息。',
      actionText: '手動編輯',
    },
  },
  SAVE_FAILED: {
    en: {
      title: 'Save Failed',
      message: 'Unable to save the data to the database. Your changes have been preserved and will be retried automatically.',
      actionText: 'Retry Now',
    },
    ja: {
      title: '保存に失敗しました',
      message: 'データベースにデータを保存できません。変更は保持されており、自動的に再試行されます。',
      actionText: '今すぐ再試行',
    },
    'zh-TW': {
      title: '保存失敗',
      message: '無法將數據保存到數據庫。您的更改已保留，將自動重試。',
      actionText: '立即重試',
    },
  },
  NETWORK_ERROR: {
    en: {
      title: 'Network Error',
      message: 'Unable to connect to the server. Your work is saved locally and will sync when connection is restored.',
      actionText: 'Check Connection',
    },
    ja: {
      title: 'ネットワークエラー',
      message: 'サーバーに接続できません。作業はローカルに保存され、接続が復旧すると同期されます。',
      actionText: '接続を確認',
    },
    'zh-TW': {
      title: '網絡錯誤',
      message: '無法連接到服務器。您的工作已在本地保存，連接恢復後將同步。',
      actionText: '檢查連接',
    },
  },
  PERMISSION_DENIED: {
    en: {
      title: 'Permission Required',
      message: 'Microphone access is required for voice recording. Please enable permissions in Settings.',
      actionText: 'Open Settings',
    },
    ja: {
      title: '許可が必要です',
      message: '音声録音にはマイクアクセスが必要です。設定で許可を有効にしてください。',
      actionText: '設定を開く',
    },
    'zh-TW': {
      title: '需要權限',
      message: '語音錄製需要麥克風訪問權限。請在設置中啟用權限。',
      actionText: '打開設置',
    },
  },
};

/**
 * Review Queue Error Messages
 */
export const REVIEW_QUEUE_ERRORS = {
  LOAD_FAILED: {
    en: {
      title: 'Failed to Load Reviews',
      message: 'Unable to load your pending reviews. Please check your connection and try again.',
      actionText: 'Refresh',
    },
    ja: {
      title: 'レビューの読み込みに失敗しました',
      message: '保留中のレビューを読み込めません。接続を確認して、もう一度お試しください。',
      actionText: '更新',
    },
    'zh-TW': {
      title: '加載評論失敗',
      message: '無法加載您的待處理評論。請檢查您的連接並重試。',
      actionText: '刷新',
    },
  },
  REVIEW_NOT_FOUND: {
    en: {
      title: 'Review Not Found',
      message: 'The requested review could not be found. It may have been processed by another user or deleted.',
      actionText: 'Back to Queue',
    },
    ja: {
      title: 'レビューが見つかりません',
      message: '要求されたレビューが見つかりませんでした。他のユーザーによって処理されたか、削除された可能性があります。',
      actionText: 'キューに戻る',
    },
    'zh-TW': {
      title: '找不到評論',
      message: '找不到請求的評論。它可能已被其他用戶處理或刪除。',
      actionText: '返回隊列',
    },
  },
  CONFIRM_FAILED: {
    en: {
      title: 'Confirmation Failed',
      message: 'Unable to confirm and save the review. Please check the data and try again.',
      actionText: 'Try Again',
    },
    ja: {
      title: '確認に失敗しました',
      message: 'レビューの確認と保存ができません。データを確認して、もう一度お試しください。',
      actionText: 'もう一度試す',
    },
    'zh-TW': {
      title: '確認失敗',
      message: '無法確認並保存評論。請檢查數據並重試。',
      actionText: '重試',
    },
  },
};

/**
 * Validation Error Messages
 */
export const VALIDATION_ERRORS = {
  INVALID_VITAL_SIGNS: {
    en: {
      title: 'Invalid Vital Signs',
      message: 'Some vital sign values are outside normal ranges. Please verify the measurements before saving.',
      actionText: 'Review Values',
    },
    ja: {
      title: '無効なバイタルサイン',
      message: '一部のバイタルサインの値が正常範囲外です。保存前に測定値を確認してください。',
      actionText: '値を確認',
    },
    'zh-TW': {
      title: '無效的生命體徵',
      message: '某些生命體徵值超出正常範圍。請在保存前驗證測量值。',
      actionText: '檢查數值',
    },
  },
  MISSING_REQUIRED_FIELDS: {
    en: {
      title: 'Missing Required Information',
      message: 'Some required fields are empty. Please fill in all necessary information before saving.',
      actionText: 'Complete Fields',
    },
    ja: {
      title: '必要な情報が不足しています',
      message: '一部の必須フィールドが空です。保存前に必要な情報をすべて入力してください。',
      actionText: 'フィールドを完成',
    },
    'zh-TW': {
      title: '缺少必需信息',
      message: '某些必填字段為空。請在保存前填寫所有必要信息。',
      actionText: '完成字段',
    },
  },
  INVALID_MEDICATION: {
    en: {
      title: 'Invalid Medication Data',
      message: 'The medication information appears to be incomplete or invalid. Please verify the drug name, dosage, and route.',
      actionText: 'Check Medication',
    },
    ja: {
      title: '無効な薬物データ',
      message: '薬物情報が不完全または無効のようです。薬物名、用量、投与経路を確認してください。',
      actionText: '薬物を確認',
    },
    'zh-TW': {
      title: '無效的藥物數據',
      message: '藥物信息似乎不完整或無效。請驗證藥物名稱、劑量和給藥途徑。',
      actionText: '檢查藥物',
    },
  },
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(
  errorType: string,
  language: Language,
  context?: ErrorContext
): UserFriendlyError {
  // Find error in all error categories
  const allErrors = {
    ...VOICE_PROCESSING_ERRORS,
    ...REVIEW_QUEUE_ERRORS,
    ...VALIDATION_ERRORS,
  };

  const errorConfig = allErrors[errorType as keyof typeof allErrors];
  
  if (!errorConfig) {
    // Fallback for unknown errors
    return {
      title: language === 'ja' ? 'エラーが発生しました' : 
             language === 'zh-TW' ? '發生錯誤' : 'An Error Occurred',
      message: language === 'ja' ? '予期しないエラーが発生しました。もう一度お試しください。' :
               language === 'zh-TW' ? '發生意外錯誤。請重試。' : 
               'An unexpected error occurred. Please try again.',
      actionText: language === 'ja' ? 'もう一度試す' :
                  language === 'zh-TW' ? '重試' : 'Try Again',
      type: 'error',
    };
  }

  const localizedError = errorConfig[language] || errorConfig.en;
  
  return {
    ...localizedError,
    type: 'error',
  };
}

/**
 * Get contextual help messages for first-time users
 */
export const HELP_MESSAGES = {
  VOICE_RECORDING: {
    en: {
      title: 'Voice Recording Tips',
      message: 'Speak clearly and at a normal pace. Include patient name, vital signs, medications, or observations. The AI will automatically categorize your input.',
      tips: [
        'Hold the device 6-12 inches from your mouth',
        'Speak in a quiet environment when possible',
        'Include specific numbers and units (e.g., "120 over 80 mmHg")',
        'Mention the patient name for automatic association',
      ],
    },
    ja: {
      title: '音声録音のコツ',
      message: 'はっきりと通常のペースで話してください。患者名、バイタルサイン、薬物、または観察を含めてください。AIが自動的に入力を分類します。',
      tips: [
        'デバイスを口から15-30cm離して持つ',
        '可能な限り静かな環境で話す',
        '具体的な数値と単位を含める（例：「120/80mmHg」）',
        '自動関連付けのために患者名を言及する',
      ],
    },
    'zh-TW': {
      title: '語音錄製技巧',
      message: '請清晰地以正常語速說話。包括患者姓名、生命體徵、藥物或觀察。AI 將自動分類您的輸入。',
      tips: [
        '將設備保持在距離嘴部 15-30 公分處',
        '盡可能在安靜的環境中說話',
        '包含具體數字和單位（例如："120/80mmHg"）',
        '提及患者姓名以便自動關聯',
      ],
    },
  },
  CONFIDENCE_SCORES: {
    en: {
      title: 'Understanding Confidence Scores',
      message: 'Confidence scores show how certain the AI is about extracted data. Higher scores mean more reliable data.',
      tips: [
        'Green (80-100%): High confidence - likely accurate',
        'Yellow (60-79%): Medium confidence - review recommended',
        'Red (0-59%): Low confidence - verification required',
        'Always review low confidence extractions before saving',
      ],
    },
    ja: {
      title: '信頼度スコアの理解',
      message: '信頼度スコアは、AIが抽出されたデータについてどの程度確信しているかを示します。スコアが高いほど、データの信頼性が高くなります。',
      tips: [
        '緑（80-100%）：高信頼度 - 正確である可能性が高い',
        '黄（60-79%）：中信頼度 - レビュー推奨',
        '赤（0-59%）：低信頼度 - 検証が必要',
        '保存前に低信頼度の抽出を常にレビューする',
      ],
    },
    'zh-TW': {
      title: '理解信心分數',
      message: '信心分數顯示 AI 對提取數據的確定程度。分數越高，數據越可靠。',
      tips: [
        '綠色（80-100%）：高信心 - 可能準確',
        '黃色（60-79%）：中等信心 - 建議審查',
        '紅色（0-59%）：低信心 - 需要驗證',
        '保存前始終審查低信心提取',
      ],
    },
  },
  REVIEW_QUEUE: {
    en: {
      title: 'Managing Your Review Queue',
      message: 'The review queue shows all voice recordings waiting for your approval. Process them in chronological order for best workflow.',
      tips: [
        'Red badges indicate urgent items (>24 hours old)',
        'Tap any item to open the review screen',
        'Pull down to refresh the queue',
        'Items are automatically ordered oldest first',
      ],
    },
    ja: {
      title: 'レビューキューの管理',
      message: 'レビューキューには、承認を待っているすべての音声録音が表示されます。最適なワークフローのために時系列順に処理してください。',
      tips: [
        '赤いバッジは緊急項目（24時間以上経過）を示す',
        '任意の項目をタップしてレビュー画面を開く',
        '下にプルしてキューを更新',
        '項目は自動的に古い順に並べられる',
      ],
    },
    'zh-TW': {
      title: '管理您的審查隊列',
      message: '審查隊列顯示所有等待您批准的語音錄製。按時間順序處理以獲得最佳工作流程。',
      tips: [
        '紅色徽章表示緊急項目（超過 24 小時）',
        '點擊任何項目打開審查屏幕',
        '下拉刷新隊列',
        '項目自動按最舊優先排序',
      ],
    },
  },
};

/**
 * Get help message for a specific topic
 */
export function getHelpMessage(topic: string, language: Language) {
  const helpConfig = HELP_MESSAGES[topic as keyof typeof HELP_MESSAGES];
  
  if (!helpConfig) {
    return null;
  }

  return helpConfig[language] || helpConfig.en;
}