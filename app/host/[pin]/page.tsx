"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Play,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Users,
  BookOpen,
  Lightbulb,
  Plus,
  Trash2,
  Tv,
  Sparkles,
  UserCheck,
} from "lucide-react";

type TabType = "round" | "library" | "suggestions" | "players";

export default function HostDashboardPage() {
  const params = useParams<{ pin: string }>();
  const router = useRouter();
  const pin = params.pin;

  const [activeTab, setActiveTab] = useState<TabType>("round");
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<any>(null);
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);

  // Round setup state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [showAnswersOnScreen, setShowAnswersOnScreen] = useState<boolean>(false);

  // Library & new question state
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState<"flirting" | "spicy" | "funny">("funny");

  const playerMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  const currentQuestion = useMemo(() => {
    if (!currentRound?.question_id) return null;
    return questions.find((q) => q.id === currentRound.question_id) || null;
  }, [currentRound, questions]);

  const activeAnswer = useMemo(() => {
    if (!currentRound?.active_answer_id) return answers[0] || null;
    return answers.find((a) => a.id === currentRound.active_answer_id) || answers[0] || null;
  }, [currentRound, answers]);

  const loadAnswersForRound = useCallback(async (roundId: string | null) => {
    if (!roundId) {
      setAnswers([]);
      return;
    }
    const { data } = await supabase
      .from("answers")
      .select("*")
      .eq("round_id", roundId)
      .order("created_at", { ascending: true });
    setAnswers(data || []);
  }, []);

  const loadRoomData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/host/login");
      return;
    }

    const { data: roomData, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("pin", pin)
      .single();

    if (error || !roomData) {
      router.replace("/host");
      return;
    }

    if (roomData.host_id !== user.id) {
      router.replace("/host");
      return;
    }

    setRoom(roomData);

    const [playersRes, questionsRes, suggestionsRes] = await Promise.all([
      supabase.from("players").select("*").eq("room_id", roomData.id).order("created_at", { ascending: true }),
      supabase.from("questions").select("*").eq("room_id", roomData.id).order("created_at", { ascending: true }),
      supabase.from("question_suggestions").select("*").eq("room_id", roomData.id).order("created_at", { ascending: false }),
    ]);

    setPlayers(playersRes.data || []);
    setQuestions(questionsRes.data || []);
    setSuggestions(suggestionsRes.data || []);

    if (questionsRes.data && questionsRes.data.length > 0 && !selectedQuestionId) {
      const firstUnused = questionsRes.data.find((q: any) => !q.is_used) || questionsRes.data[0];
      setSelectedQuestionId(firstUnused.id);
    }

    if (roomData.current_round_id) {
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roomData.current_round_id)
        .single();
      setCurrentRound(roundData);
      await loadAnswersForRound(roomData.current_round_id);
    } else {
      setCurrentRound(null);
      setAnswers([]);
    }

    setLoading(false);
  }, [pin, router, selectedQuestionId, loadAnswersForRound]);

  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  // Realtime subscriptions για παίκτες, απαντήσεις, προτάσεις και γύρους
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`host-room-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` }, () => {
        loadRoomData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${room.id}` }, () => {
        if (room.current_round_id) loadAnswersForRound(room.current_round_id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "question_suggestions", filter: `room_id=eq.${room.id}` }, () => {
        loadRoomData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, () => {
        loadRoomData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, room?.current_round_id, loadRoomData, loadAnswersForRound]);

  const broadcastEvent = async (event: string, payload: Record<string, any> = {}) => {
    if (!pin) return;
    const ch = supabase.channel(`game:${pin}`);
    await ch.subscribe();
    await ch.send({
      type: "broadcast",
      event,
      payload,
    });
    supabase.removeChannel(ch);
  };

  const handleStartRound = async () => {
    if (!room || !selectedQuestionId) return;
    if (targetMode === "selected" && selectedPlayerIds.length === 0) {
      alert("Επίλεξε τουλάχιστον έναν παίκτη ή διάλεξε 'Όλοι'.");
      return;
    }

    const { data: newRound, error } = await supabase
      .from("rounds")
      .insert({
        room_id: room.id,
        question_id: selectedQuestionId,
        target_mode: targetMode,
        target_player_ids: targetMode === "selected" ? selectedPlayerIds : [],
      })
      .select()
      .single();

    if (error || !newRound) return;

    await supabase
      .from("rooms")
      .update({
        status: "answering",
        current_round_id: newRound.id,
      })
      .eq("id", room.id);

    await supabase
      .from("questions")
      .update({ is_used: true })
      .eq("id", selectedQuestionId);

    setShowAnswersOnScreen(false);
    await broadcastEvent("round_started", { roundId: newRound.id });
    await loadRoomData();
  };

  const handleToggleAnswersVisibility = async (visible: boolean) => {
    if (!room) return;
    setShowAnswersOnScreen(visible);
    const nextStatus = visible ? "discussing" : "answering";

    await supabase
      .from("rooms")
      .update({ status: nextStatus })
      .eq("id", room.id);

    const firstId = answers[0]?.id || null;
    if (visible && firstId && currentRound) {
      await supabase
        .from("rounds")
        .update({ active_answer_id: firstId })
        .eq("id", currentRound.id);
    }

    await broadcastEvent("answers_visibility", { visible, activeAnswerId: firstId });
    await loadRoomData();
  };

  const handleSelectActiveAnswer = async (answerId: string) => {
    if (!currentRound) return;
    await supabase
      .from("rounds")
      .update({ active_answer_id: answerId })
      .eq("id", currentRound.id);

    await broadcastEvent("active_answer_changed", { answerId });
    await loadRoomData();
  };

  // Φυσικό παιχνίδι 50-50: Correct -> Reveal Name, Wrong -> Keep Anonymous
  const handle5050Result = async (answerId: string, isCorrect: boolean) => {
    const nextStatus = isCorrect ? "revealed_correct" : "kept_anonymous";
    await supabase
      .from("answers")
      .update({ reveal_status: nextStatus })
      .eq("id", answerId);

    if (room) {
      await supabase
        .from("rooms")
        .update({ status: "revealed" })
        .eq("id", room.id);
    }

    await broadcastEvent("reveal_result", { answerId, isCorrect });
    await loadRoomData();
  };

  const handleReturnToLobby = async () => {
    if (!room) return;
    await supabase
      .from("rooms")
      .update({ status: "lobby", current_round_id: null })
      .eq("id", room.id);
    setShowAnswersOnScreen(false);
    await broadcastEvent("back_to_lobby", {});
    await loadRoomData();
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !newQuestionText.trim()) return;
    await supabase.from("questions").insert({
      room_id: room.id,
      category: newQuestionCategory,
      text: newQuestionText.trim(),
      is_used: false,
    });
    setNewQuestionText("");
    await loadRoomData();
  };

  const handleDeleteQuestion = async (id: string) => {
    await supabase.from("questions").delete().eq("id", id);
    await loadRoomData();
  };

  const handleApproveSuggestion = async (suggestion: any) => {
    if (!room) return;
    await supabase.from("questions").insert({
      room_id: room.id,
      category: suggestion.category,
      text: suggestion.text,
      is_used: false,
    });
    await supabase
      .from("question_suggestions")
      .update({ status: "approved" })
      .eq("id", suggestion.id);
    await loadRoomData();
  };

  const handleRejectSuggestion = async (id: string) => {
    await supabase
      .from("question_suggestions")
      .update({ status: "rejected" })
      .eq("id", id);
    await loadRoomData();
  };

  const handleRemovePlayer = async (playerId: string) => {
    await supabase.from("players").delete().eq("id", playerId);
    await loadRoomData();
  };

  const expectedRespondersCount = useMemo(() => {
    if (!currentRound) return players.length;
    return currentRound.target_mode === "selected"
      ? currentRound.target_player_ids.length
      : players.length;
  }, [currentRound, players.length]);

  const pendingSuggestionsCount = suggestions.filter((s) => s.status === "pending").length;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-300">Φόρτωση Host Dashboard...</div>;
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-500/20 pb-5 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-fuchsia-400 font-bold">
              Host Dashboard
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              PIN: <span className="text-cyan-300 tracking-widest">{room?.pin}</span>
            </h1>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-bold uppercase bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40">
            {room?.status}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-purple-200/80 bg-[#130b29] border border-purple-500/25 px-3 py-2 rounded-xl">
            Παίκτες: <strong>{players.length}</strong>
          </span>
          <button
            onClick={() => window.open(`/screen/${room?.pin}`, "_blank")}
            className="rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 px-4 py-2 text-xs font-bold text-cyan-200 flex items-center gap-2 cursor-pointer"
          >
            <Tv className="w-4 h-4" />
            Άνοιγμα Big Screen
          </button>
          <button
            onClick={handleReturnToLobby}
            className="rounded-xl bg-[#130b29] hover:bg-purple-900/40 border border-purple-500/30 px-3.5 py-2 text-xs font-semibold text-purple-200 cursor-pointer"
          >
            Lobby
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab("round")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            activeTab === "round"
              ? "bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 text-slate-950"
              : "bg-[#130b29] text-purple-200 border border-purple-500/25"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Round & 50-50
        </button>

        <button
          onClick={() => setActiveTab("library")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            activeTab === "library"
              ? "bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 text-slate-950"
              : "bg-[#130b29] text-purple-200 border border-purple-500/25"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Library ({questions.length})
        </button>

        <button
          onClick={() => setActiveTab("suggestions")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            activeTab === "suggestions"
              ? "bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 text-slate-950"
              : "bg-[#130b29] text-purple-200 border border-purple-500/25"
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          Suggestions {pendingSuggestionsCount > 0 && `(${pendingSuggestionsCount})`}
        </button>

        <button
          onClick={() => setActiveTab("players")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            activeTab === "players"
              ? "bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 text-slate-950"
              : "bg-[#130b29] text-purple-200 border border-purple-500/25"
          }`}
        >
          <Users className="w-4 h-4" />
          Players ({players.length})
        </button>
      </div>

      {/* TAB 1: ROUND & 50-50 */}
      {activeTab === "round" && (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Setup New Round */}
          <div className="lg:col-span-5 rounded-3xl bg-[#130b29] border border-fuchsia-500/30 p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">Νέος Γύρος</h2>

            <div>
              <label className="block text-xs font-semibold text-purple-200/80 mb-2">
                Επιλογή Ερώτησης
              </label>
              <select
                value={selectedQuestionId}
                onChange={(e) => setSelectedQuestionId(e.target.value)}
                className="w-full rounded-xl bg-[#090514] border border-purple-500/30 px-3.5 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.is_used ? "[USED] " : ""}[{q.category.toUpperCase()}] {q.text}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-200/80 mb-2">
                Ποιοι απαντούν;
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetMode("all")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                    targetMode === "all"
                      ? "bg-cyan-400/20 border-cyan-400 text-cyan-200"
                      : "bg-[#090514] border-purple-500/25 text-purple-300"
                  }`}
                >
                  Όλοι ({players.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode("selected")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                    targetMode === "selected"
                      ? "bg-pink-500/20 border-pink-400 text-pink-200"
                      : "bg-[#090514] border-purple-500/25 text-purple-300"
                  }`}
                >
                  Επιλεγμένοι ({selectedPlayerIds.length})
                </button>
              </div>
            </div>

            {targetMode === "selected" && (
              <div className="max-h-48 overflow-y-auto rounded-2xl bg-[#090514] border border-purple-500/25 p-3 space-y-1.5">
                {players.map((p) => {
                  const checked = selectedPlayerIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-purple-950/50 cursor-pointer text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span>{p.avatar}</span>
                        <span>{p.nickname}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPlayerIds((prev) => [...prev, p.id]);
                          } else {
                            setSelectedPlayerIds((prev) => prev.filter((id) => id !== p.id));
                          }
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleStartRound}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Έναρξη Γύρου
            </button>
          </div>

          {/* Right Column: Live Answers & 50-50 Controls */}
          <div className="lg:col-span-7 rounded-3xl bg-[#130b29] border border-purple-500/30 p-6 space-y-5">
            {!currentRound ? (
              <div className="py-16 text-center text-purple-300/60 text-sm">
                Δεν υπάρχει ενεργός γύρος. Επίλεξε ερώτηση και πάτησε «Έναρξη Γύρου».
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-purple-500/20 pb-4">
                  <div>
                    <span className="text-xs uppercase font-bold text-cyan-300">
                      Τρέχουσα Ερώτηση
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {currentQuestion?.text}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-purple-300/70 block">Απαντήσεις</span>
                    <span className="text-2xl font-black text-lime-400">
                      {answers.length} / {expectedRespondersCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!showAnswersOnScreen ? (
                    <button
                      onClick={() => handleToggleAnswersVisibility(true)}
                      className="rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs px-4 py-2.5 flex items-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      Εμφάνιση Απαντήσεων στο Big Screen
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleAnswersVisibility(false)}
                      className="rounded-xl bg-purple-900/60 border border-purple-400/30 text-purple-100 font-bold text-xs px-4 py-2.5 flex items-center gap-2 cursor-pointer"
                    >
                      <EyeOff className="w-4 h-4" />
                      Απόκρυψη Απαντήσεων
                    </button>
                  )}
                </div>

                {/* Answers List (Host sees author identity privately) */}
                <div className="space-y-3">
                  {answers.length === 0 ? (
                    <div className="rounded-2xl bg-[#090514]/70 border border-purple-500/20 p-6 text-center text-sm text-purple-300/60">
                      Αναμονή για απαντήσεις από τα κινητά...
                    </div>
                  ) : (
                    answers.map((ans, idx) => {
                      const author = playerMap[ans.player_id];
                      const isSelectedCard = activeAnswer?.id === ans.id;

                      return (
                        <div
                          key={ans.id}
                          onClick={() => handleSelectActiveAnswer(ans.id)}
                          className={`rounded-2xl p-4 border transition cursor-pointer ${
                            isSelectedCard
                              ? "bg-[#1c103b] border-cyan-400 shadow-lg"
                              : "bg-[#090514]/80 border-purple-500/20 hover:border-purple-400/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-bold uppercase text-purple-300/70">
                              Απάντηση #{idx + 1} {isSelectedCard && "• (Στο Big Screen)"}
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">
                              Συντάκτης (Host only): {author?.avatar} {author?.nickname || "Άγνωστος"}
                            </span>
                          </div>

                          <p className="text-base font-medium text-white mb-3">
                            «{ans.content}»
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-500/15">
                            <span className="text-xs text-purple-300/70">
                              50-50 Μπαλάκι:{" "}
                              <strong className={ans.reveal_status === "revealed_correct" ? "text-lime-400" : "text-amber-300"}>
                                {ans.reveal_status === "revealed_correct"
                                  ? "REVEALED (Correct)"
                                  : ans.reveal_status === "kept_anonymous"
                                  ? "KEPT ANONYMOUS (Wrong)"
                                  : "Pending"}
                              </strong>
                            </span>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handle5050Result(ans.id, true)}
                                className="rounded-xl bg-lime-400/20 hover:bg-lime-400/30 border border-lime-400/50 text-lime-300 px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Correct (Reveal)
                              </button>
                              <button
                                onClick={() => handle5050Result(ans.id, false)}
                                className="rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-300 px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Wrong (Anonymous)
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIBRARY */}
      {activeTab === "library" && (
        <div className="rounded-3xl bg-[#130b29] border border-purple-500/30 p-6 space-y-6">
          <form onSubmit={handleAddQuestion} className="flex flex-col sm:flex-row gap-3">
            <select
              value={newQuestionCategory}
              onChange={(e) => setNewQuestionCategory(e.target.value as any)}
              className="rounded-xl bg-[#090514] border border-purple-500/30 px-3.5 py-3 text-sm text-white"
            >
              <option value="flirting">😏 Flirting & Attraction</option>
              <option value="spicy">🌶️ Spicy & Dating</option>
              <option value="funny">😂 Funny & Unexpected</option>
            </select>
            <input
              type="text"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="Γράψε νέα ερώτηση για το δωμάτιο..."
              className="flex-1 rounded-xl bg-[#090514] border border-purple-500/30 px-4 py-3 text-sm text-white"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-pink-500 to-cyan-400 text-slate-950 font-bold text-sm px-5 py-3 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Προσθήκη
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {["all", "flirting", "spicy", "funny"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-fuchsia-500 text-white"
                    : "bg-[#090514] text-purple-300 border border-purple-500/20"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-2.5">
            {questions
              .filter((q) => categoryFilter === "all" || q.category === categoryFilter)
              .map((q) => (
                <div
                  key={q.id}
                  className="rounded-2xl bg-[#090514]/80 border border-purple-500/20 p-4 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-purple-900/70 text-cyan-300">
                        {q.category}
                      </span>
                      {q.is_used && (
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-lime-400/15 text-lime-300">
                          Used
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white">{q.text}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedQuestionId(q.id);
                        setActiveTab("round");
                      }}
                      className="rounded-lg bg-cyan-500/15 border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 cursor-pointer"
                    >
                      Επιλογή
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="rounded-lg bg-rose-500/15 border border-rose-400/30 p-2 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUGGESTIONS */}
      {activeTab === "suggestions" && (
        <div className="rounded-3xl bg-[#130b29] border border-purple-500/30 p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Ανώνυμες Προτάσεις Παικτών</h2>
          {suggestions.length === 0 ? (
            <p className="text-sm text-purple-300/60">Δεν υπάρχουν προτάσεις ερωτήσεων ακόμα.</p>
          ) : (
            suggestions.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl bg-[#090514] border border-purple-500/25 p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 mr-2">
                    {s.category}
                  </span>
                  <span className="text-[11px] font-bold uppercase text-purple-300/70">
                    Status: {s.status}
                  </span>
                  <p className="text-sm text-white mt-1.5">{s.text}</p>
                </div>
                {s.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveSuggestion(s)}
                      className="rounded-xl bg-lime-400/20 border border-lime-400/50 text-lime-300 px-3.5 py-2 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      Έγκριση στη Βιβλιοθήκη
                    </button>
                    <button
                      onClick={() => handleRejectSuggestion(s.id)}
                      className="rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-300 px-3.5 py-2 text-xs font-bold cursor-pointer"
                    >
                      Απόρριψη
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: PLAYERS */}
      {activeTab === "players" && (
        <div className="rounded-3xl bg-[#130b29] border border-purple-500/30 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Συμμετέχοντες ({players.length})</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {players.map((p) => {
              const hasAnswered = answers.some((a) => a.player_id === p.id);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[#090514] border border-purple-500/25 p-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.avatar}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{p.nickname}</div>
                      <div className="text-[11px] text-purple-300/70">
                        {currentRound
                          ? hasAnswered
                            ? "✅ Απάντησε"
                            : "⏳ Περιμένει"
                          : "Συνδεδεμένος"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePlayer(p.id)}
                    className="text-rose-400/70 hover:text-rose-300 p-1.5 cursor-pointer"
                    title="Απομάκρυνση"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
