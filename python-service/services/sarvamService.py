import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("sarvamService")
logger.setLevel(logging.INFO)

api_key = os.getenv("SARVAM_API_KEY")
DEFAULT_TIMEOUT = 20

SUPPORTED_FORMATS = {'.ogg', '.mp3', '.wav', '.m4a', '.webm', '.opus'}

def validate_audio_file(file_path: str) -> tuple[bool, str]:
    """Validate audio file exists, is readable, and has supported format."""
    if not os.path.exists(file_path):
        return False, f"File not found: {file_path}"
    
    if not os.path.isfile(file_path):
        return False, f"Path is not a file: {file_path}"
    
    file_size = os.path.getsize(file_path)
    if file_size == 0:
        return False, "Audio file is empty (0 bytes)"
    
    if file_size > 25 * 1024 * 1024:
        return False, f"Audio file too large: {file_size} bytes (max 25MB)"
    
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in SUPPORTED_FORMATS:
        logger.warning(f"Unsupported audio format: {ext}. Will attempt transcription anyway.")
    
    return True, "OK"

def transcribe_audio_file(file_path: str) -> str:
    """
    Transcribes an audio file using Sarvam AI Speech-to-Text API.
    Supports Hinglish and Indic audio transcription with robust error handling.
    Falls back to local mock if API key is missing or all API attempts fail.
    """
    logger.info(f"Starting transcription for: {file_path}")
    
    # Validate audio file
    is_valid, msg = validate_audio_file(file_path)
    if not is_valid:
        logger.error(f"Audio validation failed: {msg}")
        raise ValueError(f"Invalid audio file: {msg}")
    
    file_size = os.path.getsize(file_path)
    logger.info(f"Audio file validated: {file_size} bytes")

    if api_key and api_key.strip():
        # Try using the SDK
        try:
            from sarvamai import SarvamAI
            logger.info(f"Attempting transcription via SDK for {file_path}...")
            client = SarvamAI(api_subscription_key=api_key)
            with open(file_path, "rb") as f:
                response = client.speech_to_text.transcribe(
                    file=f,
                    model="saaras:v3",
                    mode="transcribe"
                )
            transcript = ""
            if hasattr(response, "transcript"):
                transcript = response.transcript
            elif isinstance(response, dict):
                transcript = response.get("transcript", "")
            
            transcript = transcript.strip() if transcript else ""
            logger.info(f"SDK transcription result: '{transcript}' (length: {len(transcript)})")
            if transcript:
                return transcript
            else:
                logger.warning("SDK returned empty transcript")
        except Exception as e:
            logger.warning(f"SDK failed: {e}. Trying raw REST API request...")
            
            # Try raw REST API endpoint using requests
            try:
                import requests
                url = "https://api.sarvam.ai/speech-to-text"
                headers = {
                    "api-subscription-key": api_key
                }
                ext = os.path.splitext(file_path)[1].lower()
                mime_type = {
                    '.ogg': 'audio/ogg',
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                    '.m4a': 'audio/mp4',
                    '.webm': 'audio/webm',
                    '.opus': 'audio/ogg',
                }.get(ext, 'audio/ogg')
                
                with open(file_path, "rb") as f:
                    files = {
                        "file": (os.path.basename(file_path), f, mime_type)
                    }
                    data = {
                        "model": "saaras:v3"
                    }
                    logger.info(f"Calling Sarvam REST API: {url} (timeout={DEFAULT_TIMEOUT}s)")
                    response = requests.post(url, headers=headers, files=files, data=data, timeout=DEFAULT_TIMEOUT)
                
                if response.status_code == 200:
                    res_json = response.json()
                    transcript = res_json.get("transcript", "").strip()
                    logger.info(f"REST API transcription result: '{transcript}' (length: {len(transcript)})")
                    if transcript:
                        return transcript
                    else:
                        logger.warning("REST API returned empty transcript")
                else:
                    logger.error(f"REST API failed: {response.status_code} - {response.text[:500]}")
            except requests.Timeout:
                logger.error(f"REST API request timed out after {DEFAULT_TIMEOUT}s")
            except requests.RequestException as ex:
                logger.error(f"REST API request exception: {ex}")
            except Exception as ex:
                logger.error(f"REST API unexpected exception: {ex}")

    # Local Fallback/Mock Mode
    logger.info("Running in local mock transcription mode (no API key or all API attempts failed).")
    filename = os.path.basename(file_path).lower()
    
    mock_transcripts = {
        "greeting": "namaste shopbot, kaise ho?",
        "hello": "namaste shopbot, kaise ho?",
        "help": "help me with my order",
        "bread": "10 bread and 5kg daal",
        "daal": "10 bread and 5kg daal",
        "paneer": "1kg paneer please",
    }
    
    for keyword, transcript in mock_transcripts.items():
        if keyword in filename:
            logger.info(f"Mock transcript matched '{keyword}': '{transcript}'")
            return transcript
    
    # Default mock Hinglish transcript containing standard items from the catalog
    default_transcript = "2kg atta and 1 litre oil please"
    logger.info(f"Using default mock transcript: '{default_transcript}'")
    return default_transcript
