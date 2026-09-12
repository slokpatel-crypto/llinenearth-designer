import { AppShell } from "@/components/AppShell";
import { DesignerJourney } from "@/components/DesignerJourney";
import "./designer.css";
import "./phase4.css";

export default function Designer() {
  return (
    <AppShell>
      <div className="wrap">
        <DesignerJourney />
      </div>
    </AppShell>
  );
}
