import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.parse import router as parse_router
from routes.transcribe import router as transcribe_router

load_dotenv()

app = FastAPI(title=os.getenv('APP_NAME', 'pikk Python Service'))

frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
allowed_origins = [origin.strip() for origin in frontend_url.split(',') if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ['http://localhost:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(parse_router, prefix='/api')
app.include_router(transcribe_router, prefix='/api')


@app.get('/health')
def health_check():
    return {
        'ok': True,
        'service': 'python-service',
    }
