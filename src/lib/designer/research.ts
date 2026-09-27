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

// The Met marks each linked object Public Domain and releases its Open Access
// images under CC0. These are editorial references, not LLinen Earth stock.
export const DESIGNER_ARCHIVE_IMAGES = [
  {
    title: "Suit, American, ca. 1880", medium: "Wool and linen",
    image: "https://collectionapi.metmuseum.org/api/collection/v1/iiif/82456/343668/main-image",
    source: "https://www.metmuseum.org/art/collection/search/82456", credit: "The Metropolitan Museum of Art · CC0",
  },
  {
    title: "Waistcoat, European, late 18th century", medium: "Silk and linen",
    image: "https://collectionapi.metmuseum.org/api/collection/v1/iiif/83317/316995/main-image",
    source: "https://www.metmuseum.org/art/collection/search/83317", credit: "The Metropolitan Museum of Art · CC0",
  },
] as const;
