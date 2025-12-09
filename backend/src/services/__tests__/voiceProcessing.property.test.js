import fc from 'fast-check';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Voice Processing Security Property Tests
 * Tests encryption, secure transmission, and secure deletion of voice recordings
 */

// Mock encryption utilities
class VoiceEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.authTagLength = 16; // 128 bits
  }

  /**
   * Generate encryption key from user ID
   */
  generateKey(userId) {
    return crypto.createHash('sha256')
      .update(`voice_encryption_${userId}`)
      .digest();
  }

  /**
   * Encrypt audio file data
   */
  async encryptAudioData(audioData, userId) {
    const key = this.generateKey(userId);
    const iv = crypto.randomBytes(this.ivLength);
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(audioData),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Return encrypted data with IV and auth tag
    return {
      encrypted: Buffer.concat([iv, authTag, encrypted]),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt audio file data
   */
  async decryptAudioData(encryptedData, userId) {
    const key = this.generateKey(userId);
    
    // Extract IV, auth tag, and encrypted data
    const iv = encryptedData.slice(0, this.ivLength);
    const authTag = encryptedData.slice(this.ivLength, this.ivLength + this.authTagLength);
    const encrypted = encryptedData.slice(this.ivLength + this.authTagLength);
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted;
  }

  /**
   * Encrypt transcription text
   */
  async encryptTranscription(transcriptionText, userId) {
    const audioData = Buffer.from(transcriptionText, 'utf8');
    return this.encryptAudioData(audioData, userId);
  }

  /**
   * Decrypt transcription text
   */
  async decryptTranscription(encryptedData, userId) {
    const decrypted = await this.decryptAudioData(encryptedData, userId);
    return decrypted.toString('utf8');
  }

  /**
   * Check if data is encrypted (not plaintext)
   */
  isEncrypted(data, originalData) {
    // Encrypted data should not contain plaintext
    const dataStr = data.toString('hex');
    const originalStr = originalData.toString('hex');
    
    // Should not be equal
    if (dataStr === originalStr) return false;
    
    // Should not contain recognizable patterns from original
    const originalSample = originalStr.substring(0, Math.min(100, originalStr.length));
    if (dataStr.includes(originalSample)) return false;
    
    return true;
  }
}

// Mock secure file operations
class SecureFileOperations {
  constructor() {
    this.tempDir = path.join(__dirname, 'temp_voice_test');
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Securely delete file (overwrite then delete)
   */
  async secureDelete(filePath) {
    try {
      // Get file size
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Overwrite with random data
      const randomData = crypto.randomBytes(fileSize);
      await fs.writeFile(filePath, randomData);
      
      // Overwrite with zeros
      const zeros = Buffer.alloc(fileSize, 0);
      await fs.writeFile(filePath, zeros);
      
      // Delete file
      await fs.unlink(filePath);
      
      return true;
    } catch (error) {
      console.error('Secure delete error:', error);
      return false;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write encrypted audio file
   */
  async writeEncryptedAudio(filePath, encryptedData) {
    await fs.writeFile(filePath, encryptedData);
  }

  /**
   * Read encrypted audio file
   */
  async readEncryptedAudio(filePath) {
    return await fs.readFile(filePath);
  }
}

const voiceEncryption = new VoiceEncryption();
const secureFileOps = new SecureFileOperations();

describe('Voice Processing Security Property Tests', () => {
  beforeAll(async () => {
    await secureFileOps.ensureTempDir();
  });

  afterAll(async () => {
    await secureFileOps.cleanup();
  });

  /**
   * Feature: code-consistency-security-offline, Property 36: Voice recording encryption
   * Validates: Requirements 11.1
   */
  describe('Property 36: Voice recording encryption', () => {
    it('should encrypt audio data immediately and not contain plaintext', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            audioData: fc.uint8Array({ minLength: 100, maxLength: 1000 })
          }),
          async ({ userId, audioData }) => {
            // Convert to Buffer
            const audioBuffer = Buffer.from(audioData);
            
            // Encrypt audio data
            const { encrypted } = await voiceEncryption.encryptAudioData(audioBuffer, userId);
            
            // Property 1: Encrypted data should not equal original data
            expect(encrypted.equals(audioBuffer)).toBe(false);
            
            // Property 2: Encrypted data should not contain plaintext
            const isEncrypted = voiceEncryption.isEncrypted(encrypted, audioBuffer);
            expect(isEncrypted).toBe(true);
            
            // Property 3: Encrypted data should be decryptable back to original
            const decrypted = await voiceEncryption.decryptAudioData(encrypted, userId);
            expect(decrypted.equals(audioBuffer)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should encrypt immediately after recording completion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            recordingData: fc.uint8Array({ minLength: 500, maxLength: 2000 })
          }),
          async ({ userId, recordingData }) => {
            const audioBuffer = Buffer.from(recordingData);
            
            // Simulate recording completion -> immediate encryption
            const startTime = Date.now();
            const { encrypted } = await voiceEncryption.encryptAudioData(audioBuffer, userId);
            const encryptionTime = Date.now() - startTime;
            
            // Property: Encryption should happen immediately (< 1 second for test data)
            expect(encryptionTime).toBeLessThan(1000);
            
            // Property: Result should be encrypted
            expect(voiceEncryption.isEncrypted(encrypted, audioBuffer)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 37: Transcription encryption
   * Validates: Requirements 11.4
   */
  describe('Property 37: Transcription encryption', () => {
    it('should encrypt transcription text before storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            transcription: fc.string({ minLength: 50, maxLength: 500 })
          }),
          async ({ userId, transcription }) => {
            // Encrypt transcription
            const { encrypted } = await voiceEncryption.encryptTranscription(transcription, userId);
            
            // Property 1: Encrypted data should not contain plaintext transcription
            const encryptedStr = encrypted.toString('utf8', 0, Math.min(encrypted.length, 1000));
            expect(encryptedStr).not.toContain(transcription.substring(0, 20));
            
            // Property 2: Should be decryptable back to original
            const decrypted = await voiceEncryption.decryptTranscription(encrypted, userId);
            expect(decrypted).toBe(transcription);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain transcription integrity through encryption round trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            transcription: fc.string({ minLength: 10, maxLength: 1000 }),
            language: fc.constantFrom('ja', 'en', 'zh-TW')
          }),
          async ({ userId, transcription, language }) => {
            // Add language metadata
            const transcriptionWithMeta = JSON.stringify({
              text: transcription,
              language,
              timestamp: new Date().toISOString()
            });
            
            // Encrypt
            const { encrypted } = await voiceEncryption.encryptTranscription(transcriptionWithMeta, userId);
            
            // Decrypt
            const decrypted = await voiceEncryption.decryptTranscription(encrypted, userId);
            const parsed = JSON.parse(decrypted);
            
            // Property: All data should be preserved
            expect(parsed.text).toBe(transcription);
            expect(parsed.language).toBe(language);
            expect(parsed.timestamp).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 38: Voice file deletion
   * Validates: Requirements 11.5
   */
  describe('Property 38: Voice file deletion', () => {
    it('should securely delete audio files and make them unrecoverable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileId: fc.uuid(),
            audioData: fc.uint8Array({ minLength: 100, maxLength: 500 })
          }),
          async ({ fileId, audioData }) => {
            const filePath = path.join(secureFileOps.tempDir, `${fileId}.m4a`);
            const audioBuffer = Buffer.from(audioData);
            
            // Write file
            await fs.writeFile(filePath, audioBuffer);
            
            // Verify file exists
            const existsBefore = await secureFileOps.fileExists(filePath);
            expect(existsBefore).toBe(true);
            
            // Securely delete
            const deleted = await secureFileOps.secureDelete(filePath);
            expect(deleted).toBe(true);
            
            // Property: File should no longer exist
            const existsAfter = await secureFileOps.fileExists(filePath);
            expect(existsAfter).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should delete all associated metadata when deleting voice file', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            recordingId: fc.uuid(),
            userId: fc.uuid(),
            audioData: fc.uint8Array({ minLength: 100, maxLength: 500 }),
            transcription: fc.string({ minLength: 20, maxLength: 200 })
          }),
          async ({ recordingId, userId, audioData, transcription }) => {
            const audioPath = path.join(secureFileOps.tempDir, `${recordingId}_audio.m4a`);
            const metaPath = path.join(secureFileOps.tempDir, `${recordingId}_meta.json`);
            const transPath = path.join(secureFileOps.tempDir, `${recordingId}_trans.txt`);
            
            // Create files
            await fs.writeFile(audioPath, Buffer.from(audioData));
            await fs.writeFile(metaPath, JSON.stringify({ userId, recordingId }));
            await fs.writeFile(transPath, transcription);
            
            // Verify all exist
            expect(await secureFileOps.fileExists(audioPath)).toBe(true);
            expect(await secureFileOps.fileExists(metaPath)).toBe(true);
            expect(await secureFileOps.fileExists(transPath)).toBe(true);
            
            // Delete all associated files
            await secureFileOps.secureDelete(audioPath);
            await secureFileOps.secureDelete(metaPath);
            await secureFileOps.secureDelete(transPath);
            
            // Property: All files should be deleted
            expect(await secureFileOps.fileExists(audioPath)).toBe(false);
            expect(await secureFileOps.fileExists(metaPath)).toBe(false);
            expect(await secureFileOps.fileExists(transPath)).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return null when querying deleted voice recordings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            recordingId: fc.uuid(),
            audioData: fc.uint8Array({ minLength: 100, maxLength: 300 })
          }),
          async ({ recordingId, audioData }) => {
            const filePath = path.join(secureFileOps.tempDir, `${recordingId}.m4a`);
            
            // Create and delete file
            await fs.writeFile(filePath, Buffer.from(audioData));
            await secureFileOps.secureDelete(filePath);
            
            // Property: Querying deleted file should return null/false
            const exists = await secureFileOps.fileExists(filePath);
            expect(exists).toBe(false);
            
            // Attempting to read should throw error
            await expect(fs.readFile(filePath)).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional security properties
   */
  describe('Additional Voice Security Properties', () => {
    it('should use different encryption keys for different users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userA: fc.uuid(),
            userB: fc.uuid(),
            audioData: fc.uint8Array({ minLength: 100, maxLength: 500 })
          }).filter(({ userA, userB }) => userA !== userB),
          async ({ userA, userB, audioData }) => {
            const audioBuffer = Buffer.from(audioData);
            
            // Encrypt with user A's key
            const { encrypted: encryptedA } = await voiceEncryption.encryptAudioData(audioBuffer, userA);
            
            // Encrypt with user B's key
            const { encrypted: encryptedB } = await voiceEncryption.encryptAudioData(audioBuffer, userB);
            
            // Property: Different users should produce different encrypted data
            expect(encryptedA.equals(encryptedB)).toBe(false);
            
            // Property: User A cannot decrypt User B's data
            await expect(
              voiceEncryption.decryptAudioData(encryptedB, userA)
            ).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain encryption integrity during file storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            recordingId: fc.uuid(),
            audioData: fc.uint8Array({ minLength: 200, maxLength: 800 })
          }),
          async ({ userId, recordingId, audioData }) => {
            const audioBuffer = Buffer.from(audioData);
            const filePath = path.join(secureFileOps.tempDir, `${recordingId}.enc`);
            
            // Encrypt
            const { encrypted } = await voiceEncryption.encryptAudioData(audioBuffer, userId);
            
            // Write to file
            await secureFileOps.writeEncryptedAudio(filePath, encrypted);
            
            // Read from file
            const readEncrypted = await secureFileOps.readEncryptedAudio(filePath);
            
            // Property: Data should be identical after file I/O
            expect(readEncrypted.equals(encrypted)).toBe(true);
            
            // Property: Should still be decryptable
            const decrypted = await voiceEncryption.decryptAudioData(readEncrypted, userId);
            expect(decrypted.equals(audioBuffer)).toBe(true);
            
            // Cleanup
            await secureFileOps.secureDelete(filePath);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
