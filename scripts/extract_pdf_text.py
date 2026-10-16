# Writes a page-split text copy of each PDF in data/cache/ir (to data/cache/ir_text) and in
# data/cache/context (to data/cache/context_text), so validate.js can check that every figure and
# quoted statement appears on the page it cites.
# Run: uv run --with "pypdf==6.19.0" --with "cryptography==46.0.3" python -I scripts/extract_pdf_text.py
import pathlib
from pypdf import PdfReader

root = pathlib.Path(__file__).resolve().parent.parent
for src, dst in (("ir", "ir_text"), ("context", "context_text")):
    out = root / "data" / "cache" / dst
    out.mkdir(parents=True, exist_ok=True)
    for pdf in sorted((root / "data" / "cache" / src).glob("*.pdf")):
        reader = PdfReader(pdf)
        with open(out / (pdf.stem + ".txt"), "w", encoding="utf-8") as o:
            for i, page in enumerate(reader.pages, 1):
                try:
                    text = page.extract_text() or ""
                except Exception as e:  # keep going; the page check will then fail visibly
                    text = f"[ERR {e}]"
                o.write(f"\n=====PAGE {i}=====\n{text}")
        print(pdf.name, len(reader.pages), "pages")
