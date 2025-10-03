from fastapi import FastAPI, UploadFile, File
from faster_whisper import WhisperModel
import tempfile
import os

app = FastAPI()

# Load model once at startup
print("Loading Whisper Medium model...")
model = WhisperModel("medium", device="cpu", compute_type="int8")
print("Model loaded successfully")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Transcribe uploaded audio file"""
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Transcribe (auto-detect language or force Japanese)
        segments, info = model.transcribe(tmp_path, language="ja")
        
        # Convert segments generator to list
        transcript_segments = []
        full_text = ""
        
        for seg in segments:
            transcript_segments.append({
                "start": f"{seg.start:.3f}",
                "end": f"{seg.end:.3f}",
                "text": seg.text.strip()
            })
            full_text += seg.text.strip() + " "
        
        return {
            "status": "success",
            "language": info.language,
            "language_probability": f"{info.language_probability:.4f}",
            "duration": f"{info.duration:.2f}",
            "full_text": full_text.strip(),
            "segments": transcript_segments
        }
    except Exception as e:
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
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "whisper-api",
        "model": "medium",
        "device": "cpu",
        "compute_type": "int8"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
