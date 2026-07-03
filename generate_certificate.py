#!/usr/bin/env python3
"""Generate a printable Certificate of Excellence PDF."""

import argparse
import math
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = A4

GOLD = colors.HexColor("#B8860B")
DARK_GOLD = colors.HexColor("#8B6914")
NAVY = colors.HexColor("#1a2744")
CREAM = colors.HexColor("#FFFDF7")
STAR_YELLOW = colors.HexColor("#FBBC04")
GOOGLE_GRAY = colors.HexColor("#5F6368")
LIGHT_BLUE = colors.HexColor("#D2E3FC")
AVATAR_BLUE = colors.HexColor("#1A73E8")

REVIEWER_NAME = "Victor Hogan"
REVIEW_DATE = "Thu Jul, 2026"
REVIEW_TEXT = (
    "I had an unusual electrical issue with my trailer. Tony was able to "
    "diagnose the problem and was able fix it in record time. Thank you Tony!"
)


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


def _wrap_text(text: str, font: str, size: int, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_star(c: canvas.Canvas, cx: float, cy: float, radius: float) -> None:
    """Draw a simple five-point star."""
    points: list[tuple[float, float]] = []
    for i in range(10):
        angle = math.radians(90 + i * 36)
        r = radius if i % 2 == 0 else radius * 0.4
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))

    path = c.beginPath()
    path.moveTo(*points[0])
    for point in points[1:]:
        path.lineTo(*point)
    path.close()

    c.setFillColor(STAR_YELLOW)
    c.setStrokeColor(colors.HexColor("#E37400"))
    c.setLineWidth(0.5)
    c.drawPath(path, stroke=1, fill=1)


def draw_avatar(c: canvas.Canvas, cx: float, cy: float, radius: float) -> None:
    """Draw a simple profile avatar circle."""
    c.setFillColor(LIGHT_BLUE)
    c.setStrokeColor(colors.white)
    c.circle(cx, cy, radius, stroke=0, fill=1)

    c.setFillColor(AVATAR_BLUE)
    c.circle(cx, cy + radius * 0.15, radius * 0.32, stroke=0, fill=1)
    c.circle(cx, cy - radius * 0.55, radius * 0.45, stroke=0, fill=1)


def draw_google_review(c: canvas.Canvas) -> None:
    """Draw the Google review in the centre of the certificate."""
    cx = PAGE_WIDTH / 2
    content_width = 4.6 * inch
    center_y = 4.8 * inch

    # Five stars
    star_radius = 0.13 * inch
    star_spacing = 0.34 * inch
    stars_y = center_y + 1.35 * inch
    stars_total_w = 4 * star_spacing
    star_start_x = cx - stars_total_w / 2
    for i in range(5):
        draw_star(c, star_start_x + i * star_spacing, stars_y, star_radius)

    # Avatar and reviewer info
    avatar_radius = 0.28 * inch
    avatar_cx = cx - 1.1 * inch
    avatar_cy = stars_y - 0.65 * inch
    draw_avatar(c, avatar_cx, avatar_cy, avatar_radius)

    name_x = avatar_cx + avatar_radius + 0.2 * inch
    name_y = avatar_cy + 0.12 * inch
    c.setFillColor(colors.HexColor("#202124"))
    c.setFont("Helvetica-Bold", 13)
    c.drawString(name_x, name_y, REVIEWER_NAME)

    c.setFillColor(GOOGLE_GRAY)
    c.setFont("Helvetica", 10)
    c.drawString(name_x, name_y - 16, REVIEW_DATE)

    # Review text with quotation marks
    quote_y = avatar_cy - 0.75 * inch
    c.setFillColor(colors.HexColor("#C4C7C5"))
    c.setFont("Helvetica-Bold", 36)
    c.drawString(cx - content_width / 2 - 0.05 * inch, quote_y + 8, "\u201c")

    c.setFillColor(GOOGLE_GRAY)
    c.setFont("Helvetica-Oblique", 12)
    lines = _wrap_text(REVIEW_TEXT, "Helvetica-Oblique", 12, content_width - 0.3 * inch)
    line_height = 17
    text_block_height = len(lines) * line_height
    text_y = quote_y - text_block_height / 2 + line_height / 2

    for line in lines:
        c.drawCentredString(cx + 0.1 * inch, text_y, line)
        text_y -= line_height

    c.setFillColor(colors.HexColor("#C4C7C5"))
    c.setFont("Helvetica-Bold", 36)
    closing_x = cx + content_width / 2 - 0.15 * inch
    c.drawString(closing_x, text_y + 8, "\u201d")


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
    draw_google_review(c)
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
