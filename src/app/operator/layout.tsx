import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LLinen Earth — Operator Desk",
  robots: { index: false, follow: false, nocache: true },
};

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
