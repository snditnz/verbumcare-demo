from fastapi import FastAPI, UploadFile, File, Form
import tempfile
import os
import json
import subprocess
from typing import Optional
import time
import torch
import numpy as np

app = FastAPI()

# Configuration
WHISPER_CPP_BIN = "/opt/homebrew/bin/whisper-cli"
WHISPER_MODEL_PATH = "/Users/vcadmin/models/ggml-medium.bin"
FFMPEG_BIN = "/opt/homebrew/bin/ffmpeg"
THREADS = 8

# Load Silero VAD model once at startup
print("🔊 Loading Silero VAD model...")
vad_model, vad_utils = torch.hub.load(
    repo_or_dir='snakers4/silero-vad',
    model='silero_vad',
    force_reload=False,
    onnx=False  # Use PyTorch backend
)
(get_speech_timestamps, save_audio, _, VADIterator, collect_chunks) = vad_utils
print("✅ Silero VAD model loaded")

# VAD parameters - tuned for streaming audio chunks with low audio levels
VAD_THRESHOLD = 0.15  # Very low threshold for quiet audio (was 0.5)
VAD_MIN_SPEECH_MS = 50  # Very short minimum speech duration (was 250)
VAD_MIN_SILENCE_MS = 30  # Very short silence duration (was 100)
VAD_SPEECH_PAD_MS = 200  # More padding around speech (was 30)


def read_wav_scipy(wav_path: str, target_sr: int = 16000) -> torch.Tensor:
    """
    Read WAV file using scipy (avoids torchaudio/torchcodec issues).
    Returns audio as torch tensor at target sample rate.
    """
    from scipy.io import wavfile
    from scipy import signal
    
    # Read the WAV file
    sample_rate, audio_data = wavfile.read(wav_path)
    
    # Convert to float32 and normalize to [-1, 1]
    if audio_data.dtype == np.int16:
        audio_data = audio_data.astype(np.float32) / 32768.0
    elif audio_data.dtype == np.int32:
        audio_data = audio_data.astype(np.float32) / 2147483648.0
    elif audio_data.dtype == np.uint8:
        audio_data = (audio_data.astype(np.float32) - 128) / 128.0
    else:
        audio_data = audio_data.astype(np.float32)
    
    # Convert stereo to mono if needed
    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)
    
    # Resample if needed
    if sample_rate != target_sr:
        num_samples = int(len(audio_data) * target_sr / sample_rate)
        audio_data = signal.resample(audio_data, num_samples)
    
    # Convert to torch tensor
    return torch.from_numpy(audio_data).float()


def save_wav_scipy(wav_path: str, audio_tensor: torch.Tensor, sample_rate: int = 16000):
    """
    Save audio tensor to WAV file using scipy.
    """
    from scipy.io import wavfile
    
    # Convert to numpy and scale to int16
    audio_np = audio_tensor.numpy()
    audio_int16 = (audio_np * 32767).astype(np.int16)
    
    wavfile.write(wav_path, sample_rate, audio_int16)


