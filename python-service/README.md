# ShopBot Python Service

## PDF Invoice Setup on Windows

ShopBot uses WeasyPrint for PDF invoice generation. WeasyPrint needs native GTK/Pango libraries on Windows.

If the server shows an error like `cannot load library 'libgobject-2.0-0'`, install the GTK runtime and make sure its `bin` folder is on `PATH`.

Recommended steps:

1. Install the GTK3 runtime for Windows.
2. Add the GTK `bin` directory to your user or system `PATH`.
3. Restart the terminal.
4. Start the service again:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The FastAPI app can now start even if WeasyPrint native libraries are missing, but `/generate-invoice` still needs them to create PDF files.
