import { AppShell } from "@/components/AppShell";
import { StudioDashboard } from "@/components/StudioDashboard";
import "./designer.css";
import "./enhancements.css";
import "./phase4.css";
import "./visualization.css";
import "./studio-dashboard.css";

export default function Designer() {
  return (
    <AppShell>
      <StudioDashboard />
    </AppShell>
  );
}
