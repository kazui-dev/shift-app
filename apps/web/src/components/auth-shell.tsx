import type { ReactNode } from "react"

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6">
      <section className="flex w-full min-w-0 flex-col gap-6 rounded-2xl border bg-card px-6 py-8 text-sm leading-relaxed text-card-foreground shadow-sm sm:px-8">
        {children}
      </section>
    </main>
  )
}
