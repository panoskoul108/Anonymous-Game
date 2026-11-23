"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";

export default function PlayEntryPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.replace(/\D/g, "").trim();
    if (!cleanPin) return;
    router.push(`/play/${cleanPin}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_55%)]">
      <div className="w-full max-w-md rounded-3xl bg-[#130b29] border border-fuchsia-500/35 p-7 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-cyan-300">
            <Sparkles className="w-4 h-4 text-pink-400" />
            Join Room
          </div>
          <h1 className="text-3xl font-black text-white">ANONYMOUS REVEAL</h1>
          <p className="text-xs text-purple-200/75">
            Enter the 6-digit PIN shown on the main screen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full text-center text-3xl font-black tracking-[0.3em] rounded-2xl bg-[#090514] border border-purple-500/35 px-4 py-4 text-cyan-300 placeholder:text-purple-500/30 focus:outline-none focus:border-cyan-400"
          />

          <button
            type="submit"
            disabled={pin.length < 4}
            className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
