import { AppShell } from "@/components/AppShell";
import { DesignerJourney } from "@/components/DesignerJourney";

export default function Designer() {
  return (
    <AppShell>
      <div className="wrap">
        <DesignerJourney />
      </div>
    </AppShell>
  );
}
