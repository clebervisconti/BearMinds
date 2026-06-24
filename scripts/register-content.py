#!/usr/bin/env python3
"""
BearMinds — registra automaticamente os módulos de conteúdo no index.html.

Varre public/assets/js/content-*.js e reescreve o bloco entre os marcadores
<!-- BM:CONTENT:START --> e <!-- BM:CONTENT:END --> com um <script> por arquivo
(ordem alfabética). Idempotente: rode quantas vezes quiser.

Uso:  python3 scripts/register-content.py
"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
INDEX = os.path.join(PUBLIC, "index.html")
JS_DIR = os.path.join(PUBLIC, "assets", "js")

START = "<!-- BM:CONTENT:START"
END = "<!-- BM:CONTENT:END -->"

def main():
    files = sorted(os.path.basename(p) for p in glob.glob(os.path.join(JS_DIR, "content-*.js")))
    if not files:
        print("⚠️  Nenhum content-*.js encontrado em", JS_DIR)
    tags = "\n".join('  <script src="assets/js/%s"></script>' % f for f in files)

    with open(INDEX, "r", encoding="utf-8") as fh:
        html = fh.read()

    block = ('<!-- BM:CONTENT:START — gerado por scripts/register-content.py · NÃO editar à mão -->\n'
             + tags + '\n  ' + END)
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    if not pattern.search(html):
        print("❌ Marcadores BM:CONTENT não encontrados em index.html.", file=sys.stderr)
        sys.exit(1)
    new_html = pattern.sub(lambda m: block, html)

    with open(INDEX, "w", encoding="utf-8") as fh:
        fh.write(new_html)

    print("✅ Registrados %d módulo(s) de conteúdo:" % len(files))
    for f in files:
        print("   •", f)

if __name__ == "__main__":
    main()
