from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import tempfile
import os
import logging
from services.sarvamService import transcribe_audio_file

router = APIRouter(tags=['transcribe'])

logger = logging.getLogger("transcribeRoute")
logger.setLevel(logging.INFO)

MAX_FILE_SIZE = 25 * 1024 * 1024
SUPPORTED_CONTENT_TYPES = {
    'audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp3',
    'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4',
    'audio/m4a', 'audio/webm', 'audio/x-webm'
}

@router.post('/transcribe')
async def transcribe_audio(file: UploadFile = File(...)): 
    temp_path = None
    try:
        logger.info(f"Received transcription request: filename={file.filename}, content_type={file.content_type}")
        
        if file.content_type and file.content_type not in SUPPORTED_CONTENT_TYPES:
            logger.warning(f"Unsupported content type: {file.content_type}, proceeding anyway")
        
        ext = os.path.splitext(file.filename or "")[1].lower() or ".ogg"
        if ext not in {'.ogg', '.mp3', '.wav', '.m4a', '.webm', '.opus'}:
            ext = ".ogg"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail=f"File too large: {len(content)} bytes (max {MAX_FILE_SIZE})")
            if len(content) == 0:
                raise HTTPException(status_code=400, detail="Empty audio file")
            tmp.write(content)
            temp_path = tmp.name
        
        logger.info(f"Audio saved to temporary path: {temp_path} ({len(content)} bytes)")
        
        try:
            transcript = transcribe_audio_file(temp_path)
        except ValueError as ve:
            logger.error(f"Audio validation error: {ve}")
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as te:
            logger.error(f"Transcription service error: {te}")
            raise HTTPException(status_code=502, detail=f"Transcription failed: {te}")
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                    logger.debug(f"Cleaned up temp file: {temp_path}")
                except Exception as cleanup_err:
                    logger.warning(f"Error deleting temp file {temp_path}: {cleanup_err}")
        
        if not transcript or not transcript.strip():
            logger.warning("Transcription returned empty result")
            return {
                'ok': True,
                'transcript': '',
                'warning': 'Empty transcript returned'
            }
        
        logger.info(f"Transcription successful: '{transcript[:100]}...' (length: {len(transcript)})")
        return {
            'ok': True,
            'transcript': transcript
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in transcribe_audio: {e}")
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

