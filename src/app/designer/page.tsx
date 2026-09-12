import { AppShell } from "@/components/AppShell";
import { FabricStudio } from "@/components/FabricStudio";

export default function Designer() {
  return (
    <AppShell>
      <div className="wrap">
        <FabricStudio />
      </div>
    </AppShell>
  );
}
