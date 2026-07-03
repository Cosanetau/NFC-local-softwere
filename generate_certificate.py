#!/usr/bin/env python3
"""Generate a printable Certificate of Excellence PDF."""

import argparse
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import inch, mm
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = landscape(A4)
MARGIN = 0.75 * inch

GOLD = colors.HexColor("#B8860B")
DARK_GOLD = colors.HexColor("#8B6914")
NAVY = colors.HexColor("#1a2744")
CREAM = colors.HexColor("#FFFDF7")


def draw_border(c: canvas.Canvas) -> None:
    """Draw decorative double border."""
    inset = 0.4 * inch
    outer = [inset, inset, PAGE_WIDTH - inset, PAGE_HEIGHT - inset]
    inner = [inset + 6, inset + 6, PAGE_WIDTH - inset - 6, PAGE_HEIGHT - inset - 6]

    c.setStrokeColor(GOLD)
    c.setLineWidth(3)
    c.rect(*outer, stroke=1, fill=0)

    c.setLineWidth(1)
    c.rect(*inner, stroke=1, fill=0)

    corner = 0.35 * inch
    corners = [
        (outer[0], outer[1]),
        (outer[2], outer[1]),
        (outer[0], outer[3]),
        (outer[2], outer[3]),
    ]
    c.setFillColor(GOLD)
    for x, y in corners:
        c.circle(x, y, corner / 2, stroke=0, fill=1)


def draw_title(c: canvas.Canvas, y: float) -> None:
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 42)
    c.drawCentredString(PAGE_WIDTH / 2, y, "Certificate of Excellence")

    c.setStrokeColor(GOLD)
    c.setLineWidth(2)
    line_w = 4.5 * inch
    cx = PAGE_WIDTH / 2
    c.line(cx - line_w / 2, y - 18, cx + line_w / 2, y - 18)


def draw_body(c: canvas.Canvas, award_date: str) -> None:
    cx = PAGE_WIDTH / 2
    y = PAGE_HEIGHT - 2.4 * inch

    c.setFillColor(colors.HexColor("#333333"))
    c.setFont("Times-Roman", 16)
    c.drawCentredString(cx, y, "This certificate is proudly presented to")

    y -= 0.85 * inch
    c.setStrokeColor(DARK_GOLD)
    c.setLineWidth(0.75)
    name_w = 4.5 * inch
    c.line(cx - name_w / 2, y, cx + name_w / 2, y)

    y -= 1.1 * inch
    c.setFillColor(colors.HexColor("#444444"))
    c.setFont("Times-Roman", 15)
    lines = [
        "In recognition of outstanding performance, dedication, and",
        "commitment to excellence in the workplace.",
    ]
    for line in lines:
        c.drawCentredString(cx, y, line)
        y -= 22

    y -= 0.35 * inch
    c.setFont("Times-Italic", 13)
    c.drawCentredString(cx, y, f"Awarded on {award_date}")


def draw_signature_block(
    c: canvas.Canvas,
    x_center: float,
    y_line: float,
    name: str,
    title: str,
    line_width: float = 2.4 * inch,
) -> None:
    """Draw signature line with name and title beneath."""
    x_left = x_center - line_width / 2

    c.setStrokeColor(NAVY)
    c.setLineWidth(0.75)
    c.line(x_left, y_line, x_left + line_width, y_line)

    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 12)
    c.drawCentredString(x_center, y_line - 22, name)

    c.setFont("Times-Roman", 11)
    c.setFillColor(colors.HexColor("#555555"))
    c.drawCentredString(x_center, y_line - 38, title)


def draw_signatures(c: canvas.Canvas) -> None:
    y_line = 1.55 * inch
    left_x = PAGE_WIDTH * 0.28
    right_x = PAGE_WIDTH * 0.72

    draw_signature_block(
        c, left_x, y_line,
        name="Caleb Yeardley",
        title="Workshop Operations Manager",
    )
    draw_signature_block(
        c, right_x, y_line,
        name="Kieren Power",
        title="Managing Director",
    )


def generate_certificate(
    output_path: Path,
    award_date: str | None = None,
) -> Path:
    if award_date is None:
        award_date = date.today().strftime("%d %B %Y")

    c = canvas.Canvas(str(output_path), pagesize=landscape(A4))
    c.setPageCompression(0)

    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

    draw_border(c)
    draw_title(c, PAGE_HEIGHT - 1.35 * inch)
    draw_body(c, award_date)
    draw_signatures(c)

    c.save()
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Certificate of Excellence PDF")
    parser.add_argument(
        "--date",
        default=None,
        help="Award date (e.g. '3 July 2026'). Defaults to today.",
    )
    parser.add_argument(
        "--output",
        default="certificate_of_excellence.pdf",
        help="Output PDF filename",
    )
    args = parser.parse_args()

    out = generate_certificate(
        Path(args.output),
        award_date=args.date,
    )
    print(f"Certificate saved to: {out.resolve()}")


if __name__ == "__main__":
    main()
