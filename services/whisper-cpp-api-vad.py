from fastapi import FastAPI, UploadFile, File, Form
import tempfile
import os
import json
import subprocess
from typing import Optional
import time
import struct
import math

app = FastAPI()

# Configuration
WHISPER_CPP_BIN = "/opt/homebrew/bin/whisper-cli"
WHISPER_MODEL_PATH = "/Users/vcadmin/models/ggml-medium.bin"
FFMPEG_BIN = "/opt/homebrew/bin/ffmpeg"
THREADS = 8  # Use more threads for better performance

# VAD (Voice Activity Detection) settings
# Minimum RMS energy threshold to consider as speech (not silence)
# Values below this are considered silence and won't be transcribed
# Based on testing: speech RMS ~350-550, silence RMS ~100-200
MIN_RMS_THRESHOLD = 200  # Lowered - actual speech has RMS around 350+
MIN_SPEECH_RATIO = 0.01  # At least 1% of audio should be above threshold (very permissive)


def calculate_audio_energy(wav_path: str) -> dict:
    """
    Calculate RMS energy of audio to detect if it contains speech.
    Returns dict with rms, peak, and speech_ratio.
    """
    try:
        with open(wav_path, 'rb') as f:
            # Skip WAV header (44 bytes for standard WAV)
            f.seek(44)
            data = f.read()
        
        # Parse 16-bit samples
        num_samples = len(data) // 2
        if num_samples == 0:
            return {"rms": 0, "peak": 0, "speech_ratio": 0, "has_speech": False}
        
        samples = struct.unpack(f'<{num_samples}h', data)
        
        # Calculate RMS (Root Mean Square) energy
        sum_squares = sum(s * s for s in samples)
        rms = math.sqrt(sum_squares / num_samples)
        
        # Calculate peak amplitude
        peak = max(abs(s) for s in samples)
        
        # Calculate ratio of samples above threshold (speech detection)
        above_threshold = sum(1 for s in samples if abs(s) > MIN_RMS_THRESHOLD)
        speech_ratio = above_threshold / num_samples
        
        has_speech = speech_ratio >= MIN_SPEECH_RATIO and rms > MIN_RMS_THRESHOLD
        
        return {
            "rms": rms,
            "peak": peak,
            "speech_ratio": speech_ratio,
            "has_speech": has_speech
        }
    except Exception as e:
        print(f"⚠️ Audio energy calculation failed: {e}")
        # If we can't calculate, assume there's speech
        return {"rms": 0, "peak": 0, "speech_ratio": 0, "has_speech": True}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form("ja"),
    initial_prompt: Optional[str] = Form(None),
    temperature: Optional[str] = Form("0.0"),
    no_speech_threshold: Optional[str] = Form("0.6"),
    condition_on_previous_text: Optional[str] = Form("false"),
    compression_ratio_threshold: Optional[str] = Form("2.4"),
    logprob_threshold: Optional[str] = Form("-1.0"),
):
    """Transcribe uploaded audio file using whisper-cpp with VAD pre-filtering"""
    start_time = time.time()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    # Convert to WAV format for whisper-cpp compatibility
    wav_path = tmp_path + ".wav"
    json_output_path = tmp_path + ".json"
    
    try:
        print(f"🎤 Transcribing audio ({language}) with whisper-cpp medium model...")
        
        # Convert audio to WAV format (16kHz, mono) for better whisper-cpp compatibility
        ffmpeg_cmd = [
            FFMPEG_BIN,
            "-i", tmp_path,
            "-ar", "16000",
            "-ac", "1",
            "-y",  # Overwrite output file
            wav_path
        ]
        
        ffmpeg_result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if ffmpeg_result.returncode != 0:
            raise Exception(f"Audio conversion failed: {ffmpeg_result.stderr}")
        
        # VAD: Check if audio contains speech before sending to Whisper
        energy_info = calculate_audio_energy(wav_path)
        print(f"🔊 Audio energy: RMS={energy_info['rms']:.0f}, Peak={energy_info['peak']}, Speech ratio={energy_info['speech_ratio']:.2%}")
        
        if not energy_info['has_speech']:
            print(f"🔇 Audio appears to be silence (RMS={energy_info['rms']:.0f}, speech_ratio={energy_info['speech_ratio']:.2%}), skipping transcription")
            return {
                "status": "success",
                "language": language,
                "language_probability": "1.0000",
                "duration": "0.00",
                "full_text": "",
                "segments": [],
                "vad_filtered": True,
                "energy_info": energy_info
            }
        
        # Build whisper-cpp command
        cmd = [
            WHISPER_CPP_BIN,
            "-m", WHISPER_MODEL_PATH,
            "-l", language,
            "-t", str(THREADS),
            "--output-json",
            "--output-file", tmp_path,  # Output file without extension
            "-f", wav_path  # Input WAV file
        ]
        
        # Use custom prompt if provided, otherwise use medical terminology for Japanese
        if initial_prompt:
            cmd.extend(["--prompt", initial_prompt])
        elif language == "ja":
            # Simplified prompt - avoid priming with too many medical terms
            prompt = "患者、血圧、体温"
            cmd.extend(["--prompt", prompt])
        
        # Run whisper-cpp
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout
        )
        
        if result.returncode != 0:
            raise Exception(f"whisper-cpp failed: {result.stderr}")
        
        # Read JSON output
        with open(json_output_path, 'r', encoding='utf-8') as f:
            whisper_output = json.load(f)
        
        # Convert to same format as faster-whisper
        segments = []
        full_text = ""
        
        for segment in whisper_output.get("transcription", []):
            seg_text = segment.get("text", "").strip()
            if seg_text:
                segments.append({
                    "start": segment['offsets']['from'] / 1000,
                    "end": segment['offsets']['to'] / 1000,
                    "text": seg_text
                })
                full_text += seg_text + " "
        
        # Calculate duration
        duration = 0.0
        if segments:
            duration = segments[-1]["end"]
        
        processing_time = time.time() - start_time
        print(f"✅ Transcription completed in {processing_time:.2f}s: '{full_text[:50]}...'")
        
        return {
            "status": "success",
            "language": whisper_output.get("result", {}).get("language", language),
            "language_probability": 1.0,
            "duration": duration,
            "full_text": full_text.strip(),
            "segments": segments,
            "vad_filtered": False,
            "energy_info": energy_info
        }
    except subprocess.TimeoutExpired:
        print(f"❌ Transcription timeout")
        return {
            "status": "error",
            "error": "Transcription timeout after 120 seconds"
        }
    except Exception as e:
        print(f"❌ Transcription error: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        # Cleanup temp files
        for path in [tmp_path, wav_path, json_output_path]:
            if os.path.exists(path):
                os.unlink(path)


@app.get("/health")
async def health():
    """Health check endpoint - matches faster-whisper format exactly"""
    return {
        "status": "ok",
        "service": "whisper-api",
        "model": "medium",
        "device": "metal",  # Indicate Metal acceleration
        "compute_type": "fp16",
        "vad_enabled": True
    }


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Whisper-CPP API service with VAD on port 8080...")
    print(f"📦 Using whisper-cpp binary: {WHISPER_CPP_BIN}")
    print(f"🎯 Using model: {WHISPER_MODEL_PATH}")
    print(f"🔊 VAD settings: MIN_RMS={MIN_RMS_THRESHOLD}, MIN_SPEECH_RATIO={MIN_SPEECH_RATIO}")
    uvicorn.run(app, host="0.0.0.0", port=8080)
