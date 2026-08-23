import type { ReactNode } from "react"

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="flex w-full max-w-sm min-w-0 flex-col gap-6 rounded-2xl border bg-card px-6 py-8 text-sm leading-relaxed text-card-foreground shadow-sm sm:px-8">
        {children}
      </section>
    </main>
  )
}
