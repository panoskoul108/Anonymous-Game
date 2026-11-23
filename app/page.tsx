"use client";

import { useRouter } from "next/navigation";
import { Sparkles, Smartphone, Shield } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.22),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.16),_transparent_50%)]">
      <div className="w-full max-w-xl rounded-3xl bg-[#130b29]/95 border border-fuchsia-500/35 p-8 sm:p-10 text-center space-y-6 shadow-2xl">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-300">
          <Sparkles className="w-4 h-4 text-pink-400" />
          30+ Players • Real-Time Party Game
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
          ANONYMOUS REVEAL
        </h1>

        <p className="text-sm sm:text-base text-purple-200/80">
          Answer in secret. Guess who wrote it. Reveal the truth.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => router.push("/play")}
            className="rounded-2xl py-4 px-5 font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <Smartphone className="w-4 h-4" />
            Join as Player
          </button>

          <button
            onClick={() => router.push("/host/login")}
            className="rounded-2xl py-4 px-5 font-bold text-sm text-white bg-[#090514] border border-purple-500/35 hover:border-cyan-400 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-cyan-300" />
            Host Console
          </button>
        </div>
      </div>
    </main>
  );
}
