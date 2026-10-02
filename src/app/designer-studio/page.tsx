import { AppShell } from "@/components/AppShell";
import { DesignerModule } from "@/components/DesignerModule";
import "./designer-studio.css";
import "./designer-light.css";

export const metadata = { title: "Designer | Linen Earth", description: "Explore shirt and trouser designs from Linen Earth catalogue fabrics." };

export default function DesignerStudioPage() {
  return <AppShell><DesignerModule /></AppShell>;
}
