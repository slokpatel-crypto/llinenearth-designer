import type { FabricDrape, FabricRoleTag, FabricSeason, FabricWeightClass } from "@/lib/fabric-stock";

export type PhysicalAvailability = "unknown" | "available" | "unavailable";

export type DesignerFabricMetadata = {
  fabricId: string;
  availability: PhysicalAvailability;
  weightGsm?: number;
  weightClass?: FabricWeightClass;
  weave?: string;
  texture?: string;
  drape?: FabricDrape;
  seasonTags?: FabricSeason[];
  formalityScore?: number;
  roleTags?: FabricRoleTag[];
  note?: string;
  verifiedAt?: string;
};

export type DesignerFabricMetadataMap = Record<string,DesignerFabricMetadata>;
