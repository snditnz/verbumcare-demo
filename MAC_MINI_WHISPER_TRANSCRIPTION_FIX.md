# 🔧 Mac Mini Whisper Transcription Fix

## Current Issue
The Mac Mini Whisper service health endpoint works perfectly, but the transcription function has Python syntax errors that prevent audio processing.

## SSH Connection Issue
The SSH connection is prompting for a password, which means SSH keys aren't properly configured. You'll need to either:
1. Set up SSH key authentication, or 
2. Apply these fixes manually on the Mac Mini

## Python Syntax Errors to Fix

The file `/Users/vcadmin/verbumcare-whisper-service/whisper-api.py` has these issues:

### 1. Line Break in Filename Access
```python
# BROKEN:
with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filen
ame)[1]) as tmp:

# FIXED:
with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
```

### 2. Line Break in Initial Prompt
```python
# BROKEN:
initial_prompt="医療記録、バイタルサイン、看護評価、血圧、脈拍、体温、患
者" if language == "ja" else None,

# FIXED:
initial_prompt="医療記録、バイタルサイン、看護評価、血圧、脈拍、体温、患者" if language == "ja" else None,
```

### 3. Dictionary Key Access Syntax Errors
```python
# BROKEN:
segments.append({
    "start": f"{segment["start"]:.3f}",
    "end": f"{segment["end"]:.3f}",
    "text": segment["text"].strip()
})

# FIXED:
segments.append({
    "start": f"{segment['start']:.3f}",
    "end": f"{segment['end']:.3f}",
    "text": segment["text"].strip()
})
```

### 4. Array Access Syntax Error
```python
# BROKEN:
duration = f"{result[segments][-1][end]:.2f}" if result[segments] else "0.00"

# FIXED:
duration = f"{result['segments'][-1]['end']:.2f}" if result['segments'] else "0.00"
```

## Complete Fixed Function

Here's the corrected transcription function:

```python
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
        duration = f"{result['segments'][-1]['end']:.2f}" if result['segments'] else "0.00"
        
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
```

## How to Apply the Fix

### Option 1: SSH Key Setup (Recommended)
1. Set up SSH key authentication to `vcadmin@verbumcaremac-mini`
2. Then I can apply the fix remotely

### Option 2: Manual Fix
1. SSH into the Mac Mini: `ssh vcadmin@verbumcaremac-mini`
2. Edit the file: `nano ~/verbumcare-whisper-service/whisper-api.py`
3. Apply the fixes above
4. Restart the service: `launchctl kickstart -k gui/$(id -u vcadmin)/com.verbumcare.whisper`

### Option 3: Copy Fixed File
1. Create the fixed file locally
2. Copy it to the Mac Mini: `scp whisper-api.py vcadmin@verbumcaremac-mini:~/verbumcare-whisper-service/`
3. Restart the service

## Verification
After applying the fix, test with:
```bash
curl -X POST http://verbumcaremac-mini:8080/transcribe \
  -F "file=@test-audio.wav" \
  -F "language=ja"
```

## Expected Result
The service should now process audio files and return transcriptions in the same format as your pn51-e1 faster-whisper service.