"""Bounded, art-directed garment microfolds for *candidate* Blender meshes.

These functions do not simulate cloth or infer real supplier material properties.
Their only purpose is modest visual relief on the existing source-model shells.
Physical drape/fit must be separately approved before customer-facing promotion.
"""
from __future__ import annotations
import math

GARMENT_PANELS = frozenset({
    "ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric",
    "TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric",
})
MAX_PREVIEW_RELIEF_MM = 6.0


def _edge_fade(value: float, transition: float = 0.14) -> float:
    """Cubic zero-slope fade at open garment boundaries."""
    position = min(value, 1.0 - value) / transition
    amount = max(0.0, min(1.0, position))
    return amount * amount * (3.0 - 2.0 * amount)


def candidate_drape_offset_mm(
    panel: str, lateral: float, vertical: float, peak_mm: float = 3.0
) -> float:
    """Non-negative, bounded relief; coordinates are normalized panel-local.

    Zero at cuff/hem/waist-panel borders keeps open garment boundaries clean.
    Does NOT encode measured GSM, repeat size, bending stiffness or ease.
    """
    if panel not in GARMENT_PANELS:
        raise ValueError(f"Unknown Linen Earth garment panel: {panel}")
    values = (lateral, vertical, peak_mm)
    # Require real numeric scalars; implicit string/bool conversion would let
    # malformed operator inputs reach Blender geometry and release receipts.
    if any(
        isinstance(value, (str, bytes, bool))
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        for value in values
    ):
        raise ValueError("Drape coordinates and strength must be finite numeric scalars")
    if not 0.0 <= peak_mm <= MAX_PREVIEW_RELIEF_MM:
        raise ValueError("Candidate relief must be between 0 and 6 mm")
    if not -1.0 <= lateral <= 1.0 or not 0.0 <= vertical <= 1.0:
        raise ValueError("Candidate drape uses normalized panel coordinates")
    if peak_mm == 0:
        return 0.0
    fade = _edge_fade(vertical) * _edge_fade((lateral + 1.0) / 2.0)
    # Smooth even cross-panel phase on mirrored pieces: unlike abs(lateral),
    # lateral² has zero derivative at the centre and cannot introduce a sharp
    # artificial ridge in the middle of a sleeve or trouser leg.
    x = lateral * lateral if ("Sleeve" in panel or "Leg" in panel) else lateral
    if panel == "ShirtTorsoFabric":
        wave = math.sin(math.tau * (2.2 * x + 0.6 * vertical))
        gravity = 0.45 + 0.55 * (1.0 - vertical)
        allowance = 0.8
    elif panel.startswith("ShirtSleeve"):
        wave = math.sin(math.tau * (1.5 * x + 1.5 * vertical))
        gravity = 0.5 + 0.5 * (1.0 - vertical)
        allowance = 0.65
    elif panel == "TrouserWaistFabric":
        wave = math.sin(math.tau * (2.5 * x + vertical))
        gravity = 0.35
        allowance = 0.35
    else:
        # Continuous vertical fall with a small knee/upper-hem wave, never
        # substitute a baggy silhouette or simulate unknown linen mechanics.
        wave = math.sin(math.tau * (1.9 * x + 0.45 * vertical))
        gravity = 0.35 + 0.65 * (1.0 - vertical)
        allowance = 1.0
    crest = ((1.0 + wave) * 0.5) ** 2
    return peak_mm * fade * gravity * allowance * (0.25 + 0.75 * crest)
