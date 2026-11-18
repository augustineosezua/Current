"""Build the legal PDFs served by the web app from the Markdown sources in this folder.

Usage (from the repo root):  python legal/build_pdfs.py
Requires: pip install fpdf2
"""

import re
from pathlib import Path

from fpdf import FPDF
from fpdf.fonts import FontFace

HERE = Path(__file__).parent
OUT = HERE.parent / "app" / "web" / "public" / "legal"
# Arial lives in different places on Windows and macOS
FONTS = next(
    (p for p in (Path("C:/Windows/Fonts"), Path("/System/Library/Fonts/Supplemental"), Path("/Library/Fonts")) if (p / "Arial.ttf").exists() or (p / "arial.ttf").exists()),
    Path("C:/Windows/Fonts"),
)


def font(name: str) -> str:
    """Path to a font file by its Windows name, or the macOS file with the same face."""
    mac = {"arial.ttf": "Arial.ttf", "arialbd.ttf": "Arial Bold.ttf", "ariali.ttf": "Arial Italic.ttf", "arialbi.ttf": "Arial Bold Italic.ttf"}
    for candidate in (name, mac.get(name, name)):
        for f in FONTS.iterdir():
            if f.name.lower() == candidate.lower():
                return str(f)
    return str(FONTS / name)

DOCS = [
    # source, output, short title, accent, light accent
    ("terms.md", "current_terms_and_conditions.pdf", "Terms of Use", (94, 179, 255), (232, 243, 255)),
    ("privacy.md", "current_privacy_policy.pdf", "Privacy Policy", (52, 211, 153), (230, 250, 242)),
]

INK = (40, 46, 58)
MUTED = (120, 128, 140)
DARK = (8, 11, 16)
RULE = (225, 228, 233)


class LegalPDF(FPDF):
    # page chrome for body pages
    def __init__(self, title, effective, accent):
        super().__init__(format="A4")
        self.doc_title = title
        self.effective = effective
        self.accent = accent
        self.set_margins(22, 24, 22)
        self.set_auto_page_break(True, margin=24)
        self.add_font("Arial", "", font("arial.ttf"))
        self.add_font("Arial", "B", font("arialbd.ttf"))
        self.add_font("Arial", "I", font("ariali.ttf"))
        self.add_font("Arial", "BI", font("arialbi.ttf"))

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Arial", "B", 9)
        self.set_text_color(*self.accent)
        self.set_y(12)
        self.cell(0, 5, "Current")
        self.set_text_color(*MUTED)
        self.set_font("Arial", "", 9)
        self.set_x(self.l_margin)
        self.cell(0, 5, self.doc_title, align="R")
        self.set_draw_color(*self.accent)
        self.set_line_width(0.5)
        self.line(self.l_margin, 18, self.w - self.r_margin, 18)
        self.set_y(26)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-16)
        self.set_draw_color(*RULE)
        self.set_line_width(0.2)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.set_font("Arial", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 7, f"{self.effective}  |  Current")
        self.set_x(self.l_margin)
        self.cell(0, 7, f"Page {self.page_no()}", align="R")


def cover(pdf, title, effective, version, light):
    # dark cover page with the accent circle
    pdf.add_page()
    pdf.set_auto_page_break(False)
    pdf.set_fill_color(*DARK)
    pdf.rect(0, 0, pdf.w, pdf.h, "F")
    pdf.set_fill_color(*light)
    pdf.ellipse(pdf.w - 52, -52, 104, 104, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Arial", "B", 40)
    pdf.set_xy(26, 92)
    pdf.multi_cell(140, 16, title.replace(" ", "\n", 1) if len(title) > 10 else title)
    pdf.set_font("Arial", "", 12)
    pdf.set_x(26)
    pdf.cell(0, 12, "Current  \u2022  Budgeting for real life", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Arial", "", 9.5)
    pdf.set_x(26)
    pdf.cell(0, 5, f"Effective Date: {effective}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(26)
    pdf.cell(0, 5, f"Version {version}")
    pdf.set_font("Arial", "", 9)
    pdf.set_xy(26, pdf.h - 22)
    pdf.cell(0, 5, "No account. No bank login.")
    pdf.set_auto_page_break(True, margin=24)


def heading(pdf, text):
    # numbered section heading with a hairline under it
    if pdf.get_y() > pdf.h - 55:
        pdf.add_page()
    pdf.ln(4)
    pdf.set_font("Arial", "B", 13)
    pdf.set_text_color(*pdf.accent)
    pdf.multi_cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*RULE)
    pdf.set_line_width(0.2)
    y = pdf.get_y() + 1.5
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(4)


def paragraph(pdf, text):
    pdf.set_font("Arial", "", 10.5)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 5.6, text, markdown=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2.2)


def bullets(pdf, items):
    pdf.set_font("Arial", "", 10.5)
    for item in items:
        pdf.set_text_color(*pdf.accent)
        pdf.set_x(pdf.l_margin + 2)
        pdf.cell(5, 5.6, "\u2022")
        pdf.set_text_color(*INK)
        pdf.multi_cell(0, 5.6, item, markdown=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(0.8)
    pdf.ln(1.6)


def callout(pdf, text, light):
    # tinted box for the opening note
    pdf.set_font("Arial", "I", 10.5)
    pdf.set_text_color(*INK)
    pdf.set_fill_color(*light)
    pdf.set_draw_color(*pdf.accent)
    pdf.set_line_width(0.3)
    pdf.multi_cell(0, 5.8, text, border=1, fill=True, padding=4, markdown=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)


def table(pdf, rows):
    # two-column contact table
    pdf.set_font("Arial", "", 10.5)
    pdf.set_text_color(*INK)
    pdf.set_fill_color(255, 255, 255)
    bold = FontFace(emphasis="BOLD", color=INK)
    with pdf.table(
        col_widths=(35, 95),
        first_row_as_headings=False,
        line_height=7,
        borders_layout="NONE",
        cell_fill_mode="NONE",
    ) as t:
        for label, value in rows:
            r = t.row()
            r.cell(label, style=bold)
            r.cell(value)
    pdf.ln(3)


def build(src, out, short_title, accent, light):
    lines = (HERE / src).read_text(encoding="utf-8").splitlines()
    meta = next(l for l in lines if l.startswith("Effective date:"))
    effective, version = re.match(r"Effective date: (.+?) · Version (.+)", meta).groups()

    pdf = LegalPDF(short_title, f"Effective: {effective}", accent)
    cover(pdf, short_title, effective, version, light)
    pdf.add_page()

    para, items, rows = [], [], []

    # flush any open block before starting the next one
    def flush():
        if para:
            paragraph(pdf, " ".join(para))
            para.clear()
        if items:
            bullets(pdf, list(items))
            items.clear()
        if rows:
            table(pdf, list(rows))
            rows.clear()

    for line in lines:
        s = line.strip()
        if s.startswith("# ") or s.startswith("Effective date:"):
            continue
        if not s:
            flush()
        elif s.startswith("## "):
            flush()
            heading(pdf, s[3:])
        elif s.startswith("> "):
            flush()
            callout(pdf, s[2:], light)
        elif s.startswith("- "):
            items.append(s[2:])
        elif s.startswith("|"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if any(cells) and not set("".join(cells)) <= set("-: "):
                rows.append(cells)
        else:
            para.append(s)
    flush()

    OUT.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT / out))
    print(f"wrote {OUT / out} ({pdf.page_no()} pages)")


if __name__ == "__main__":
    for doc in DOCS:
        build(*doc)
