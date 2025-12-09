import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Voice Encryption Service
 * Handles encryption/decryption of voice recordings and transcriptions
 * Implements AES-256-GCM for authenticated encryption
 */

class VoiceEncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.authTagLength = 16; // 128 bits
  }

  /**
   * Generate encryption key from user ID
   * Uses SHA-256 to derive a consistent key from user ID
   * 
   * @param {string} userId - User ID to generate key for
   * @returns {Buffer} - 256-bit encryption key
   */
  generateKey(userId) {
    return crypto.createHash('sha256')
      .update(`voice_encryption_${userId}`)
      .digest();
  }

  /**
   * Encrypt audio file data
   * Uses AES-256-GCM for authenticated encryption
   * 
   * @param {Buffer} audioData - Audio file data to encrypt
   * @param {string} userId - User ID for key derivation
   * @returns {Promise<Object>} - Encrypted data with IV and auth tag
   */
  async encryptAudioData(audioData, userId) {
    try {
      const key = this.generateKey(userId);
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(audioData),
        cipher.final()
      ]);
      
      const authTag = cipher.getAuthTag();
      
      // Return encrypted data with IV and auth tag prepended
      return {
        encrypted: Buffer.concat([iv, authTag, encrypted]),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Audio encryption error:', error);
      throw new Error(`Failed to encrypt audio data: ${error.message}`);
    }
  }

  /**
   * Decrypt audio file data
   * 
   * @param {Buffer} encryptedData - Encrypted data (IV + auth tag + encrypted)
   * @param {string} userId - User ID for key derivation
   * @returns {Promise<Buffer>} - Decrypted audio data
   */
  async decryptAudioData(encryptedData, userId) {
    try {
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
    } catch (error) {
      console.error('Audio decryption error:', error);
      throw new Error(`Failed to decrypt audio data: ${error.message}`);
    }
  }

  /**
   * Encrypt audio file in place
   * Reads file, encrypts it, and writes encrypted version
   * 
   * @param {string} filePath - Path to audio file
   * @param {string} userId - User ID for encryption
   * @returns {Promise<string>} - Path to encrypted file
   */
  async encryptAudioFile(filePath, userId) {
    try {
      console.log(`🔒 Encrypting audio file: ${filePath}`);
      
      // Read original file
      const audioData = await fs.readFile(filePath);
      
      // Encrypt
      const { encrypted } = await this.encryptAudioData(audioData, userId);
      
      // Write encrypted file with .enc extension
      const encryptedPath = `${filePath}.enc`;
      await fs.writeFile(encryptedPath, encrypted);
      
      console.log(`✅ Audio file encrypted: ${encryptedPath}`);
      
      return encryptedPath;
    } catch (error) {
      console.error('File encryption error:', error);
      throw new Error(`Failed to encrypt audio file: ${error.message}`);
    }
  }

  /**
   * Decrypt audio file
   * 
   * @param {string} encryptedPath - Path to encrypted file
   * @param {string} userId - User ID for decryption
   * @param {string} outputPath - Path for decrypted file (optional)
   * @returns {Promise<string>} - Path to decrypted file
   */
  async decryptAudioFile(encryptedPath, userId, outputPath = null) {
    try {
      console.log(`🔓 Decrypting audio file: ${encryptedPath}`);
      
      // Read encrypted file
      const encryptedData = await fs.readFile(encryptedPath);
      
      // Decrypt
      const decrypted = await this.decryptAudioData(encryptedData, userId);
      
      // Determine output path
      const decryptedPath = outputPath || encryptedPath.replace('.enc', '');
      await fs.writeFile(decryptedPath, decrypted);
      
      console.log(`✅ Audio file decrypted: ${decryptedPath}`);
      
      return decryptedPath;
    } catch (error) {
      console.error('File decryption error:', error);
      throw new Error(`Failed to decrypt audio file: ${error.message}`);
    }
  }

  /**
   * Encrypt transcription text
   * 
   * @param {string} transcriptionText - Transcription to encrypt
   * @param {string} userId - User ID for encryption
   * @returns {Promise<Object>} - Encrypted transcription
   */
  async encryptTranscription(transcriptionText, userId) {
    try {
      const audioData = Buffer.from(transcriptionText, 'utf8');
      return await this.encryptAudioData(audioData, userId);
    } catch (error) {
      console.error('Transcription encryption error:', error);
      throw new Error(`Failed to encrypt transcription: ${error.message}`);
    }
  }

  /**
   * Decrypt transcription text
   * 
   * @param {Buffer} encryptedData - Encrypted transcription
   * @param {string} userId - User ID for decryption
   * @returns {Promise<string>} - Decrypted transcription text
   */
  async decryptTranscription(encryptedData, userId) {
    try {
      const decrypted = await this.decryptAudioData(encryptedData, userId);
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Transcription decryption error:', error);
      throw new Error(`Failed to decrypt transcription: ${error.message}`);
    }
  }

  /**
   * Securely delete file
   * Overwrites file with random data then zeros before deletion
   * 
   * @param {string} filePath - Path to file to delete
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async secureDelete(filePath) {
    try {
      console.log(`🗑️  Securely deleting file: ${filePath}`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        console.log(`⚠️  File does not exist: ${filePath}`);
        return true; // Already deleted
      }
      
      // Get file size
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Overwrite with random data (3 passes)
      for (let i = 0; i < 3; i++) {
        const randomData = crypto.randomBytes(fileSize);
        await fs.writeFile(filePath, randomData);
      }
      
      // Overwrite with zeros
      const zeros = Buffer.alloc(fileSize, 0);
      await fs.writeFile(filePath, zeros);
      
      // Delete file
      await fs.unlink(filePath);
      
      console.log(`✅ File securely deleted: ${filePath}`);
      
      return true;
    } catch (error) {
      console.error('Secure delete error:', error);
      return false;
    }
  }

  /**
   * Securely delete voice recording and all associated files
   * Deletes audio file, encrypted file, and any metadata files
   * 
   * @param {string} recordingId - Recording ID
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<Object>} - Deletion results
   */
  async secureDeleteRecording(recordingId, audioFilePath) {
    try {
      console.log(`🗑️  Securely deleting recording: ${recordingId}`);
      
      const results = {
        audioFile: false,
        encryptedFile: false,
        metadataFile: false
      };
      
      // Delete original audio file
      if (audioFilePath) {
        const fullPath = path.isAbsolute(audioFilePath) 
          ? audioFilePath 
          : path.join(process.cwd(), audioFilePath);
        results.audioFile = await this.secureDelete(fullPath);
      }
      
      // Delete encrypted file if exists
      const encryptedPath = `${audioFilePath}.enc`;
      const fullEncryptedPath = path.isAbsolute(encryptedPath)
        ? encryptedPath
        : path.join(process.cwd(), encryptedPath);
      
      try {
        await fs.access(fullEncryptedPath);
        results.encryptedFile = await this.secureDelete(fullEncryptedPath);
      } catch {
        // Encrypted file doesn't exist
        results.encryptedFile = true;
      }
      
      // Delete metadata file if exists
      const metadataPath = audioFilePath.replace(path.extname(audioFilePath), '.meta.json');
      const fullMetadataPath = path.isAbsolute(metadataPath)
        ? metadataPath
        : path.join(process.cwd(), metadataPath);
      
      try {
        await fs.access(fullMetadataPath);
        results.metadataFile = await this.secureDelete(fullMetadataPath);
      } catch {
        // Metadata file doesn't exist
        results.metadataFile = true;
      }
      
      console.log(`✅ Recording securely deleted: ${recordingId}`, results);
      
      return results;
    } catch (error) {
      console.error('Recording deletion error:', error);
      throw new Error(`Failed to securely delete recording: ${error.message}`);
    }
  }

  /**
   * Check if data is encrypted (not plaintext)
   * 
   * @param {Buffer} data - Data to check
   * @param {Buffer} originalData - Original plaintext data
   * @returns {boolean} - True if data appears encrypted
   */
  isEncrypted(data, originalData) {
    try {
      // Encrypted data should not equal original
      if (data.equals(originalData)) return false;
      
      // Encrypted data should not contain recognizable patterns from original
      const dataStr = data.toString('hex');
      const originalStr = originalData.toString('hex');
      const originalSample = originalStr.substring(0, Math.min(100, originalStr.length));
      
      if (dataStr.includes(originalSample)) return false;
      
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
const voiceEncryptionService = new VoiceEncryptionService();
export default voiceEncryptionService;
