"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Send, Lightbulb, CheckCircle2, Clock, Sparkles, X } from "lucide-react";

const AVATARS = ["🦊", "🐺", "🦁", "🐼", "🦄", "🐙", "🔥", "⚡", "🎭", "🍸", "🪩", "👾"];

export default function PlayerRoomPage() {
  const params = useParams<{ pin: string }>();
  const pin = params.pin;

  const [room, setRoom] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [round, setRound] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);

  // Join form
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Answer state
  const [answerText, setAnswerText] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [hasSubmittedCurrentRound, setHasSubmittedCurrentRound] = useState(false);

  // Suggest a Question modal
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestCategory, setSuggestCategory] = useState<"flirting" | "spicy" | "funny">("funny");
  const [suggestText, setSuggestText] = useState("");
  const [suggestSent, setSuggestSent] = useState(false);

  const storageKey = useMemo(() => `anon_reveal_player_${pin}`, [pin]);

  const loadGameState = useCallback(async (roomData: any, currentPlayer: any) => {
    if (!roomData) return;

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

      if (currentPlayer?.id && roundData?.id) {
        const { data: existingAns } = await supabase
          .from("public_answers")
          .select("id")
          .eq("round_id", roundData.id)
          .eq("player_id", currentPlayer.id)
          .maybeSingle();

        // Σημείωση: το public_answers δείχνει player_id μόνο αν revealed_correct,
        // οπότε κρατάμε και τοπικό flag ανά roundId στο localStorage
        const localFlag = localStorage.getItem(`answered_round_${roundData.id}_${currentPlayer.id}`);
        setHasSubmittedCurrentRound(Boolean(existingAns || localFlag));
      } else {
        setHasSubmittedCurrentRound(false);
      }
    } else {
      setRound(null);
      setQuestion(null);
      setHasSubmittedCurrentRound(false);
      setAnswerText("");
    }
  }, []);

  const initRoomAndSession = useCallback(async () => {
    const { data: roomData, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("pin", pin)
      .single();

    if (error || !roomData) {
      setErrorMsg("Δεν βρέθηκε δωμάτιο με αυτό το PIN.");
      return;
    }

    setRoom(roomData);

    const saved = localStorage.getItem(storageKey);
    let restoredPlayer = null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.playerId && parsed?.sessionToken) {
          const { data: pData } = await supabase
            .from("players")
            .select("*")
            .eq("id", parsed.playerId)
            .eq("session_token", parsed.sessionToken)
            .maybeSingle();
          if (pData) {
            restoredPlayer = pData;
            setPlayer(pData);
          }
        }
      } catch {
        // ignore invalid json
      }
    }

    await loadGameState(roomData, restoredPlayer);
  }, [pin, storageKey, loadGameState]);

  useEffect(() => {
    initRoomAndSession();
  }, [initRoomAndSession]);

  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`player-room-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, async (payload: any) => {
        const updatedRoom = payload.new || room;
        setRoom(updatedRoom);
        if (updatedRoom.status === "lobby") {
          setHasSubmittedCurrentRound(false);
          setAnswerText("");
        }
        await loadGameState(updatedRoom, player);
      })
      .on("broadcast", { event: "*" }, async () => {
        const { data: freshRoom } = await supabase.from("rooms").select("*").eq("id", room.id).single();
        if (freshRoom) {
          setRoom(freshRoom);
          await loadGameState(freshRoom, player);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, player, loadGameState]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !nickname.trim()) return;
    setJoining(true);
    setErrorMsg(null);

    const sessionToken = crypto.randomUUID();

    const { data: newPlayer, error } = await supabase
      .from("players")
      .insert({
        room_id: room.id,
        nickname: nickname.trim(),
        avatar,
        session_token: sessionToken,
        is_online: true,
      })
      .select()
      .single();

    setJoining(false);

    if (error || !newPlayer) {
      setErrorMsg(error?.message || "Αποτυχία σύνδεσης στο δωμάτιο");
      return;
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify({ playerId: newPlayer.id, sessionToken })
    );
    setPlayer(newPlayer);
    await loadGameState(room, newPlayer);
  };

  const isSelectedForRound = useMemo(() => {
    if (!round || !player) return false;
    if (round.target_mode === "all") return true;
    return Array.isArray(round.target_player_ids) && round.target_player_ids.includes(player.id);
  }, [round, player]);

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !round || !player || !answerText.trim()) return;

    const saved = localStorage.getItem(storageKey);
    const sessionToken = saved ? JSON.parse(saved)?.sessionToken : "";

    setSubmittingAnswer(true);
    setErrorMsg(null);

    const { error } = await supabase.rpc("submit_anonymous_answer", {
      p_room_id: room.id,
      p_round_id: round.id,
      p_player_id: player.id,
      p_session_token: sessionToken,
      p_content: answerText.trim(),
    });

    setSubmittingAnswer(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    localStorage.setItem(`answered_round_${round.id}_${player.id}`, "1");
    setHasSubmittedCurrentRound(true);
    setAnswerText("");
  };

  const handleSuggestQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !suggestText.trim()) return;

    const { error } = await supabase.from("question_suggestions").insert({
      room_id: room.id,
      category: suggestCategory,
      text: suggestText.trim(),
      status: "pending",
    });

    if (!error) {
      setSuggestSent(true);
      setSuggestText("");
      setTimeout(() => {
        setSuggestSent(false);
        setShowSuggestModal(false);
      }, 1200);
    }
  };

  return (
    <main className="min-h-screen p-4 flex flex-col justify-between max-w-md mx-auto bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_55%)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between py-3 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-pink-400" />
          <span className="font-black text-sm tracking-wide text-white">ANONYMOUS REVEAL</span>
        </div>

        <div className="flex items-center gap-2">
          {room && (
            <button
              onClick={() => setShowSuggestModal(true)}
              className="rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/40 px-3 py-1.5 text-xs font-bold text-fuchsia-200 flex items-center gap-1 cursor-pointer"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
              Suggest
            </button>
          )}
          <span className="rounded-xl bg-[#130b29] border border-cyan-400/30 px-2.5 py-1.5 text-xs font-black text-cyan-300">
            PIN {pin}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="my-auto py-6">
        {errorMsg && !player && (
          <div className="rounded-2xl bg-rose-500/15 border border-rose-500/40 p-4 text-sm text-rose-200 mb-4">
            {errorMsg}
          </div>
        )}

        {/* Step 1: Join Room (Nickname + Avatar) */}
        {room && !player && (
          <form
            onSubmit={handleJoin}
            className="rounded-3xl bg-[#130b29] border border-fuchsia-500/35 p-6 space-y-5 shadow-2xl"
          >
            <div>
              <h1 className="text-2xl font-black text-white">Μπες στο Δωμάτιο</h1>
              <p className="text-xs text-purple-200/75 mt-1">
                Διάλεξε nickname και avatar για το παιχνίδι.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-200/80 mb-1.5">
                Nickname
              </label>
              <input
                type="text"
                maxLength={20}
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Το όνομά σου / παρατσούκλι"
                className="w-full rounded-xl bg-[#090514] border border-purple-500/30 px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-200/80 mb-2">
                Avatar
              </label>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`h-11 rounded-xl text-xl flex items-center justify-center border cursor-pointer transition ${
                      avatar === av
                        ? "bg-cyan-400/20 border-cyan-400 scale-105"
                        : "bg-[#090514] border-purple-500/20"
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={joining}
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 cursor-pointer"
            >
              {joining ? "Σύνδεση..." : "Είσοδος στο Παιχνίδι"}
            </button>
          </form>
        )}

        {/* Step 2: Connected Player */}
        {room && player && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#130b29] border border-purple-500/25 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{player.avatar}</span>
                <div>
                  <div className="text-sm font-bold text-white">{player.nickname}</div>
                  <div className="text-[11px] text-lime-400">● Συνδεδεμένος</div>
                </div>
              </div>
              <span className="text-xs uppercase font-bold text-cyan-300">
                {room.status}
              </span>
            </div>

            {/* Active Answering Phase */}
            {room.status === "answering" && round ? (
              <div className="rounded-3xl bg-[#130b29] border border-fuchsia-500/35 p-6 space-y-5 shadow-2xl">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400">
                    {question?.category}
                  </span>
                  <h2 className="text-xl font-black text-white mt-1 leading-snug">
                    {question?.text}
                  </h2>
                </div>

                {!isSelectedForRound ? (
                  <div className="rounded-2xl bg-[#090514] border border-purple-500/25 p-5 text-center space-y-2">
                    <Clock className="w-6 h-6 text-cyan-300 mx-auto" />
                    <p className="text-sm font-semibold text-purple-200">
                      Σε αυτόν τον γύρο απαντούν επιλεγμένοι παίκτες.
                    </p>
                    <p className="text-xs text-purple-300/60">
                      Κοίτα την κεντρική οθόνη και ετοιμάσου για μαντεψιές!
                    </p>
                  </div>
                ) : hasSubmittedCurrentRound ? (
                  <div className="rounded-2xl bg-lime-400/15 border border-lime-400/40 p-5 text-center space-y-2">
                    <CheckCircle2 className="w-7 h-7 text-lime-400 mx-auto" />
                    <p className="text-sm font-bold text-lime-200">
                      Η απάντησή σου στάλθηκε ανώνυμα!
                    </p>
                    <p className="text-xs text-purple-200/70">
                      Περίμενε να ολοκληρωθούν οι υπόλοιπες απαντήσεις.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitAnswer} className="space-y-4">
                    <textarea
                      rows={4}
                      required
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Γράψε την απάντησή σου μυστικά..."
                      className="w-full rounded-2xl bg-[#090514] border border-purple-500/35 p-4 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                    {errorMsg && (
                      <p className="text-xs text-rose-300">{errorMsg}</p>
                    )}
                    <button
                      type="submit"
                      disabled={submittingAnswer}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      {submittingAnswer ? "Αποστολή..." : "Submit Answer"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="rounded-3xl bg-[#130b29] border border-purple-500/30 p-7 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-cyan-300 mx-auto" />
                <h2 className="text-lg font-bold text-white">
                  {room.status === "lobby"
                    ? "Είσαι μέσα στο Lobby!"
                    : "Συζήτηση & Reveal στη μεγάλη οθόνη"}
                </h2>
                <p className="text-xs text-purple-200/75 leading-relaxed">
                  Παρακολούθησε το Big Screen, συζήτησε με την παρέα και ετοιμάσου για το 50-50 μπαλάκι.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-3 border-t border-purple-500/15 text-center text-[11px] text-purple-300/60">
        Anonymous Answers • Real-Time Sync
      </footer>

      {/* Suggest a Question Modal */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#130b29] border border-fuchsia-500/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-300" />
                Suggest a Question
              </h3>
              <button
                onClick={() => setShowSuggestModal(false)}
                className="text-purple-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {suggestSent ? (
              <div className="rounded-2xl bg-lime-400/15 border border-lime-400/40 p-4 text-sm text-lime-200 text-center">
                Η πρότασή σου στάλθηκε ανώνυμα στον Host!
              </div>
            ) : (
              <form onSubmit={handleSuggestQuestion} className="space-y-4">
                <div>
                  <label className="block text-xs text-purple-200/80 mb-1.5">Κατηγορία</label>
                  <select
                    value={suggestCategory}
                    onChange={(e) => setSuggestCategory(e.target.value as any)}
                    className="w-full rounded-xl bg-[#090514] border border-purple-500/30 px-3.5 py-2.5 text-sm text-white"
                  >
                    <option value="flirting">😏 Flirting & Attraction</option>
                    <option value="spicy">🌶️ Spicy & Dating</option>
                    <option value="funny">😂 Funny & Unexpected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-purple-200/80 mb-1.5">Η ερώτησή σου</label>
                  <textarea
                    rows={3}
                    required
                    value={suggestText}
                    onChange={(e) => setSuggestText(e.target.value)}
                    placeholder="Γράψε μια ερώτηση για την παρέα..."
                    className="w-full rounded-xl bg-[#090514] border border-purple-500/30 p-3 text-sm text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 to-cyan-400 cursor-pointer"
                >
                  Ανώνυμη Υποβολή
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
