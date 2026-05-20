from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=['invoice'])


@router.get('/invoice', response_class=HTMLResponse)
def invoice_preview():
    template_path = Path(__file__).resolve().parent.parent / 'templates' / 'invoice.html'
    return HTMLResponse(template_path.read_text(encoding='utf-8'))
