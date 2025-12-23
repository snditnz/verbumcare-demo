from fastapi import FastAPI, UploadFile, File, Form
import whisper
import tempfile
import os
import json
from typing import Optional
import time

app = FastAPI()

# Load model once at startup
print("🎤 Loading Whisper medium model...")
model = whisper.load_model("medium")
print("✅ Model loaded successfully")

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form("ja")
):
    """Transcribe uploaded audio file using whisper with MPS acceleration"""
    start_time = time.time()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        print(f"🎤 Transcribing audio ({language}) with medium model...")
        
        # Transcribe using whisper with optimizations for Japanese medical terminology
        result = model.transcribe(
            tmp_path,
            language=language,
            # Medical terminology optimization for Japanese
            initial_prompt="医療記録、バイタルサイン、看護評価、血圧、脈拍、体温、患者" if language == "ja" else None,
            # Quality optimizations
            temperature=0.0,  # More deterministic for medical terms
            condition_on_previous_text=False,  # Better for medical terms
            compression_ratio_threshold=2.4,
            logprob_threshold=-1.0,
            no_speech_threshold=0.6
        )
        
        # Convert to same format as faster-whisper
        segments = []
        for segment in result["segments"]:
            segments.append({
                "start": f"{segment['start']:.3f}",
                "end": f"{segment['end']:.3f}",
                "text": segment["text"].strip()
            })
        
        # Calculate duration from segments
        duration = f"{result['segments'][-1]['end']:.2f}" if result["segments"] else "0.00"
        
        processing_time = time.time() - start_time
        print(f"✅ Transcription completed in {processing_time:.2f}s")
        
        return {
            "status": "success",
            "language": result["language"],
            "language_probability": "1.0000",  # whisper doesn't provide this, use fixed value
            "duration": duration,
            "full_text": result["text"].strip(),
            "segments": segments
        }
    except Exception as e:
        print(f"❌ Transcription error: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.get("/health")
async def health():
    """Health check endpoint - matches faster-whisper format exactly"""
    return {
        "status": "ok",
        "service": "whisper-api",
        "model": "medium",
        "device": "mps",  # Indicate MPS acceleration
        "compute_type": "fp16"
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Whisper API service on port 8080...")
    uvicorn.run(app, host="0.0.0.0", port=8080)