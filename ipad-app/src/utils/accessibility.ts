import { Language } from '@models';

/**
 * Accessibility Utilities
 * 
 * Provides accessibility labels, hints, and roles for screen readers
 */

export interface AccessibilityProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: string;
  accessibilityState?: any;
  accessibilityValue?: any;
  accessible?: boolean;
}

/**
 * Generate accessibility labels for voice review components
 */
export function getVoiceReviewAccessibility(language: Language) {
  const labels = {
    en: {
      reviewQueue: 'Voice review queue',
      reviewItem: 'Voice review item',
      confidenceBadge: 'AI confidence score',
      urgentBadge: 'Urgent review required',
      transcriptEditor: 'Transcript editor',
      reanalyzeButton: 'Re-analyze transcript',
      confirmButton: 'Confirm and save data',
      discardButton: 'Discard review',
      helpButton: 'Show help and guidance',
      backButton: 'Go back to previous screen',
      refreshButton: 'Refresh review queue',
      extractedDataEditor: 'Extracted data editor',
      confidenceIndicator: 'Data confidence indicator',
      loadingSpinner: 'Loading content',
      errorMessage: 'Error message',
      successMessage: 'Success message',
      warningMessage: 'Warning message',
      infoMessage: 'Information message',
    },
    ja: {
      reviewQueue: '音声レビューキュー',
      reviewItem: '音声レビュー項目',
      confidenceBadge: 'AI信頼度スコア',
      urgentBadge: '緊急レビューが必要',
      transcriptEditor: '文字起こしエディタ',
      reanalyzeButton: '文字起こしを再分析',
      confirmButton: 'データを確定・保存',
      discardButton: 'レビューを破棄',
      helpButton: 'ヘルプとガイダンスを表示',
      backButton: '前の画面に戻る',
      refreshButton: 'レビューキューを更新',
      extractedDataEditor: '抽出データエディタ',
      confidenceIndicator: 'データ信頼度インジケータ',
      loadingSpinner: 'コンテンツを読み込み中',
      errorMessage: 'エラーメッセージ',
      successMessage: '成功メッセージ',
      warningMessage: '警告メッセージ',
      infoMessage: '情報メッセージ',
    },
    'zh-TW': {
      reviewQueue: '語音評論隊列',
      reviewItem: '語音評論項目',
      confidenceBadge: 'AI 信心分數',
      urgentBadge: '需要緊急評論',
      transcriptEditor: '轉錄編輯器',
      reanalyzeButton: '重新分析轉錄',
      confirmButton: '確認並保存數據',
      discardButton: '丟棄評論',
      helpButton: '顯示幫助和指導',
      backButton: '返回上一屏幕',
      refreshButton: '刷新評論隊列',
      extractedDataEditor: '提取數據編輯器',
      confidenceIndicator: '數據信心指示器',
      loadingSpinner: '載入內容中',
      errorMessage: '錯誤消息',
      successMessage: '成功消息',
      warningMessage: '警告消息',
      infoMessage: '信息消息',
    },
  };

  return labels[language] || labels.en;
}

/**
 * Generate accessibility hints for voice review components
 */
export function getVoiceReviewHints(language: Language) {
  const hints = {
    en: {
      reviewItem: 'Double tap to open review screen',
      confidenceBadge: 'Tap to learn about confidence scores',
      transcriptEditor: 'Edit the transcript text, then tap re-analyze to update extracted data',
      reanalyzeButton: 'Tap to re-analyze the transcript with AI',
      confirmButton: 'Double tap to save all data to the database',
      discardButton: 'Double tap to permanently discard this review',
      helpButton: 'Tap to show contextual help and guidance',
      refreshButton: 'Pull down or tap to refresh the review queue',
      extractedDataField: 'Edit this extracted data field',
      confidenceIndicator: 'Shows how confident the AI is about this data',
      urgentItem: 'This review is over 24 hours old and needs attention',
      loadingState: 'Content is loading, please wait',
      errorRetry: 'Tap to retry the failed operation',
    },
    ja: {
      reviewItem: 'ダブルタップでレビュー画面を開く',
      confidenceBadge: 'タップして信頼度スコアについて学ぶ',
      transcriptEditor: '文字起こしテキストを編集し、再分析をタップして抽出データを更新',
      reanalyzeButton: 'タップしてAIで文字起こしを再分析',
      confirmButton: 'ダブルタップしてすべてのデータをデータベースに保存',
      discardButton: 'ダブルタップしてこのレビューを完全に破棄',
      helpButton: 'タップしてコンテキストヘルプとガイダンスを表示',
      refreshButton: '下にプルするかタップしてレビューキューを更新',
      extractedDataField: 'この抽出データフィールドを編集',
      confidenceIndicator: 'AIがこのデータについてどの程度確信しているかを示す',
      urgentItem: 'このレビューは24時間以上経過しており、注意が必要',
      loadingState: 'コンテンツを読み込み中、お待ちください',
      errorRetry: 'タップして失敗した操作を再試行',
    },
    'zh-TW': {
      reviewItem: '雙擊打開評論屏幕',
      confidenceBadge: '點擊了解信心分數',
      transcriptEditor: '編輯轉錄文本，然後點擊重新分析以更新提取的數據',
      reanalyzeButton: '點擊使用 AI 重新分析轉錄',
      confirmButton: '雙擊將所有數據保存到數據庫',
      discardButton: '雙擊永久丟棄此評論',
      helpButton: '點擊顯示上下文幫助和指導',
      refreshButton: '下拉或點擊刷新評論隊列',
      extractedDataField: '編輯此提取數據字段',
      confidenceIndicator: '顯示 AI 對此數據的信心程度',
      urgentItem: '此評論已超過 24 小時，需要注意',
      loadingState: '內容載入中，請稍候',
      errorRetry: '點擊重試失敗的操作',
    },
  };

  return hints[language] || hints.en;
}

