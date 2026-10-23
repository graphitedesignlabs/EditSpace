#!/usr/bin/env bash

set -euo pipefail

protocol_root="$(cd "$(dirname "$0")/.." && pwd)"
docs_dir="$protocol_root/Docs"
source_file="$docs_dir/EditSpace-Networking-Design.md"
output_file="$docs_dir/EditSpace-Networking-Design.pdf"
temporary_dir="$(mktemp -d "/tmp/editspace-networking-pdf.XXXXXX")"

cleanup() {
    rm -rf -- "$temporary_dir"
}
trap cleanup EXIT

if ! command -v pandoc >/dev/null 2>&1; then
    echo "pandoc is required to render the networking PDF" >&2
    exit 1
fi

html_file="$temporary_dir/networking.html"

pandoc "$source_file" \
    --from=gfm \
    --to=html5 \
    --standalone \
    --embed-resources \
    --resource-path="$docs_dir" \
    --metadata title="EditSpace Networking Protocol" \
    --output="$html_file"

if command -v weasyprint >/dev/null 2>&1; then
    weasyprint "$html_file" "$output_file"
else
    chrome_binary="${CHROME_BIN:-}"
    if [[ -z "$chrome_binary" ]]; then
        candidates=(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            "$(command -v google-chrome 2>/dev/null || true)"
            "$(command -v chromium 2>/dev/null || true)"
            "$(command -v chromium-browser 2>/dev/null || true)"
        )

        for candidate in "${candidates[@]}"; do
            if [[ -n "$candidate" && -x "$candidate" ]]; then
                chrome_binary="$candidate"
                break
            fi
        done
    fi

    if [[ -z "$chrome_binary" || ! -x "$chrome_binary" ]]; then
        echo "WeasyPrint or Chrome/Chromium is required to render the PDF" >&2
        exit 1
    fi

    profile_dir="$temporary_dir/chrome-profile"
    mkdir -p "$profile_dir"
    "$chrome_binary" \
        --headless=new \
        --no-sandbox \
        --disable-gpu \
        --disable-crash-reporter \
        --disable-breakpad \
        --no-pdf-header-footer \
        --user-data-dir="$profile_dir" \
        --print-to-pdf="$output_file" \
        "file://$html_file" \
        >/dev/null 2>&1
fi

if [[ ! -s "$output_file" ]]; then
    echo "PDF rendering failed: $output_file is empty" >&2
    exit 1
fi

echo "Rendered $output_file"
