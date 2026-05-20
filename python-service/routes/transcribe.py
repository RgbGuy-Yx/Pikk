from fastapi import APIRouter, Body

router = APIRouter(tags=['transcribe'])


@router.post('/transcribe')
def transcribe_audio(payload: dict = Body(default={})): 
    return {
        'ok': True,
        'route': 'transcribe',
        'payload': payload,
    }
