"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, LogOut } from "lucide-react";

// Com ~7.9k pares, uma lista completa na sidebar não escala (nem em UX, nem
// no custo de buscar status de cada par a cada carregamento de página) —
// a navegação/busca por par vive na tabela do dashboard agora.
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-page px-3 py-5">
      <div className="mb-4 px-2.5 py-1.5">
        <Image src="/logo.png" alt="Paperplanes" width={135} height={24} priority />
      </div>

      <nav className="flex flex-col gap-0.5">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${
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
