/**
 * Roadmap v2: reference-look matching, M1.
 * User explicitly samples a photo pixel patch; only visual swatch-colour
 * proximity is ranked. This is NOT garment recognition, fit, scale,
 * verified dye colour, suitability, stock or production approval.
 */
export type Rgb = readonly [number, number, number];
export type ReferenceFabric = {
  id: string;
  name: string;
  hex: string;
};
export type ReferenceImagePixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export function referenceHexToRgb(hex: unknown): Rgb | null {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function toLab(rgb: Rgb): Rgb {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const x = (linear[0] * 0.4124564 + linear[1] * 0.3575761 + linear[2] * 0.1804375) / 0.95047;
  const y = (linear[0] * 0.2126729 + linear[1] * 0.7151522 + linear[2] * 0.0721750);
  const z = (linear[0] * 0.0193339 + linear[1] * 0.1191920 + linear[2] * 0.9503041) / 1.08883;
  const fn = (value: number) => value > 0.008856451679 ? Math.cbrt(value) : 7.787037037 * value + 16 / 116;
  const fx = fn(x), fy = fn(y), fz = fn(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function validRgb(rgb: readonly number[]): rgb is Rgb {
  return rgb.length === 3 && rgb.every((value) => Number.isInteger(value) && value >= 0 && value <= 255);
}

/** CIE76 distance, not perceptual accuracy proof or an availability score. */
export function rankReferenceSwatches<T extends ReferenceFabric>(
  sample: Rgb,
  candidates: readonly T[],
  limit = 6,
): Array<{ fabric: T; distance: number }> {
  if (!validRgb(sample) || !Number.isInteger(limit) || limit < 1 || limit > 100) return [];
  const origin = toLab(sample);
  const seen = new Set<string>();
  return candidates.flatMap((fabric) => {
    if (!fabric?.id || seen.has(fabric.id)) return [];
    const rgb = referenceHexToRgb(fabric.hex);
    if (!rgb) return [];
    seen.add(fabric.id);
    const lab = toLab(rgb);
    const distance = Math.hypot(lab[0] - origin[0], lab[1] - origin[1], lab[2] - origin[2]);
    return [{ fabric, distance }];
  }).sort((a, b) => a.distance - b.distance || a.fabric.id.localeCompare(b.fabric.id)).slice(0, limit);
}

/** Median local patch: handles transparent pixels and accidental single speckles. */
export function sampleReferencePatch(
  pixels: ReferenceImagePixels,
  atX: number,
  atY: number,
  radius = 4,
): Rgb | null {
  const { width, height, data } = pixels;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      width * height > 10_000_000 || data.length !== width * height * 4 ||
      !Number.isInteger(atX) || !Number.isInteger(atY) ||
      atX < 0 || atY < 0 || atX >= width || atY >= height ||
      !Number.isInteger(radius) || radius < 0 || radius > 12) return null;
  const buckets: [number[], number[], number[]] = [[], [], []];
  for (let y = Math.max(0, atY - radius); y <= Math.min(height - 1, atY + radius); y += 1) {
    for (let x = Math.max(0, atX - radius); x <= Math.min(width - 1, atX + radius); x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 128) continue;
      for (let channel = 0; channel < 3; channel += 1) buckets[channel].push(data[offset + channel]);
    }
  }
  if (!buckets[0].length) return null;
  return buckets.map((values) => {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  }) as unknown as Rgb;
}

/** Keep reference-photo shirt and trouser colour samples independent and transient. */
export type ReferenceTarget = "shirt" | "pant";
export type ReferenceSamples = Readonly<Record<ReferenceTarget, Rgb | null>>;
export function withReferenceTargetSample(
  previous: ReferenceSamples,
  target: ReferenceTarget,
  sample: Rgb | null,
): ReferenceSamples {
  if ((target !== "shirt" && target !== "pant") || (sample !== null && !validRgb(sample))) {
    return previous;
  }
  return { ...previous, [target]: sample === null ? null : [sample[0], sample[1], sample[2]] as Rgb };
}
