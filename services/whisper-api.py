from fastapi import FastAPI, UploadFile, File, Form
from faster_whisper import WhisperModel
import tempfile
import os
from typing import Optional

app = FastAPI()

# Load model once at startup
print("Loading Whisper Medium model with VAD support...")
model = WhisperModel("medium", device="auto", compute_type="auto")
print("Model loaded successfully")

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(default="ja"),
    initial_prompt: Optional[str] = Form(default=None),
    temperature: Optional[str] = Form(default="0.0"),
    no_speech_threshold: Optional[str] = Form(default="0.6"),
    condition_on_previous_text: Optional[str] = Form(default="false"),
    compression_ratio_threshold: Optional[str] = Form(default="2.4"),
    logprob_threshold: Optional[str] = Form(default="-1.0"),
):
    """Transcribe uploaded audio file with VAD and anti-hallucination settings"""
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Parse parameters
        temp = float(temperature) if temperature else 0.0
        no_speech_thresh = float(no_speech_threshold) if no_speech_threshold else 0.6
        condition_prev = condition_on_previous_text.lower() == "true" if condition_on_previous_text else False
        compression_thresh = float(compression_ratio_threshold) if compression_ratio_threshold else 2.4
        logprob_thresh = float(logprob_threshold) if logprob_threshold else -1.0
        
        # Transcribe with VAD (Voice Activity Detection) enabled
        # VAD filters out silence before sending to Whisper, preventing hallucinations
        segments, info = model.transcribe(
            tmp_path,
            language=language or "ja",
            initial_prompt=initial_prompt,
            temperature=temp,
            # VAD settings - this is the key to preventing hallucinations
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": 500,  # Minimum silence to split on
                "speech_pad_ms": 200,  # Padding around speech
                "threshold": 0.5,  # VAD threshold (0.0-1.0)
            },
            # Anti-hallucination settings
            no_speech_threshold=no_speech_thresh,
            condition_on_previous_text=condition_prev,
            compression_ratio_threshold=compression_thresh,
            log_prob_threshold=logprob_thresh,
            # Don't repeat detected language
            without_timestamps=False,
        )
        
        # Convert segments generator to list
        transcript_segments = []
        full_text = ""
        
        for seg in segments:
            # Skip segments with high no_speech probability (likely hallucinations)
            if hasattr(seg, 'no_speech_prob') and seg.no_speech_prob > 0.7:
                print(f"Skipping segment with high no_speech_prob: {seg.no_speech_prob:.2f} - '{seg.text}'")
                continue
                
            transcript_segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
                "avg_logprob": getattr(seg, 'avg_logprob', None),
                "no_speech_prob": getattr(seg, 'no_speech_prob', None),
                "compression_ratio": getattr(seg, 'compression_ratio', None),
            })
            full_text += seg.text.strip() + " "
        
        return {
            "status": "success",
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "full_text": full_text.strip(),
            "segments": transcript_segments
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
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
        "device": "auto",
        "compute_type": "auto",
        "vad_enabled": True
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
