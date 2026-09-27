// Curated reading for a human designer, never ingested as stock or as an
// automatic LLinen Earth taste rule. Summaries below are our interpretation.
export const DESIGNER_RESEARCH = [
  {
    kind: "Fashion history", title: "Fashioning Masculinities", publisher: "V&A Museum",
    url: "https://www.vam.ac.uk/articles/about-the-fashioning-masculinities-exhibition",
    lesson: "Menswear silhouettes and expressions have changed across settings and eras. Ask for the wearer's intended impression rather than treating one suit shape as universal.",
  },
  {
    kind: "Costume design", title: "Wedding Season costume design", publisher: "Netflix Tudum",
    url: "https://www.netflix.com/tudum/articles/wedding-season-outfits-indian-dresses",
    lesson: "A designer mapped looks across multiple events and used subtle colour echoes. Ask about the actual event and person; a film's palette is inspiration, not a prescription for an Indian wedding.",
  },
  {
    kind: "Runway", title: "Homme Plissé Spring/Summer 2025", publisher: "Issey Miyake",
    url: "https://eu.isseymiyake.com/blogs/news/17671",
    lesson: "The collection treats textile movement and volume as part of the silhouette. A relaxed leg needs a physical drape check before we claim the fabric will hold that shape.",
  },
  {
    kind: "Textile measurement", title: "ISO 9237 air permeability", publisher: "ISO",
    url: "https://www.iso.org/standard/16869.html",
    lesson: "Air permeability is a measurable fabric property. We cannot calculate ventilation or warmth reliably from colour, photograph or yarn count alone.",
  },
  {
    kind: "Colour measurement", title: "Colour differences in images", publisher: "CIE",
    url: "https://cie.co.at/publications/methods-evaluating-colour-differences-images",
    lesson: "Instrumental colour comparison depends on controlled viewing conditions. Catalogue HEX values are visual guides, not physical colour measurements.",
  },
] as const;

// Short, attributed notes for the rotating design-desk panel. These are
// editorial facts, not claims about LLinen Earth stock or fabric performance.
export const DESIGNER_FASHION_FACTS = [
  {
    category: "COLOUR / HISTORY", title: "Pink once signalled power.",
    detail: "In 1700s Europe, men wore pink as a sign of wealth and status. The meaning of a colour changes with its time and place.",
    source: "V&A · Colour in menswear", url: "https://www.vam.ac.uk/articles/in-the-pink-colour-in-menswear",
  },
  {
    category: "COLOUR / SOUTH ASIA", title: "Pink was never just one thing.",
    detail: "In South Asia, pink has remained a unisex colour; the V&A records a richly coloured courtly angarkha as one example.",
    source: "V&A · Colour in menswear", url: "https://www.vam.ac.uk/articles/in-the-pink-colour-in-menswear",
  },
  {
    category: "MENSWEAR / TIME", title: "Colour keeps coming back.",
    detail: "After a relatively restrained period in nineteenth-century menswear, vivid colour returned in the 1960s and 1970s.",
    source: "V&A · Colour in menswear", url: "https://www.vam.ac.uk/articles/in-the-pink-colour-in-menswear",
  },
  {
    category: "SILHOUETTE / MOVEMENT", title: "A silhouette can move.",
    detail: "For a 2025 Homme Plissé collection, Issey Miyake designed volume that shifts with the air and with how a garment is fastened.",
    source: "Issey Miyake · Spring Summer 2025", url: "https://eu.isseymiyake.com/blogs/news/17671",
  },
  {
    category: "FABRIC / AIRFLOW", title: "Breathability has a test.",
    detail: "Air permeability can be measured with a textile test. A photo of a swatch alone cannot tell us how air passes through it.",
    source: "ISO · 9237 air permeability", url: "https://www.iso.org/standard/16869.html",
  },
  {
    category: "COLOUR / VIEWING", title: "Screens change the read.",
    detail: "Even comparing two digital colours depends on viewing conditions. Confirm the physical cloth before making a final colour call.",
    source: "CIE · Colour differences in images", url: "https://cie.co.at/publications/methods-evaluating-colour-differences-images",
  },
] as const;
