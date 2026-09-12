import { AppShell } from "@/components/AppShell";
import { SavedDesignsClient } from "@/components/SavedDesignsClient";
import "../atelier/atelier.css";

export default function DesignsPage() {
  return <AppShell><div className="wrap"><SavedDesignsClient /></div></AppShell>;
}
