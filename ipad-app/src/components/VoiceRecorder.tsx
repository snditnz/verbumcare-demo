import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { voiceService } from '@services';
import { UI_COLORS } from '@constants/config';
import { useAssessmentStore } from '@stores/assessmentStore';
import { translations } from '@constants/translations';

interface VoiceRecorderProps {
  onRecordingComplete?: (uri: string, duration: number) => void;
  maxDuration?: number; // in milliseconds
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  maxDuration = 60000, // 60 seconds default
}) => {
  const { language } = useAssessmentStore();
  const t = translations[language];

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    return () => {
      if (isRecording) {
        handleStop();
      }
    };
  }, [isRecording]);

  const handleStart = async () => {
    try {
      const hasPermission = await voiceService.requestPermissions();
      if (!hasPermission) {
        alert(t['voice.permissionDenied']);
        return;
      }

      await voiceService.startRecording(
        (newDuration) => {
          setDuration(newDuration);
        },
        (uri, duration) => {
          // Auto-stop callback
          setIsRecording(false);
          setDuration(duration);
          if (onRecordingComplete) {
            onRecordingComplete(uri, duration);
          }
        }
      );

      setIsRecording(true);
      setDuration(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(t['voice.recordingFailed']);
    }
  };

  const handleStop = async () => {
    try {
      setIsProcessing(true);
      const uri = await voiceService.stopRecording();
      setIsRecording(false);

      if (uri && onRecordingComplete) {
        onRecordingComplete(uri, duration);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert(t['voice.recordingFailed']);
    } finally {
      setIsProcessing(false);
      setDuration(0);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (duration / maxDuration) * 100;

  return (
    <View style={styles.container}>
      {isRecording && (
        <View style={styles.durationContainer}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>{t['voice.recording']}</Text>
          </View>

          <Text style={styles.duration}>{formatDuration(duration)}</Text>
          <Text style={styles.maxDuration}>/ {formatDuration(maxDuration)}</Text>
        </View>
      )}

      {isRecording && (
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(progressPercentage, 100)}%` },
            ]}
          />
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          isRecording ? styles.buttonStop : styles.buttonStart,
        ]}
        onPress={isRecording ? handleStop : handleStart}
        disabled={isProcessing}
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFFFFF" size="large" />
        ) : (
          <>
            <View
              style={[
                styles.buttonIcon,
                isRecording ? styles.buttonIconStop : styles.buttonIconStart,
              ]}
            />
            <Text style={styles.buttonText}>
              {isRecording ? t['voice.stop'] : t['voice.start']}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {!isRecording && duration === 0 && (
        <Text style={styles.hint}>{t['voice.hint']}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: UI_COLORS.error,
  },
  recordingText: {
    fontSize: 14,
    color: UI_COLORS.error,
    fontWeight: '600',
  },
  duration: {
    fontSize: 24,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  maxDuration: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: UI_COLORS.border,
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: UI_COLORS.primary,
  },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonStart: {
    backgroundColor: UI_COLORS.primary,
  },
  buttonStop: {
    backgroundColor: UI_COLORS.error,
  },
  buttonIcon: {
    borderRadius: 4,
  },
  buttonIconStart: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  buttonIconStop: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hint: {
    marginTop: 16,
    fontSize: 14,
    color: UI_COLORS.textSecondary,
    textAlign: 'center',
  },
});
