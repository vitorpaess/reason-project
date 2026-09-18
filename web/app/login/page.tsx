import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-2xl">📈</div>
          <h1 className="text-lg font-semibold text-ink-primary">Pairs Trading Monitor</h1>
          <p className="mt-1 text-sm text-ink-muted">Acesso restrito</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
