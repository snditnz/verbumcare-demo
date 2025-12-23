#!/usr/bin/env node
/**
 * Script to add comprehensive Traditional Chinese (zh-TW) translations
 * Run with: node scripts/add-zh-tw-translations.js
 */

const fs = require('fs');
const path = require('path');

// Comprehensive Traditional Chinese translations
// NOTE: These should be reviewed by a native Taiwanese speaker,
// especially medical and care-related terminology
const zhTWTranslations = {
  // Workflow steps
  'workflow.patient-list': '患者列表',
  'workflow.patient-scan': '條碼掃描',
  'workflow.vitals-capture': '生命徵象測量',
  'workflow.adl-voice': 'ADL語音記錄',
  'workflow.incident-report': '事件報告',
  'workflow.review-confirm': '審查確認',

  // Patient list
  'patient-list.title': '患者列表',
  'patient-list.scan-barcode': '掃描條碼',
  'patient-list.room': '房間',
  'patient-list.bed': '床位',
  'patient-list.age': '歲',
  'patient-list.risk-factors': '風險因素',
  'patient.selectPatient': '選擇患者',
  'patient.selectHint': '請選擇要評估的患者',
  'patient.information': '患者資訊',
  'patient.room': '房間',
  'patient.allRooms': '所有房間',

  // Patient scan
  'scan.title': '患者條碼掃描',
  'scan.instruction': '請掃描患者條碼',
  'scan.success': '掃描成功',
  'scan.mismatch': '患者不符',
  'scan.mismatchMessage': '掃描的患者與所選患者不符',
  'scan.invalidFormat': '無效條碼',
  'scan.invalidFormatMessage': '條碼格式不正確（預期格式：PAT-XXXX）',
  'scan.cameraPermission': '需要相機權限',
  'scan.scanAgain': '重新掃描',

  // Common
  'common.back': '返回',
  'common.next': '下一步',
  'common.continue': '繼續',
  'common.skip': '跳過',
  'common.cancel': '取消',
  'common.confirm': '確認',
  'common.discard': '放棄',
  'common.save': '儲存'
};

// Export the translations
module.exports = zhTWTranslations;
