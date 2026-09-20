"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./login.css";

export default function OperatorLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/operator/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/operator") ? next : "/operator");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="operatorLogin">
    <section className="operatorLoginPanel">
      <div className="operatorLoginBrand"><span>LE</span><div><b>LLINEN EARTH</b><small>PRIVATE OPERATOR ACCESS</small></div></div>
      <div className="operatorLoginCopy">
        <p>OPERATOR DESK</p>
        <h1>Business memory.<br/><em>Private by design.</em></h1>
        <span>Sign in to access customer journeys, outcomes and operator records.</span>
      </div>
      <form onSubmit={submit}>
        <label>OPERATOR PASSWORD<input type="password" autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} autoFocus /></label>
        <button disabled={loading || !password}>{loading ? "Signing in…" : "Enter Operator Desk ↗"}</button>
        {error && <p className="operatorLoginError">{error}</p>}
      </form>
      <footer>This login never sends your password to browser storage. Sessions use a signed HttpOnly cookie.</footer>
    </section>
  </main>;
}
