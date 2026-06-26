import os
import logging
import requests as http_requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("sarvamService")
logger.setLevel(logging.INFO)

api_key = os.getenv("SARVAM_API_KEY")
DEFAULT_TIMEOUT = 20

SUPPORTED_FORMATS = {'.ogg', '.mp3', '.wav', '.m4a', '.webm', '.opus'}


def validate_audio_file(file_path: str) -> tuple[bool, str]:
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
    Transcribes audio to English text using Sarvam AI.
    Uses mode='translate' so output is always English.
    Falls back to REST API, then to local mock.
    """
    logger.info(f"Starting transcription (translate mode) for: {file_path}")

    is_valid, msg = validate_audio_file(file_path)
    if not is_valid:
        logger.error(f"Audio validation failed: {msg}")
        raise ValueError(f"Invalid audio file: {msg}")

    file_size = os.path.getsize(file_path)
    logger.info(f"Audio file validated: {file_size} bytes")

    if api_key and api_key.strip():
        # Try SDK
        try:
            from sarvamai import SarvamAI
            logger.info("Attempting transcription via SDK (mode=translate)...")
            client = SarvamAI(api_subscription_key=api_key)
            with open(file_path, "rb") as f:
                response = client.speech_to_text.transcribe(
                    file=f,
                    model="saaras:v3",
                    mode="translate"
                )
            transcript = ""
            if hasattr(response, "transcript"):
                transcript = response.transcript
            elif isinstance(response, dict):
                transcript = response.get("transcript", "")

            transcript = transcript.strip() if transcript else ""
            logger.info(f"SDK translate result: '{transcript}' (length: {len(transcript)})")
            if transcript:
                return transcript
            else:
                logger.warning("SDK returned empty transcript")
        except Exception as e:
            logger.warning(f"SDK failed: {e}. Trying REST API...")

            # REST API fallback
            try:
                url = "https://api.sarvam.ai/speech-to-text"
                headers = {"api-subscription-key": api_key}
                ext = os.path.splitext(file_path)[1].lower()
                mime_type = {
                    '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
                    '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.opus': 'audio/ogg',
                }.get(ext, 'audio/ogg')

                with open(file_path, "rb") as f:
                    files = {"file": (os.path.basename(file_path), f, mime_type)}
                    data = {"model": "saaras:v3", "mode": "translate"}
                    logger.info(f"Calling Sarvam REST API (translate mode): {url}")
                    response = http_requests.post(url, headers=headers, files=files, data=data, timeout=DEFAULT_TIMEOUT)

                if response.status_code == 200:
                    res_json = response.json()
                    transcript = res_json.get("transcript", "").strip()
                    logger.info(f"REST API translate result: '{transcript}' (length: {len(transcript)})")
                    if transcript:
                        return transcript
                    else:
                        logger.warning("REST API returned empty transcript")
                else:
                    logger.error(f"REST API failed: {response.status_code} - {response.text[:500]}")
            except http_requests.Timeout:
                logger.error(f"REST API timed out after {DEFAULT_TIMEOUT}s")
            except http_requests.RequestException as ex:
                logger.error(f"REST API request exception: {ex}")
            except Exception as ex:
                logger.error(f"REST API unexpected exception: {ex}")

    # Local mock fallback
    logger.info("Running in local mock transcription mode.")
    filename = os.path.basename(file_path).lower()
    mock_transcripts = {
        "greeting": "namaste pikk, kaise ho?",
        "hello": "namaste pikk, kaise ho?",
        "help": "help me with my order",
        "bread": "10 bread and 5kg daal",
        "daal": "10 bread and 5kg daal",
        "paneer": "1kg paneer please",
    }
    for keyword, transcript in mock_transcripts.items():
        if keyword in filename:
            logger.info(f"Mock transcript matched '{keyword}': '{transcript}'")
            return transcript

    default_transcript = "2kg atta and 1 litre oil please"
    logger.info(f"Using default mock transcript: '{default_transcript}'")
    return default_transcript


def translate_to_english(text: str) -> str:
    """
    Translates Hindi/Hinglish text to English using Sarvam Text Translation API.
    Returns original text if already English or if API fails.
    """
    if not text or not text.strip():
        return text

    # Quick heuristic: if mostly ASCII, assume English
    alpha_chars = [c for c in text if c.isalpha()]
    if alpha_chars:
        ascii_ratio = sum(1 for c in alpha_chars if c.isascii()) / len(alpha_chars)
        if ascii_ratio > 0.85:
            logger.info(f"[sarvam] Text appears English, skipping translation: '{text}'")
            return text

    if not api_key or not api_key.strip():
        logger.warning("[sarvam] No API key, returning original text")
        return text

    # Try SDK first
    try:
        from sarvamai import SarvamAI
        logger.info(f"[sarvam] Translating text via SDK: '{text}'")
        client = SarvamAI(api_subscription_key=api_key)
        response = client.text.translate(
            input=text,
            source_language_code="auto",
            target_language_code="en-IN",
        )
        translated = response.translated_text.strip() if hasattr(response, "translated_text") else ""
        if translated:
            logger.info(f"[sarvam] SDK translate result: '{translated}'")
            return translated
    except Exception as e:
        logger.warning(f"[sarvam] SDK text translate failed: {e}. Trying REST API...")

    # REST API fallback
    try:
        url = "https://api.sarvam.ai/translate"
        headers = {"api-subscription-key": api_key, "Content-Type": "application/json"}
        payload = {
            "input": text,
            "source_language_code": "auto",
            "target_language_code": "en-IN",
        }
        logger.info(f"[sarvam] Calling REST translate API: {url}")
        response = http_requests.post(url, headers=headers, json=payload, timeout=DEFAULT_TIMEOUT)
        if response.status_code == 200:
            translated = response.json().get("translated_text", "").strip()
            logger.info(f"[sarvam] REST translate result: '{translated}'")
            if translated:
                return translated
        else:
            logger.error(f"[sarvam] REST translate failed: {response.status_code} - {response.text[:300]}")
    except Exception as e:
        logger.error(f"[sarvam] REST translate exception: {e}")

    logger.warning("[sarvam] All translation attempts failed, returning original text")
    return text
