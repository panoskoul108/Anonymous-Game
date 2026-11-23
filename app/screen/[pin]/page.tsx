"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles, EyeOff, CheckCircle2, Users } from "lucide-react";

export default function BigScreenPage() {
  const params = useParams<{ pin: string }>();
  const pin = params.pin;

  const [room, setRoom] = useState<any>(null);
  const [round, setRound] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [joinUrl, setJoinUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && pin) {
      setJoinUrl(`${window.location.origin}/play/${pin}`);
    }
  }, [pin]);

  const playerMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  const loadScreenData = useCallback(async () => {
    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("pin", pin)
      .single();

    if (!roomData) return;
    setRoom(roomData);

    const { data: playersData } = await supabase
      .from("players")
      .select("id, nickname, avatar")
      .eq("room_id", roomData.id)
      .order("created_at", { ascending: true });
    setPlayers(playersData || []);

    if (roomData.current_round_id) {
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roomData.current_round_id)
        .single();
      setRound(roundData || null);

      if (roundData?.question_id) {
        const { data: qData } = await supabase
          .from("questions")
          .select("*")
          .eq("id", roundData.question_id)
          .single();
        setQuestion(qData || null);
      }

      // Διαβάζουμε ΜΟΝΟ από το public_answers view για απόλυτη ασφάλεια ανωνυμίας
      const { data: ansData } = await supabase
        .from("public_answers")
        .select("*")
        .eq("round_id", roomData.current_round_id)
        .order("created_at", { ascending: true });
      setAnswers(ansData || []);
    } else {
      setRound(null);
      setQuestion(null);
      setAnswers([]);
    }
  }, [pin]);

  useEffect(() => {
    loadScreenData();
  }, [loadScreenData]);

  // Realtime sync + Broadcast channel
  useEffect(() => {
    if (!room?.id) return;

    const dbChannel = supabase
      .channel(`screen-db-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, () => {
        loadScreenData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` }, () => {
        loadScreenData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` }, () => {
        loadScreenData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "public_answers", filter: `room_id=eq.${room.id}` }, () => {
        loadScreenData();
      })
      .subscribe();

    const broadcastChannel = supabase
      .channel(`game:${pin}`)
      .on("broadcast", { event: "reveal_result" }, (msg: any) => {
        if (msg?.payload?.isCorrect) {
          confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.6 },
          });
        }
        loadScreenData();
      })
      .on("broadcast", { event: "*" }, () => {
        loadScreenData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [room?.id, pin, loadScreenData]);

  const expectedCount = useMemo(() => {
    if (!round) return players.length;
    return round.target_mode === "selected" ? round.target_player_ids.length : players.length;
  }, [round, players.length]);

  const activeAnswer = useMemo(() => {
    if (answers.length === 0) return null;
    if (round?.active_answer_id) {
      return answers.find((a) => a.id === round.active_answer_id) || answers[0];
    }
    return answers[0];
  }, [answers, round]);

  const status = room?.status || "lobby";

  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col justify-between bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_55%),radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.14),_transparent_50%)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-purple-500/20 pb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-pink-400" />
          <span className="text-xl md:text-2xl font-black tracking-wider bg-gradient-to-r from-pink-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            ANONYMOUS REVEAL
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-purple-200">
            <Users className="w-5 h-5 text-cyan-300" />
            <span className="text-lg font-bold">{players.length}</span>
          </div>
          <div className="rounded-2xl bg-[#130b29] border border-cyan-400/40 px-4 py-1.5">
            <span className="text-xs uppercase text-cyan-300/80 mr-2 font-semibold">PIN</span>
            <span className="text-2xl font-black tracking-widest text-white">{pin}</span>
          </div>
        </div>
      </header>

      {/* SCREEN 1: LOBBY */}
      {status === "lobby" && (
        <section className="my-auto py-8 grid md:grid-cols-12 gap-8 items-center max-w-5xl mx-auto w-full">
          <div className="md:col-span-7 space-y-5">
            <p className="text-sm uppercase tracking-widest text-cyan-300 font-bold">
              Answer in secret. Guess who wrote it. Reveal the truth.
            </p>
            <h1 className="text-4xl md:text-6xl font-black leading-tight text-white">
              Σκάναρε & μπες στο παιχνίδι
            </h1>
            <p className="text-lg text-purple-200/80">
              Άνοιξε την κάμερα στο κινητό σου ή πήγαινε στο{" "}
              <span className="text-cyan-300 font-semibold">/play</span> και βάλε το PIN{" "}
              <span className="text-pink-400 font-black">{pin}</span>.
            </p>

            <div className="pt-3 flex flex-wrap gap-2.5">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[#130b29] border border-fuchsia-500/30 px-4 py-2 flex items-center gap-2 text-base font-bold"
                >
                  <span className="text-xl">{p.avatar}</span>
                  <span>{p.nickname}</span>
                </div>
              ))}
              {players.length === 0 && (
                <div className="text-purple-300/60 text-base">
                  Περιμένουμε τους πρώτους παίκτες...
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col items-center justify-center rounded-3xl bg-[#130b29] border border-fuchsia-500/40 p-8 shadow-2xl">
            <div className="bg-white p-4 rounded-2xl">
              {joinUrl && <QRCodeSVG value={joinUrl} size={210} />}
            </div>
            <div className="mt-4 text-center">
              <div className="text-xs uppercase tracking-widest text-purple-300/70">Room PIN</div>
              <div className="text-4xl font-black tracking-[0.25em] text-cyan-300 mt-1">
                {pin}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SCREEN 2: ANSWERING PHASE */}
      {status === "answering" && (
        <section className="my-auto py-8 max-w-4xl mx-auto w-full text-center space-y-8">
          <span className="inline-block rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest bg-pink-500/20 text-pink-300 border border-pink-400/40">
            {question?.category || "ROUND"} • SECRET ANSWERING
          </span>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black leading-tight text-white">
            {question?.text}
          </h1>

          <div className="rounded-3xl bg-[#130b29] border border-cyan-400/30 p-6 max-w-md mx-auto">
            <div className="text-sm uppercase tracking-wider text-purple-300/80 mb-1">
              Απαντήσεις που έχουν σταλεί
            </div>
            <div className="text-5xl font-black text-lime-400">
              {answers.length} <span className="text-2xl text-purple-300/60">/ {expectedCount}</span>
            </div>
          </div>
        </section>
      )}

      {/* SCREEN 3 & 4: DISCUSSING / REVEAL */}
      {(status === "discussing" || status === "revealed") && (
        <section className="my-auto py-6 max-w-5xl mx-auto w-full space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold">
              {question?.category}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              {question?.text}
            </h2>
          </div>

          <AnimatePresence mode="wait">
            {activeAnswer && (
              <motion.div
                key={activeAnswer.id + "-" + activeAnswer.reveal_status}
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -12 }}
                transition={{ duration: 0.35 }}
                className="rounded-3xl bg-[#130b29] border-2 border-fuchsia-500/40 p-8 md:p-12 text-center shadow-2xl"
              >
                <p className="text-3xl sm:text-5xl font-black text-white leading-snug mb-8">
                  «{activeAnswer.content}»
                </p>

                {activeAnswer.reveal_status === "revealed_correct" ? (
                  <div className="inline-flex items-center gap-3 rounded-2xl bg-lime-400/20 border-2 border-lime-400 px-6 py-3.5 text-lime-300">
                    <CheckCircle2 className="w-7 h-7" />
                    <span className="text-3xl">
                      {playerMap[activeAnswer.player_id]?.avatar || "🎉"}
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      {playerMap[activeAnswer.player_id]?.nickname || "Revealed!"}
                    </span>
                  </div>
                ) : activeAnswer.reveal_status === "kept_anonymous" ? (
                  <div className="inline-flex items-center gap-3 rounded-2xl bg-rose-500/20 border border-rose-400/40 px-6 py-3 text-rose-200">
                    <EyeOff className="w-6 h-6" />
                    <span className="text-xl font-bold">
                      Λανθασμένη μαντεψιά — Παραμένει ανώνυμο!
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-3 rounded-2xl bg-purple-950/80 border border-purple-400/30 px-6 py-3 text-purple-200">
                    <EyeOff className="w-6 h-6 text-pink-400" />
                    <span className="text-xl font-bold">
                      Ποιος το έγραψε; 50-50 Μπαλάκι!
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* All Anonymous Cards Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {answers.map((ans, idx) => {
              const isCurrent = activeAnswer?.id === ans.id;
              const revealedAuthor =
                ans.reveal_status === "revealed_correct" ? playerMap[ans.player_id] : null;

              return (
                <div
                  key={ans.id}
                  className={`rounded-2xl p-4 border transition ${
                    isCurrent
                      ? "bg-[#1e1142] border-cyan-400"
                      : "bg-[#130b29]/80 border-purple-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-purple-300/70">#{idx + 1}</span>
                    {revealedAuthor ? (
                      <span className="font-bold text-lime-300">
                        {revealedAuthor.avatar} {revealedAuthor.nickname}
                      </span>
                    ) : (
                      <span className="text-pink-300/80 font-semibold">Anonymous</span>
                    )}
                  </div>
                  <p className="text-sm text-white line-clamp-2">{ans.content}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="pt-4 border-t border-purple-500/15 flex items-center justify-between text-xs text-purple-300/60">
        <span>30+ Players Real-Time Multiplayer</span>
        <span>Status: {status.toUpperCase()}</span>
      </footer>
    </main>
  );
}
