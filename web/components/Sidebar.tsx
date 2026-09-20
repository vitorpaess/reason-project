"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Heart } from "lucide-react";
import { statusColor, statusLabel } from "@/lib/theme";
import { PairIcon } from "@/lib/pair-icons";
import type { FavoritePair } from "@/lib/favorites-repo";

// Com ~7.9k pares, uma lista completa na sidebar não escala — só os
// favoritos (marcados com o coração na página do par) aparecem aqui.
export function Sidebar({ favoritos }: { favoritos: FavoritePair[] }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-page px-3 py-5">
      <div className="mb-4 px-2.5 py-1.5">
        <Image src="/logo.png" alt="Paperplanes" width={135} height={24} priority />
      </div>

      <nav className="flex flex-col gap-0.5">
        <Link
          href="/dashboard"
          className={`mb-3 flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${
            pathname === "/dashboard" ? "bg-surface-raised" : "hover:bg-surface"
          }`}
        >
          <LayoutGrid
            size={15}
            strokeWidth={1.75}
            className={pathname === "/dashboard" ? "text-ink-primary" : "text-ink-muted"}
          />
          <span
            className={`text-sm font-medium ${
              pathname === "/dashboard" ? "text-ink-primary" : "text-ink-secondary"
            }`}
          >
            Dashboard
          </span>
        </Link>

        <p className="mb-1 px-2.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Favoritos
        </p>

        {favoritos.length === 0 ? (
          <p className="px-2.5 text-xs leading-relaxed text-ink-muted">
            Nenhum par favoritado. Abra um par e clique no{" "}
            <Heart size={11} strokeWidth={2} className="inline" /> pra acompanhar ele aqui.
          </p>
        ) : (
          favoritos.map((fav) => {
            const slug = `${fav.tickerA}-${fav.tickerB}`;
            const active = pathname === `/pair/${slug}`;
            return (
              <Link
                key={fav.par}
                href={`/pair/${slug}`}
                className={`group rounded-lg px-2.5 py-2 transition-colors ${
                  active ? "bg-surface-raised" : "hover:bg-surface"
                }`}
              >
                <div className="flex items-center gap-2">
                  <PairIcon size={8} muted={!active} />
                  <span
                    className={`text-sm font-medium ${
                      active ? "text-ink-primary" : "text-ink-secondary group-hover:text-ink-primary"
                    }`}
                  >
                    {fav.par}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 pl-6 text-xs">
                  <span className="tabular-nums text-ink-muted">
                    z {fav.zScore !== null ? fav.zScore.toFixed(2) : "—"}
                  </span>
                  {fav.estado && (
                    <>
                      <span className="text-ink-muted">·</span>
                      <span style={{ color: statusColor(fav.estado) }} className="font-medium">
                        {statusLabel[fav.estado]}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </nav>

      <div className="mt-auto px-2.5">
        <LogoutButton />
      </div>
    </aside>
  );
}

function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-ink-muted transition-colors hover:bg-surface hover:text-ink-secondary"
    >
      <LogOut size={13} strokeWidth={1.75} />
      Sair
    </button>
  );
}
