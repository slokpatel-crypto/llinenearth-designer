"""Do not mistake metric Blender UVs for legacy normalized panel UVs.

Pure release-facing helper; missing provenance is allowed ONLY for the entirely
legacy six-panel export. Mixed/unknown source UV conventions are rejected.
"""
from __future__ import annotations

VALID_UNITS = frozenset({"panel_normalized", "mesh_metres"})


def resolve_panel_uv_units(panel_values):
    values = list(panel_values)
    if len(values) != 6:
        raise ValueError("Exactly six garment-panel UV unit receipts are required")
    if all(value is None for value in values):
        return None  # Legacy exporter compatibility, not a physical scale certificate.
    normalized = [value.strip() if isinstance(value, str) else "" for value in values]
    if any(not value for value in normalized):
        raise ValueError("Mixed declared and missing panel UV unit receipts")
    if len(set(normalized)) != 1:
        raise ValueError("Garment panels disagree about their UV coordinate units")
    if normalized[0] not in VALID_UNITS:
        raise ValueError("Unrecognized garment UV coordinate units")
    return normalized[0]
