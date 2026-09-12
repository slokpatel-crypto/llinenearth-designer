import type { FabricProfile } from "@/lib/fabric-analysis";

export type FabricSelection = {
  profile: FabricProfile;
  materialOverride?: string;
  toneOverride?: string;
};

export type ContextProfile = {
  occasion: string;
  venue: string;
  time: string;
  environment: string;
  formality: string;
  impression: string;
  fit: string;
  aesthetic: string;
};

export type DesignerBrief = {
  fabric: FabricSelection;
  context: ContextProfile;
};
