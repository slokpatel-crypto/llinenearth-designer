"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="briefComplete wrap"><p className="eyebrow">LLINEN EARTH · RECOVERY</p><h1>The atelier hit an unexpected interruption.</h1><p>Your browser-stored saved designs and handoffs remain separate from this page error. Retry the current screen, or return to the Designer if needed.</p><div className="actions"><button className="button light" onClick={reset}>Try again</button><a className="button" href="/designer">Open Designer</a></div></section>;
}
