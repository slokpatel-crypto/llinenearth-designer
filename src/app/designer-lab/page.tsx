import type { Metadata } from "next";
import { DesignerLab } from "@/components/DesignerLab";
import "./designer-lab.css";

export const metadata: Metadata = {
  title: "LLinen Earth Designer Lab",
  description: "A focused LLinen Earth workspace for real-stock fabric pairing and Designer output.",
};

export default function DesignerLabPage() {
  return <DesignerLab />;
}
