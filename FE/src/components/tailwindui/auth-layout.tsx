
import type React from 'react'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col p-4 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="flex grow items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          {children}
        </div>
      </div>
    </main>
  )
}
