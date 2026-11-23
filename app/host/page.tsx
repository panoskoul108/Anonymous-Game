"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Plus, Tv, Users, LogOut, Trash2 } from "lucide-react";

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function HostHomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRooms = async (uid: string) => {
    const { data: myRooms } = await supabase
      .from("rooms")
      .select("*")
      .eq("host_id", uid)
      .order("created_at", { ascending: false })
      .limit(10);

    if (myRooms) setRooms(myRooms);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/host/login");
        return;
      }
      setUserId(user.id);
      await loadRooms(user.id);
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
      setErrorMsg(roomError?.message || "Failed to create room");
      setCreating(false);
      return;
    }

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

  const handleDeleteRoom = async (roomId: string) => {
    if (!userId) return;
    await supabase.from("rooms").delete().eq("id", roomId);
    await loadRooms(userId);
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
          Sign Out
        </button>
      </div>

      <div className="rounded-3xl bg-[#130b29] border border-fuchsia-500/30 p-7 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">New Cabin Trip Room</h2>
          <p className="text-sm text-purple-200/70 mt-1">
            Generates a unique PIN, QR code link, and loads the 18 starter questions.
          </p>
        </div>
        <button
          onClick={handleCreateRoom}
          disabled={creating || !userId}
          className="rounded-2xl px-6 py-4 font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 hover:opacity-95 transition disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          {creating ? "Creating..." : "Create Room"}
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-4 text-sm text-rose-200 mb-6">
          {errorMsg}
        </div>
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-300/70 mb-3">
        Recent Rooms
      </h3>
      <div className="grid gap-3">
        {rooms.length === 0 ? (
          <div className="rounded-2xl bg-[#130b29]/60 border border-purple-500/20 p-6 text-sm text-purple-300/60">
            No rooms created yet.
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
                <button
                  onClick={() => handleDeleteRoom(r.id)}
                  className="rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 p-2 text-rose-300 cursor-pointer"
                  title="Delete Room"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
