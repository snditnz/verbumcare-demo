import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { VOICE_CONFIG } from '@constants/config';

class VoiceService {
  private recording: Audio.Recording | null = null;
  private recordingDuration: number = 0;
  private durationInterval: NodeJS.Timeout | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  async startRecording(onDurationUpdate?: (duration: number) => void): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: VOICE_CONFIG.SAMPLE_RATE,
            numberOfChannels: VOICE_CONFIG.CHANNELS,
            bitRate: VOICE_CONFIG.BITRATE,
          },
          ios: {
            extension: '.m4a',
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: VOICE_CONFIG.SAMPLE_RATE,
            numberOfChannels: VOICE_CONFIG.CHANNELS,
            bitRate: VOICE_CONFIG.BITRATE,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {},
        },
        (status) => {
          if (status.isRecording) {
            this.recordingDuration = status.durationMillis;
          }
        }
      );

      this.recording = recording;
      this.recordingDuration = 0;

      // Update duration every second
      this.durationInterval = setInterval(() => {
        this.recordingDuration += 1000;
        onDurationUpdate?.(this.recordingDuration);

        // Auto-stop at max duration
        if (this.recordingDuration >= VOICE_CONFIG.MAX_DURATION) {
          this.stopRecording();
        }
      }, 1000);

    } catch (error) {
      console.error('Start recording error:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording) return null;

      if (this.durationInterval) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      this.recording = null;
      this.recordingDuration = 0;

      return uri;
    } catch (error) {
      console.error('Stop recording error:', error);
      throw error;
    }
  }

  async pauseRecording(): Promise<void> {
    if (this.recording) {
      await this.recording.pauseAsync();
      if (this.durationInterval) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }
    }
  }

  async resumeRecording(): Promise<void> {
    if (this.recording) {
      await this.recording.startAsync();
      // Resume duration interval
      this.durationInterval = setInterval(() => {
        this.recordingDuration += 1000;
      }, 1000);
    }
  }

  async cancelRecording(): Promise<void> {
    if (this.recording) {
      const uri = await this.stopRecording();
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    }
  }

  getDuration(): number {
    return this.recordingDuration;
  }

  isRecording(): boolean {
    return this.recording !== null;
  }
}

export const voiceService = new VoiceService();
export default voiceService;
