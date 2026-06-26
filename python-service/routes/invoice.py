from pathlib import Path

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import HTMLResponse
from services.invoiceService import InvoiceGenerationError, generate_invoice_assets

router = APIRouter(tags=['invoice'])


@router.get('/invoice', response_class=HTMLResponse)
def invoice_preview():
    template_path = Path(__file__).resolve().parent.parent / 'templates' / 'invoice.html'
    return HTMLResponse(template_path.read_text(encoding='utf-8'))


@router.post('/generate-invoice')
def generate_invoice(payload: dict = Body(default={})):
    try:
        return generate_invoice_assets(payload)
    except InvoiceGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Invoice generation failed: {exc}') from exc
