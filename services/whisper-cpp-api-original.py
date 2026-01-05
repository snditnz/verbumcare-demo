from fastapi import FastAPI, UploadFile, File, Form
import tempfile
import os
import json
import subprocess
from typing import Optional
import time

app = FastAPI()

# Configuration
WHISPER_CPP_BIN = "/opt/homebrew/bin/whisper-cli"
WHISPER_MODEL_PATH = "/Users/vcadmin/models/ggml-medium.bin"
FFMPEG_BIN = "/opt/homebrew/bin/ffmpeg"
THREADS = 8  # Use more threads for better performance

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form("ja"),
    initial_prompt: Optional[str] = Form(None),
):
    """Transcribe uploaded audio file using whisper-cpp"""
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
        
        # Use custom prompt if provided, otherwise use medical terminology prompt for Japanese
        if initial_prompt:
            cmd.extend(["--prompt", initial_prompt])
        elif language == "ja":
            # Medical terminology prompt for better accuracy
            prompt = "医療記録、バイタルサイン、看護評価、血圧、脈拍、体温、患者"
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
            "segments": segments
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
        "compute_type": "fp16"
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Whisper-CPP API service on port 8080...")
    print(f"📦 Using whisper-cpp binary: {WHISPER_CPP_BIN}")
    print(f"🎯 Using model: {WHISPER_MODEL_PATH}")
    uvicorn.run(app, host="0.0.0.0", port=8080)
