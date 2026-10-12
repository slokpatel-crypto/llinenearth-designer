#!/usr/bin/env python3
"""Visually compare the original Studio photograph to a REAL Blender QA frame.

This is a labelled, SHA-bound human-review sheet, NOT image-to-3D reconstruction,
automated recognition, photoreal matching, or an acceptance certificate.
Requires Pillow. Source and candidate pixels are not modified except to resize
separate panels for simultaneous inspection.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def panel(source: Path, width: int, height: int):
    image = Image.open(source).convert("RGB")
    image = ImageOps.contain(image, (width, height), Image.Resampling.LANCZOS)
    backing = Image.new("RGB", (width, height), "#f4f2ee")
    backing.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
    return backing

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    for source in (options.reference, options.candidate):
        if not source.is_file() or source.stat().st_size < 12000:
            raise SystemExit(f"Missing/invalid visual source: {source}")

    width, height, header = 560, 810, 76
    canvas = Image.new("RGB", (width * 2, height + header), "#e8e5e0")
    draw = ImageDraw.Draw(canvas)
    canvas.paste(panel(options.reference, width, height), (0, header))
    canvas.paste(panel(options.candidate, width, height), (width, header))
    draw.text((18, 12), "ORIGINAL STUDIO PHOTO — IDENTITY TARGET", fill="#111111")
    draw.text((width + 18, 12), "EXPERIMENTAL 3D — NOT APPROVED", fill="#6e1d1d")
    draw.text((18, 37), "Front reference only; hidden views unknown", fill="#444444")
    draw.text((width + 18, 37), "No visual parity, fabric or tailor sign-off", fill="#6e1d1d")

    options.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(options.output, quality=91, optimize=True)
    receipt = {
        "type": "linen-earth-source-photo-vs-3d-candidate-v1",
        "reference": str(options.reference),
        "referenceSha256": digest(options.reference),
        "candidate": str(options.candidate),
        "candidateSha256": digest(options.candidate),
        "contactSheet": str(options.output),
        "contactSheetSha256": digest(options.output),
        "frontPhotoOnly": True,
        "same3dIdentityApproved": False,
        "realisticDrapeApproved": False,
        "supplierFabricApproved": False,
        "humanVisualReviewRequired": True,
        "customerPromotionPermitted": False
    }
    manifest = options.output.with_suffix(".json")
    manifest.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Written UNAPPROVED reference comparison: {options.output}")
    print(f"Receipt: {manifest}")

if __name__ == "__main__":
    main()
