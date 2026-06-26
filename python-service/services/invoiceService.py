import html
import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("invoiceService")
logger.setLevel(logging.INFO)

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "invoice.html"


class InvoiceGenerationError(Exception):
    pass


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value or not value.strip():
        raise InvoiceGenerationError(f"Missing required environment variable: {name}")
    return value.strip()


def _money(value) -> str:
    return f"Rs. {float(value or 0):.2f}"


def _safe(value) -> str:
    return html.escape(str(value or ""))


def _format_date(value) -> str:
    if not value:
        return datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    try:
        normalized = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(normalized).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return str(value)


def _build_item_rows(items: list[dict]) -> str:
    rows = []
    for item in items:
        name = _safe(item.get("name") or item.get("item") or "Item")
        quantity = float(item.get("quantity") or item.get("qty") or 0)
        unit = _safe(item.get("unit") or "piece")
        unit_price = float(item.get("unit_price") or item.get("price") or 0)
        line_total = float(item.get("line_total") or quantity * unit_price)

        rows.append(
            "<tr>"
            f"<td><strong>{name}</strong><br><span>{unit}</span></td>"
            f"<td class=\"numeric\">{quantity:g} {unit}</td>"
            f"<td class=\"numeric\">{_money(unit_price)}</td>"
            f"<td class=\"numeric\">{_money(line_total)}</td>"
            "</tr>"
        )

    if rows:
        return "\n".join(rows)

    return (
        "<tr>"
        "<td colspan=\"4\" class=\"numeric\">No line items provided</td>"
        "</tr>"
    )


def _render_invoice_html(payload: dict) -> str:
    order = payload.get("order") or {}
    customer = payload.get("customer") or {}
    items = payload.get("items") or []
    payment = payload.get("payment") or {}

    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    replacements = {
        "{{ORDER_ID}}": _safe(order.get("id")),
        "{{ORDER_DATE}}": _safe(_format_date(order.get("created_at"))),
        "{{CUSTOMER_NAME}}": _safe(customer.get("name") or "Customer"),
        "{{CUSTOMER_PHONE}}": _safe(customer.get("phone")),
        "{{STORE_NAME}}": _safe(os.getenv("STORE_NAME", "ShopBot Kirana Store")),
        "{{STORE_ADDRESS}}": _safe(os.getenv("STORE_ADDRESS", "Local Market, India")),
        "{{STORE_PHONE}}": _safe(os.getenv("STORE_PHONE", os.getenv("OWNER_PHONE", ""))),
        "{{OWNER_UPI_ID}}": _safe(os.getenv("OWNER_UPI_ID", "See payment QR")),
        "{{PAYMENT_STATUS}}": _safe(payment.get("status") or "unpaid").upper(),
        "{{TOTAL_AMOUNT}}": _money(order.get("total_amount")),
        "{{ITEM_ROWS}}": _build_item_rows(items),
        "{{PAYMENT_QR_SRC}}": _safe(_resolve_payment_qr_source()),
    }

    rendered = template
    for placeholder, value in replacements.items():
        rendered = rendered.replace(placeholder, value)
    return rendered


def _resolve_payment_qr_source() -> str:
    qr_url = os.getenv("OWNER_UPI_QR_URL", "").strip()
    if qr_url:
        return qr_url

    qr_path = os.getenv("OWNER_UPI_QR_PATH", "").strip()
    if not qr_path:
        raise InvoiceGenerationError(
            "Missing payment QR config. Set OWNER_UPI_QR_URL or OWNER_UPI_QR_PATH."
        )

    resolved_path = Path(qr_path).expanduser().resolve()
    if not resolved_path.exists() or not resolved_path.is_file():
        raise InvoiceGenerationError(f"Payment QR image not found: {resolved_path}")

    return resolved_path.as_uri()


def _get_payment_qr_upload_source() -> str:
    qr_path = os.getenv("OWNER_UPI_QR_PATH", "").strip()
    if qr_path:
        resolved_path = Path(qr_path).expanduser().resolve()
        if not resolved_path.exists() or not resolved_path.is_file():
            raise InvoiceGenerationError(f"Payment QR image not found: {resolved_path}")
        return str(resolved_path)

    return _resolve_payment_qr_source()


def _configure_cloudinary() -> None:
    cloud_name = _require_env("CLOUDINARY_CLOUD_NAME")
    api_key = _require_env("CLOUDINARY_API_KEY")
    api_secret = _require_env("CLOUDINARY_API_SECRET")
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )


def _upload_file(path: str, public_id: str, resource_type: str) -> dict:
    try:
        return cloudinary.uploader.upload(
            path,
            folder="shopbot/invoices",
            public_id=public_id,
            resource_type=resource_type,
            overwrite=True,
            use_filename=False,
            unique_filename=False,
        )
    except Exception as exc:
        logger.exception("Cloudinary upload failed for %s", public_id)
        raise InvoiceGenerationError(f"Cloudinary upload failed: {exc}") from exc


def _write_pdf(invoice_html: str, invoice_path: str) -> None:
    try:
        from weasyprint import HTML
    except OSError as exc:
        logger.exception("WeasyPrint native library import failed")
        raise InvoiceGenerationError(
            "PDF generation dependency is missing. On Windows, install GTK/Pango runtime "
            "for WeasyPrint and make sure its bin folder is available in PATH. "
            f"Original error: {exc}"
        ) from exc
    except Exception as exc:
        logger.exception("WeasyPrint import failed")
        raise InvoiceGenerationError(f"WeasyPrint import failed: {exc}") from exc

    HTML(string=invoice_html, base_url=str(TEMPLATE_PATH.parent)).write_pdf(invoice_path)


def generate_invoice_assets(payload: dict) -> dict:
    order = payload.get("order") or {}
    order_id = str(order.get("id") or "").strip()
    if not order_id:
        raise InvoiceGenerationError("Order ID is required")

    logger.info("Generating invoice assets for order %s", order_id)
    _configure_cloudinary()

    with tempfile.TemporaryDirectory() as temp_dir:
        invoice_path = os.path.join(temp_dir, f"invoice-{order_id}.pdf")

        try:
            invoice_html = _render_invoice_html(payload)
            _write_pdf(invoice_html, invoice_path)
            logger.info("PDF invoice generated for order %s", order_id)
        except InvoiceGenerationError:
            raise
        except Exception as exc:
            logger.exception("PDF generation failed for order %s", order_id)
            raise InvoiceGenerationError(f"PDF generation failed: {exc}") from exc

        invoice_upload = _upload_file(invoice_path, f"invoice-{order_id}.pdf", "raw")
        qr_upload = _upload_file(_get_payment_qr_upload_source(), "owner-upi-qr", "image")

    logger.info("Invoice assets uploaded for order %s", order_id)
    return {
        "ok": True,
        "order_id": order_id,
        "invoice_url": invoice_upload.get("secure_url"),
        "invoice_public_id": invoice_upload.get("public_id"),
        "qr_url": qr_upload.get("secure_url"),
        "qr_public_id": qr_upload.get("public_id"),
        "payment_status": (payload.get("payment") or {}).get("status") or "unpaid",
    }
