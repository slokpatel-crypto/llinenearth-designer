import Image from "next/image";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="siteShell">
    <header className="topbar wrap">
      <Link href="/" className="brand" aria-label="LLinen Earth home"><Image src="/brand/llinen-earth-logo.png" alt="LLinen Earth" width={1273} height={531} priority /></Link>
      <nav aria-label="Primary navigation"><Link href="/designer">Designer</Link><Link href="/designs">Designs</Link><Link href="/knowledge">Fashion Brain</Link><Link href="/atelier">Atelier</Link></nav>
      <Link className="navCta" href="/designer">Start designing</Link>
    </header>
    <main>{children}</main>
    <footer className="footer wrap"><span>LLinen Earth</span><span>Premium fabric. Considered design.</span></footer>
    <nav className="mobileDock" aria-label="Mobile navigation"><Link href="/">Home</Link><Link href="/designer">Designer</Link><Link href="/designs">Designs</Link><Link href="/atelier">Atelier</Link></nav>
  </div>;
}
