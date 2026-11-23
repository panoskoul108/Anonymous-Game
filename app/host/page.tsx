"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Plus, Tv, Users, LogOut } from "lucide-react";

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function HostHomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/host/login");
        return;
      }
      setUserId(user.id);

      const { data: myRooms } = await supabase
        .from("rooms")
        .select("*")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (myRooms) setRooms(myRooms);
    };
    init();
  }, [router]);

  const handleCreateRoom = async () => {
    if (!userId) return;
    setCreating(true);
    setErrorMsg(null);

    const pin = generatePin();

    const { data: newRoom, error: roomError } = await supabase
      .from("rooms")
      .insert({
        pin,
        host_id: userId,
        status: "lobby",
      })
      .select()
      .single();

    if (roomError || !newRoom) {
      setErrorMsg(roomError?.message || "Αποτυχία δημιουργίας δωματίου");
      setCreating(false);
      return;
    }

    // Αντιγραφή των 18 global ερωτήσεων (room_id IS NULL) στο νέο δωμάτιο
    const { data: globalQuestions } = await supabase
      .from("questions")
      .select("category, text")
      .is("room_id", null);

    if (globalQuestions && globalQuestions.length > 0) {
      const roomQuestions = globalQuestions.map((q) => ({
        room_id: newRoom.id,
        category: q.category,
        text: q.text,
        is_used: false,
      }));
      await supabase.from("questions").insert(roomQuestions);
    }

    setCreating(false);
    router.push(`/host/${newRoom.pin}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/host/login");
  };

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-5 mb-8">
        <div>
          <span className="text-xs uppercase tracking-widest text-cyan-300 font-semibold">
            Host Console
          </span>
          <h1 className="text-3xl font-black bg-gradient-to-r from-pink-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            ANONYMOUS REVEAL
          </h1>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-xl bg-[#130b29] border border-purple-500/30 px-4 py-2 text-xs text-purple-200 hover:border-rose-400/50 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Αποσύνδεση
        </button>
      </div>

      <div className="rounded-3xl bg-[#130b29] border border-fuchsia-500/30 p-7 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Νέο Δωμάτιο Cabin Trip</h2>
          <p className="text-sm text-purple-200/70 mt-1">
            Δημιουργεί μοναδικό PIN, QR link και φορτώνει τις 18 έτοιμες ερωτήσεις.
          </p>
        </div>
        <button
          onClick={handleCreateRoom}
          disabled={creating || !userId}
          className="rounded-2xl px-6 py-4 font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 hover:opacity-95 transition disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          {creating ? "Δημιουργία..." : "Δημιουργία Δωματίου"}
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-4 text-sm text-rose-200 mb-6">
          {errorMsg}
        </div>
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-300/70 mb-3">
        Πρόσφατα Δωμάτια
      </h3>
      <div className="grid gap-3">
        {rooms.length === 0 ? (
          <div className="rounded-2xl bg-[#130b29]/60 border border-purple-500/20 p-6 text-sm text-purple-300/60">
            Δεν έχεις δημιουργήσει ακόμα κάποιο δωμάτιο.
          </div>
        ) : (
          rooms.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl bg-[#130b29] border border-purple-500/25 p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl font-black tracking-widest text-cyan-300">
                  {r.pin}
                </span>
                <span className="text-xs uppercase px-2.5 py-1 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                  {r.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/host/${r.pin}`)}
                  className="rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/40 px-4 py-2 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => window.open(`/screen/${r.pin}`, "_blank")}
                  className="rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 px-4 py-2 text-xs font-semibold text-cyan-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Tv className="w-4 h-4" />
                  Big Screen
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
