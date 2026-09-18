"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível entrar.");
      return;
    }

    const from = searchParams.get("from") ?? "/";
    router.replace(from);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
    >
      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-ink-muted">
        Senha
      </label>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-sm text-ink-primary outline-none transition-colors focus:border-series"
        placeholder="••••••••"
      />

      {error && <p className="mt-3 text-sm text-status-critical">{error}</p>}

      <button
        type="submit"
        disabled={loading || password.length === 0}
        className="mt-4 w-full rounded-lg bg-series px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
