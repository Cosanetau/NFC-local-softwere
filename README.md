# Certificate of Excellence

Generate a printable PDF certificate for employee recognition.

## Quick start

```bash
pip install -r requirements.txt
python3 generate_certificate.py
```

This creates `certificate_of_excellence.pdf` in the current directory. The employee name is left as a blank line so you can write it by hand when printing.

## Options

| Option | Description |
|--------|-------------|
| `--date` | Award date, e.g. `3 July 2026` (default: today) |
| `--output` | Output filename (default: `certificate_of_excellence.pdf`) |

## Signatures

The certificate includes two signature lines at the bottom:

- **Left:** Caleb Yeardley — Workshop Operations Manager
- **Right:** Kieren Power — Managing Director

Print the PDF and sign above each line by hand.
