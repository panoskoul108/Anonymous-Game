"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Lock, Sparkles } from "lucide-react";

export default function HostLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    router.push("/host");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_50%)]">
      <div className="w-full max-w-md rounded-3xl bg-[#130b29]/90 border border-fuchsia-500/30 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-300 mb-3">
          <Sparkles className="w-4 h-4 text-pink-400" />
          Host Control Access
        </div>
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
          ANONYMOUS REVEAL
        </h1>
        <p className="text-sm text-purple-200/70 mt-1 mb-6">
          Sign in as Host to create a room and control the game.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-purple-200/80 mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="host@example.com"
              className="w-full rounded-xl bg-[#090514] border border-purple-500/30 px-4 py-3 text-sm text-white placeholder:text-purple-400/40 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-purple-200/80 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-[#090514] border border-purple-500/30 px-4 py-3 text-sm text-white placeholder:text-purple-400/40 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-2.5 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl py-3.5 px-4 font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            {loading ? "Signing in..." : "Host Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
