export type CatalogGarment = {
  slug: "shirts" | "trousers" | "suits" | "blazers";
  name: string;
  singular: string;
  description: string;
  fabrics: string[];
};

export const catalogGarments: CatalogGarment[] = [
  {
    slug: "shirts",
    name: "Shirts",
    singular: "shirt",
    description: "Fabric-led shirts for business, occasion dressing and refined everyday wear.",
    fabrics: ["Linen", "Giza Cotton", "100% Cotton"],
  },
  {
    slug: "trousers",
    name: "Trousers",
    singular: "trouser",
    description: "Tailored trousers balanced for drape, comfort and a clean silhouette.",
    fabrics: ["Linen", "TR", "TR-Wool", "Woollen", "Spada Cotton"],
  },
  {
    slug: "suits",
    name: "Suits",
    singular: "suit",
    description: "Considered suiting for business, weddings and formal occasions.",
    fabrics: ["Linen", "TR", "TR-Wool", "Woollen", "Spada Cotton"],
  },
  {
    slug: "blazers",
    name: "Blazers",
    singular: "blazer",
    description: "Soft or structured layers designed around climate, occasion and personal style.",
    fabrics: ["Linen", "TR", "TR-Wool", "Woollen", "Spada Cotton"],
  },
];