/**
 * Generate accessibility state for interactive elements
 */
export function getAccessibilityState(props: {
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  expanded?: boolean;
  checked?: boolean;
}) {
  return {
    disabled: props.disabled || props.loading,
    selected: props.selected,
    expanded: props.expanded,
    checked: props.checked,
  };
}

/**
 * Generate accessibility value for progress indicators
 */
export function getAccessibilityValue(props: {
  current?: number;
  max?: number;
  min?: number;
  text?: string;
}) {
  if (props.text) {
    return { text: props.text };
  }

  if (props.current !== undefined && props.max !== undefined) {
    return {
      min: props.min || 0,
      max: props.max,
      now: props.current,
    };
  }

  return undefined;
}

/**
 * Generate confidence score accessibility description
 */
export function getConfidenceAccessibilityDescription(
  confidence: number,
  language: Language
): string {
  const percentage = Math.round(confidence * 100);
  
  const descriptions = {
    en: {
      high: `High confidence: ${percentage} percent. This data is likely accurate.`,
      medium: `Medium confidence: ${percentage} percent. Please review this data carefully.`,
      low: `Low confidence: ${percentage} percent. This data requires verification.`,
    },
    ja: {
      high: `高信頼度: ${percentage}パーセント。このデータは正確である可能性が高いです。`,
      medium: `中信頼度: ${percentage}パーセント。このデータを慎重にレビューしてください。`,
      low: `低信頼度: ${percentage}パーセント。このデータは検証が必要です。`,
    },
    'zh-TW': {
      high: `高信心：${percentage}％。此數據可能準確。`,
      medium: `中等信心：${percentage}％。請仔細審查此數據。`,
      low: `低信心：${percentage}％。此數據需要驗證。`,
    },
  };

  const langDescriptions = descriptions[language] || descriptions.en;

  if (confidence >= 0.8) {
    return langDescriptions.high;
  } else if (confidence >= 0.6) {
    return langDescriptions.medium;
  } else {
    return langDescriptions.low;
  }
}

/**
 * Generate review queue item accessibility description
 */
export function getReviewItemAccessibilityDescription(
  item: any,
  language: Language
): string {
  const labels = getVoiceReviewAccessibility(language);
  const confidence = Math.round(item.confidence * 100);
  const isUrgent = item.isUrgent;
  const patientName = item.contextPatientName || labels.reviewItem;
  
  const descriptions = {
    en: `${patientName} voice review. Confidence ${confidence} percent. ${isUrgent ? 'Urgent attention required.' : ''} Recorded ${item.timeAgo}.`,
    ja: `${patientName}の音声レビュー。信頼度${confidence}パーセント。${isUrgent ? '緊急対応が必要。' : ''} ${item.timeAgo}に記録。`,
    'zh-TW': `${patientName}語音評論。信心${confidence}％。${isUrgent ? '需要緊急關注。' : ''} ${item.timeAgo}錄製。`,
  };

  return descriptions[language] || descriptions.en;
}

/**
 * High contrast mode utilities
 */
export function getHighContrastColors() {
  return {
    background: '#000000',
    surface: '#1a1a1a',
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
      disabled: '#666666',
    },
    primary: '#0099ff',
    success: '#00ff00',
    warning: '#ffff00',
    error: '#ff0000',
    border: '#ffffff',
  };
}

/**
 * Focus management utilities
 */
export function announceLiveRegion(message: string, priority: 'polite' | 'assertive' = 'polite') {
  // This would integrate with React Native's AccessibilityInfo.announceForAccessibility
  // For now, we return the configuration
  return {
    message,
    priority,
  };
}

/**
 * Keyboard navigation helpers
 */
export function getKeyboardNavigationProps(props: {
  onFocus?: () => void;
  onBlur?: () => void;
  onActivate?: () => void;
}) {
  return {
    accessible: true,
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    // React Native doesn't have direct keyboard event handling like web
    // This would be handled through focus management and accessibility actions
  };
}