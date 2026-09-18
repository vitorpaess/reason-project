import { Suspense } from "react";
import { LineChart } from "lucide-react";
import { colors } from "@/lib/theme";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <LineChart size={22} strokeWidth={1.75} color={colors.seriesZScore} />
          </div>
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
