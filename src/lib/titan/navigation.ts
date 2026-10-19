/**
 * TITAN is a front-end experience layer, not a replacement for the existing
 * Linen Earth garment model, tailoring engine, or authenticated customer data.
 * Keep customer journeys pointed at real, maintained application routes.
 */
export const titanJourneys = [
  {
    id: "design",
    number: "01",
    eyebrow: "FABRIC & FORM",
    title: "Design your look",
    description: "Choose your shirt and trouser cloth, explore the cut, and inspect the studio preview.",
    href: "/designer-studio",
    action: "Open designer",
    image: "/designer/studio-tucked.webp",
    imageAlt: "Linen Earth studio outfit reference",
  },
  {
    id: "direction",
    number: "02",
    eyebrow: "STYLE DIRECTION",
    title: "Find your direction",
    description: "Begin with the occasion, climate and mood, then explore coordinated menswear.",
    href: "/style-director",
    action: "Explore Style Director",
    image: "/editorial/blazer.webp",
    imageAlt: "Linen Earth blazer editorial reference",
  },
  {
    id: "measure",
    number: "03",
    eyebrow: "FIT & PROPORTION",
    title: "Make it yours",
    description: "Follow the shirt or trouser measurement guidance before saving your fit details.",
    href: "/measurements",
    action: "Open measurements",
    image: "/editorial/trouser.webp",
    imageAlt: "Linen Earth trouser editorial reference",
  },
] as const;

export const titanQuickLinks = [
  { label: "Designer Studio", href: "/designer-studio" },
  { label: "Style Director", href: "/style-director" },
  { label: "Measurements", href: "/measurements" },
  { label: "My Account", href: "/account" },
] as const;

export const titanDevelopmentTrack = [
  {
    id: "model",
    number: "01",
    title: "Garment realism",
    description: "Geometry, fitting, drape and calibrated physical fabric mapping require further release validation.",
  },
  {
    id: "fabrics",
    number: "02",
    title: "Fabric precision",
    description: "Supplier repeat dimensions and material evidence must be verified before exact-fidelity claims.",
  },
  {
    id: "commerce",
    number: "03",
    title: "Commerce and operations",
    description: "An integrated, production-validated inventory, checkout and operator journey remains roadmap work.",
  },
] as const;