def extract_speech_segments(wav_path: str) -> tuple[str, dict]:
    """
    Use Silero VAD to extract only speech segments from audio.
    Returns path to processed audio and VAD info.
    """
    try:
        # Use scipy to read audio (avoids torchaudio/torchcodec issues)
        wav = read_wav_scipy(wav_path, target_sr=16000)
        sr = 16000
        
        # Debug: log audio stats before normalization
        audio_max = wav.abs().max().item()
        audio_mean = wav.abs().mean().item()
        print(f"🔍 Audio stats (raw): max={audio_max:.4f}, mean={audio_mean:.4f}, samples={len(wav)}")
        
        # Normalize audio to improve VAD detection
        # If audio is very quiet, boost it
        if audio_max > 0 and audio_max < 0.1:
            # Normalize to have max around 0.5
            normalization_factor = 0.5 / audio_max
            wav = wav * normalization_factor
            print(f"🔊 Normalized audio by {normalization_factor:.1f}x (new max: {wav.abs().max().item():.4f})")
        
        # Get speech timestamps using Silero VAD
        speech_timestamps = get_speech_timestamps(
            wav,
            vad_model,
            threshold=VAD_THRESHOLD,
            min_speech_duration_ms=VAD_MIN_SPEECH_MS,
            min_silence_duration_ms=VAD_MIN_SILENCE_MS,
            speech_pad_ms=VAD_SPEECH_PAD_MS,
            sampling_rate=sr
        )
        
        total_samples = len(wav)
        total_duration_ms = (total_samples / sr) * 1000
        
        if not speech_timestamps:
            print(f"🔇 VAD: No speech detected in {total_duration_ms:.0f}ms audio")
            return None, {
                "has_speech": False,
                "total_duration_ms": total_duration_ms,
                "speech_duration_ms": 0,
                "speech_ratio": 0,
                "segments": 0
            }
        
        # Calculate speech duration
        speech_samples = sum(ts['end'] - ts['start'] for ts in speech_timestamps)
        speech_duration_ms = (speech_samples / sr) * 1000
        speech_ratio = speech_samples / total_samples
        
        print(f"🎤 VAD: Found {len(speech_timestamps)} speech segments, {speech_duration_ms:.0f}ms speech in {total_duration_ms:.0f}ms audio ({speech_ratio:.1%})")
        
        # Collect speech chunks into a single tensor
        speech_wav = collect_chunks(speech_timestamps, wav)
        
        # Save processed audio using scipy
        output_path = wav_path.replace('.wav', '_speech.wav')
        save_wav_scipy(output_path, speech_wav, sample_rate=sr)
        
        return output_path, {
            "has_speech": True,
            "total_duration_ms": total_duration_ms,
            "speech_duration_ms": speech_duration_ms,
            "speech_ratio": speech_ratio,
            "segments": len(speech_timestamps)
        }
        
    except Exception as e:
        print(f"⚠️ VAD processing error: {e}")
        import traceback
        traceback.print_exc()
        # If VAD fails, return original file
        return wav_path, {"has_speech": True, "error": str(e)}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form("ja"),
    initial_prompt: Optional[str] = Form(None),
):
    """Transcribe uploaded audio file using whisper-cpp with Silero VAD pre-processing"""
    start_time = time.time()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    # Convert to WAV format for processing
    wav_path = tmp_path + ".wav"
    speech_wav_path = None
    json_output_path = tmp_path + ".json"
    
    try:
        print(f"🎤 Transcribing audio ({language}) with Silero VAD + whisper-cpp...")
        
        # Convert audio to WAV format (16kHz, mono) for VAD and whisper-cpp
        ffmpeg_cmd = [
            FFMPEG_BIN,
            "-i", tmp_path,
            "-ar", "16000",
            "-ac", "1",
            "-y",
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
        
        # Apply Silero VAD to extract speech segments
        speech_wav_path, vad_info = extract_speech_segments(wav_path)
        
        if not vad_info.get("has_speech", False):
            # No speech detected - return empty transcription
            print(f"🔇 No speech detected, returning empty transcription")
            return {
                "status": "success",
                "language": language,
                "language_probability": 1.0,
                "duration": 0.0,
                "full_text": "",
                "segments": [],
                "vad_info": vad_info
            }
        
        # Build whisper-cpp command with speech-only audio
        cmd = [
            WHISPER_CPP_BIN,
            "-m", WHISPER_MODEL_PATH,
            "-l", language,
            "-t", str(THREADS),
            "--output-json",
            "--output-file", tmp_path,
            "-f", speech_wav_path
        ]
        
        # Use custom prompt if provided, otherwise use medical terminology for Japanese
        if initial_prompt:
            cmd.extend(["--prompt", initial_prompt])
        elif language == "ja":
            prompt = "医療記録、バイタルサイン、看護評価、血圧、脈拍、体温、患者"
            cmd.extend(["--prompt", prompt])
        
        # Run whisper-cpp
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode != 0:
            raise Exception(f"whisper-cpp failed: {result.stderr}")
        
        # Read JSON output
        with open(json_output_path, 'r', encoding='utf-8') as f:
            whisper_output = json.load(f)
        
        # Convert to response format
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
            "vad_info": vad_info
        }
    except subprocess.TimeoutExpired:
        print(f"❌ Transcription timeout")
        return {
            "status": "error",
            "error": "Transcription timeout after 120 seconds"
        }
    except Exception as e:
        print(f"❌ Transcription error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        # Cleanup temp files
        for path in [tmp_path, wav_path, json_output_path]:
            if path and os.path.exists(path):
                os.unlink(path)
        if speech_wav_path and speech_wav_path != wav_path and os.path.exists(speech_wav_path):
            os.unlink(speech_wav_path)


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "whisper-api",
        "model": "medium",
        "device": "metal",
        "compute_type": "fp16",
        "vad_enabled": True,
        "vad_model": "silero-vad"
    }


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Whisper-CPP API with Silero VAD on port 8080...")
    print(f"📦 Using whisper-cpp binary: {WHISPER_CPP_BIN}")
    print(f"🎯 Using model: {WHISPER_MODEL_PATH}")
    print(f"🔊 VAD threshold: {VAD_THRESHOLD}")
    uvicorn.run(app, host="0.0.0.0", port=8080)
