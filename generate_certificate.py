#!/usr/bin/env python3
"""Generate a printable Certificate of Excellence PDF."""

import argparse
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = A4

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


def draw_header(c: canvas.Canvas) -> None:
    cx = PAGE_WIDTH / 2
    y = PAGE_HEIGHT - 1.5 * inch

    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 36)
    c.drawCentredString(cx, y, "Certificate of Excellence")

    c.setStrokeColor(GOLD)
    c.setLineWidth(2)
    line_w = 4 * inch
    c.line(cx - line_w / 2, y - 16, cx + line_w / 2, y - 16)

    y -= 0.9 * inch
    c.setFillColor(colors.HexColor("#333333"))
    c.setFont("Times-Roman", 15)
    c.drawCentredString(cx, y, "This certificate is proudly presented to")

    y -= 0.75 * inch
    c.setStrokeColor(DARK_GOLD)
    c.setLineWidth(0.75)
    name_w = 4 * inch
    c.line(cx - name_w / 2, y, cx + name_w / 2, y)


def draw_signature_block(
    c: canvas.Canvas,
    x_center: float,
    y_line: float,
    name: str,
    title: str,
    line_width: float = 2.1 * inch,
) -> None:
    """Draw signature line with name and title beneath."""
    x_left = x_center - line_width / 2

    c.setStrokeColor(NAVY)
    c.setLineWidth(0.75)
    c.line(x_left, y_line, x_left + line_width, y_line)

    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 11)
    c.drawCentredString(x_center, y_line - 20, name)

    c.setFont("Times-Roman", 10)
    c.setFillColor(colors.HexColor("#555555"))
    c.drawCentredString(x_center, y_line - 34, title)


def draw_signatures(c: canvas.Canvas) -> None:
    y_line = 1.6 * inch
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


def generate_certificate(output_path: Path) -> Path:
    c = canvas.Canvas(str(output_path), pagesize=A4)
    c.setPageCompression(0)

    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

    draw_border(c)
    draw_header(c)
    # Middle left blank for pasting a Google review photocopy
    draw_signatures(c)

    c.save()
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Certificate of Excellence PDF")
    parser.add_argument(
        "--output",
        default="certificate_of_excellence.pdf",
        help="Output PDF filename",
    )
    args = parser.parse_args()

    out = generate_certificate(Path(args.output))
    print(f"Certificate saved to: {out.resolve()}")


if __name__ == "__main__":
    main()
