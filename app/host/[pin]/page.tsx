"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
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
  Copy,
  Check,
  QrCode,
  Shuffle,
  ChevronRight,
  Pencil,
  RotateCcw,
  X,
  Lock,
  Unlock,
  SkipForward,
  Zap,
  Disc,
} from "lucide-react";

type TabType = "round" | "library" | "suggestions" | "players";

function AvatarThumb({ p, size = "md" }: { p: any; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-6 h-6 text-sm" : "w-9 h-9 text-xl";
  if (p?.avatar_url) {
    return (
      <img
        src={p.avatar_url}
        alt={p.nickname || "Player"}
        className={`${dim} rounded-full object-cover border border-cyan-400/50 shrink-0`}
      />
    );
  }
  return <span className={size === "sm" ? "text-base" : "text-2xl"}>{p?.avatar || "🦊"}</span>;
}

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

  // Quick utility states
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [isRoomLocked, setIsRoomLocked] = useState(false);

  // Spin Wheel state
  const [showWheelModal, setShowWheelModal] = useState(false);
  const [wheelMode, setWheelMode] = useState<"question" | "fifty">("question");
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wheelResultText, setWheelResultText] = useState<string | null>(null);
  const [wheelPickedQuestionId, setWheelPickedQuestionId] = useState<string | null>(null);
  const [wheelPicked5050, setWheelPicked5050] = useState<boolean | null>(null);

  // Round setup state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [quickCustomQuestion, setQuickCustomQuestion] = useState<string>("");
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [showAnswersOnScreen, setShowAnswersOnScreen] = useState<boolean>(false);

  // 50-50 Guesser & Skipped cards
  const [guesserId, setGuesserId] = useState<string>("");
  const [skippedAnswerIds, setSkippedAnswerIds] = useState<string[]>([]);

  // Library & question editing
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState<"flirting" | "spicy" | "funny">("funny");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState("");

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

  const currentQuestion = useMemo(() => {
    if (!currentRound?.question_id) return null;
    return questions.find((q) => q.id === currentRound.question_id) || null;
  }, [currentRound, questions]);

  const activeAnswerIndex = useMemo(() => {
    if (answers.length === 0) return -1;
    if (!currentRound?.active_answer_id) return 0;
    const idx = answers.findIndex((a) => a.id === currentRound.active_answer_id);
    return idx >= 0 ? idx : 0;
  }, [currentRound, answers]);

  const activeAnswer = activeAnswerIndex >= 0 ? answers[activeAnswerIndex] : null;

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

    if (error || !roomData || roomData.host_id !== user.id) {
      router.replace("/host");
      return;
    }

    setRoom(roomData);
    setShowAnswersOnScreen(roomData.status === "discussing" || roomData.status === "revealed");

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

  const openSpinWheel = (mode: "question" | "fifty") => {
    setWheelMode(mode);
    setWheelResultText(null);
    setWheelPickedQuestionId(null);
    setWheelPicked5050(null);
    setShowWheelModal(true);
  };

  const handleSpinWheel = () => {
    if (spinning) return;
    setSpinning(true);
    setWheelResultText(null);
    setWheelPickedQuestionId(null);
    setWheelPicked5050(null);

    const extraSpins = 5 * 360 + Math.floor(Math.random() * 360);
    const nextAngle = wheelAngle + extraSpins;
    setWheelAngle(nextAngle);

    setTimeout(() => {
      if (wheelMode === "question") {
        const unused = questions.filter((q) => !q.is_used);
        const pool = unused.length > 0 ? unused : questions;
        if (pool.length > 0) {
          const picked = pool[Math.floor(Math.random() * pool.length)];
          setWheelPickedQuestionId(picked.id);
          setWheelResultText(picked.text);
        }
      } else {
        const isReveal = Math.random() < 0.5;
        setWheelPicked5050(isReveal);
        setWheelResultText(isReveal ? "REVEAL IDENTITY (Correct)" : "STAY ANONYMOUS (Wrong)");
      }
      setSpinning(false);
    }, 1700);
  };

  const handleToggleRoomLock = async () => {
    const nextLocked = !isRoomLocked;
    setIsRoomLocked(nextLocked);
    await broadcastEvent("room_lock_changed", { locked: nextLocked });
  };

  const handleCopyJoinLink = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const handlePickRandomUnusedQuestion = () => {
    const unused = questions.filter((q) => !q.is_used && q.id !== selectedQuestionId);
    const pool = unused.length > 0 ? unused : questions.filter((q) => q.id !== selectedQuestionId);
    if (pool.length === 0) return;
    const randomQ = pool[Math.floor(Math.random() * pool.length)];
    setSelectedQuestionId(randomQ.id);
    setQuickCustomQuestion("");
  };

  const handlePickRandomPlayers = (count: number) => {
    if (players.length === 0) return;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setSelectedPlayerIds(shuffled.slice(0, Math.min(count, players.length)).map((p) => p.id));
  };

  const handleStartRound = async () => {
    if (!room) return;
    if (targetMode === "selected" && selectedPlayerIds.length === 0) {
      alert("Select at least one player or switch to 'Everyone'.");
      return;
    }

    let questionIdToUse = selectedQuestionId;

    if (quickCustomQuestion.trim()) {
      const { data: createdQ, error: qErr } = await supabase
        .from("questions")
        .insert({
          room_id: room.id,
          category: "funny",
          text: quickCustomQuestion.trim(),
          is_used: true,
        })
        .select()
        .single();

      if (qErr || !createdQ) return;
      questionIdToUse = createdQ.id;
      setQuickCustomQuestion("");
    }

    if (!questionIdToUse) return;

    const { data: newRound, error } = await supabase
      .from("rounds")
      .insert({
        room_id: room.id,
        question_id: questionIdToUse,
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
      .eq("id", questionIdToUse);

    const nextUnused = questions.find((q) => !q.is_used && q.id !== questionIdToUse);
    if (nextUnused) setSelectedQuestionId(nextUnused.id);

    setShowAnswersOnScreen(false);
    setGuesserId("");
    setSkippedAnswerIds([]);
    await broadcastEvent("round_started", { roundId: newRound.id });
    await loadRoomData();
  };

  const handleResetRound = async () => {
    if (!room) return;
    await supabase
      .from("rooms")
      .update({ status: "lobby", current_round_id: null })
      .eq("id", room.id);
    setShowAnswersOnScreen(false);
    setGuesserId("");
    setSkippedAnswerIds([]);
    await broadcastEvent("back_to_lobby", {});
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
    setGuesserId("");
    await supabase
      .from("rounds")
      .update({ active_answer_id: answerId })
      .eq("id", currentRound.id);

    await broadcastEvent("active_answer_changed", { answerId, guesser: null });
    await loadRoomData();
  };

  const handleNextAnswer = async () => {
    if (answers.length === 0) return;
    const nextIdx = (activeAnswerIndex + 1) % answers.length;
    await handleSelectActiveAnswer(answers[nextIdx].id);
  };

  const handleSkipAnswer = async (answerId: string) => {
    setSkippedAnswerIds((prev) => (prev.includes(answerId) ? prev : [...prev, answerId]));
    if (answers.length > 1) {
      await handleNextAnswer();
    }
  };

  const handleSelectGuesser = async (playerId: string) => {
    setGuesserId(playerId);
    const guesser = playerId ? playerMap[playerId] : null;
    await broadcastEvent("guesser_selected", {
      answerId: activeAnswer?.id,
      guesser: guesser
        ? { nickname: guesser.nickname, avatar: guesser.avatar, avatar_url: guesser.avatar_url || null }
        : null,
    });
  };

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

    const guesser = guesserId ? playerMap[guesserId] : null;
    await broadcastEvent("reveal_result", {
      answerId,
      isCorrect,
      guesser: guesser
        ? { nickname: guesser.nickname, avatar: guesser.avatar, avatar_url: guesser.avatar_url || null }
        : null,
    });
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

  const handleSaveEditedQuestion = async (id: string) => {
    if (!editingQuestionText.trim()) return;
    await supabase
      .from("questions")
      .update({ text: editingQuestionText.trim() })
      .eq("id", id);
    setEditingQuestionId(null);
    setEditingQuestionText("");
    await loadRoomData();
  };

  const handleToggleQuestionUsed = async (q: any) => {
    await supabase
      .from("questions")
      .update({ is_used: !q.is_used })
      .eq("id", q.id);
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

  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return players;
    const q = playerSearch.toLowerCase();
    return players.filter((p) => p.nickname.toLowerCase().includes(q));
  }, [players, playerSearch]);

  const pendingSuggestionsCount = suggestions.filter((s) => s.status === "pending").length;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-300">Loading Host Dashboard...</div>;
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openSpinWheel(activeAnswer ? "fifty" : "question")}
            className="rounded-xl bg-gradient-to-r from-pink-500/25 to-cyan-400/25 hover:from-pink-500/35 hover:to-cyan-400/35 border border-pink-400/40 px-3 py-2 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Disc className="w-3.5 h-3.5 text-pink-400" />
            Spin Wheel
          </button>

          <button
            onClick={handleToggleRoomLock}
            className={`rounded-xl border px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              isRoomLocked
                ? "bg-amber-500/20 border-amber-400/50 text-amber-200"
                : "bg-[#130b29] border-purple-500/30 text-purple-200"
            }`}
          >
            {isRoomLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isRoomLocked ? "Locked" : "Open"}
          </button>

          <button
            onClick={handleCopyJoinLink}
            className="rounded-xl bg-[#130b29] hover:bg-purple-900/40 border border-purple-500/30 px-3 py-2 text-xs font-semibold text-purple-200 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? "Copied!" : "Invite"}
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="rounded-xl bg-[#130b29] hover:bg-purple-900/40 border border-purple-500/30 px-3 py-2 text-xs font-semibold text-purple-200 flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-pink-400" />
            QR
          </button>

          <button
            onClick={() => window.open(`/screen/${room?.pin}`, "_blank")}
            className="rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 px-3.5 py-2 text-xs font-bold text-cyan-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Tv className="w-4 h-4" />
            Big Screen
          </button>

          <button
            onClick={handleResetRound}
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
          Round &amp; 50-50
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
          Library ({questions.filter((q) => !q.is_used).length} left)
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
          <div className="lg:col-span-5 rounded-3xl bg-[#130b29] border border-fuchsia-500/30 p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-white">Start New Round</h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openSpinWheel("question")}
                  className="rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-400/35 px-2.5 py-1.5 text-xs font-bold text-pink-200 flex items-center gap-1 cursor-pointer"
                >
                  <Disc className="w-3.5 h-3.5" />
                  Wheel
                </button>
                <button
                  type="button"
                  onClick={handlePickRandomUnusedQuestion}
                  className="rounded-xl bg-purple-900/60 hover:bg-purple-800/70 border border-purple-400/30 px-2.5 py-1.5 text-xs font-bold text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Random Q
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-200/80 mb-1.5">
                Pick from Library
              </label>
              <select
                value={selectedQuestionId}
                disabled={Boolean(quickCustomQuestion.trim())}
                onChange={(e) => setSelectedQuestionId(e.target.value)}
                className="w-full rounded-xl bg-[#090514] border border-purple-500/30 px-3.5 py-3 text-sm text-white disabled:opacity-40 focus:outline-none focus:border-cyan-400"
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.is_used ? "✓ " : "• "}[{q.category.toUpperCase()}] {q.text}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300/90 mb-1.5">
                <Zap className="w-3.5 h-3.5" />
                Or Quick Custom Question (On the Spot)
              </label>
              <input
                type="text"
                value={quickCustomQuestion}
                onChange={(e) => setQuickCustomQuestion(e.target.value)}
                placeholder="Type an instant question..."
                className="w-full rounded-xl bg-[#090514] border border-amber-400/30 px-3.5 py-2.5 text-sm text-white placeholder:text-purple-400/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-200/80 mb-2">
                Who Answers?
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
                  Everyone ({players.length})
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
                  Selected ({selectedPlayerIds.length})
                </button>
              </div>
            </div>

            {targetMode === "selected" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePickRandomPlayers(5)}
                    className="rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/30 px-2.5 py-1 text-[11px] font-bold text-fuchsia-200 cursor-pointer"
                  >
                    🎲 Random 5
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayerIds(players.map((p) => p.id))}
                    className="rounded-lg bg-purple-900/50 border border-purple-500/30 px-2.5 py-1 text-[11px] font-semibold text-purple-200 cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayerIds([])}
                    className="rounded-lg bg-purple-900/50 border border-purple-500/30 px-2.5 py-1 text-[11px] font-semibold text-purple-300 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Filter players..."
                  className="w-full rounded-xl bg-[#090514] border border-purple-500/25 px-3 py-2 text-xs text-white"
                />

                <div className="max-h-44 overflow-y-auto rounded-2xl bg-[#090514] border border-purple-500/25 p-2.5 space-y-1">
                  {filteredPlayers.map((p) => {
                    const checked = selectedPlayerIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-purple-950/50 cursor-pointer text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <AvatarThumb p={p} size="sm" />
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
              </div>
            )}

            <button
              onClick={handleStartRound}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              Launch Round
            </button>
          </div>

          <div className="lg:col-span-7 rounded-3xl bg-[#130b29] border border-purple-500/30 p-6 space-y-5">
            {!currentRound ? (
              <div className="py-16 text-center text-purple-300/60 text-sm">
                No active round. Pick a question on the left and press &ldquo;Launch Round&rdquo;.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-purple-500/20 pb-4">
                  <div className="flex-1">
                    <span className="text-xs uppercase font-bold text-cyan-300">
                      Current Question
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {currentQuestion?.text}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-purple-300/70 block">Submitted</span>
                    <span className="text-2xl font-black text-lime-400">
                      {answers.length} / {expectedRespondersCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {!showAnswersOnScreen ? (
                      <button
                        onClick={() => handleToggleAnswersVisibility(true)}
                        disabled={answers.length === 0}
                        className="rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs px-4 py-2.5 flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        Reveal Answers on Big Screen
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleAnswersVisibility(false)}
                        className="rounded-xl bg-purple-900/60 border border-purple-400/30 text-purple-100 font-bold text-xs px-4 py-2.5 flex items-center gap-2 cursor-pointer"
                      >
                        <EyeOff className="w-4 h-4" />
                        Hide Answers
                      </button>
                    )}

                    <button
                      onClick={() => openSpinWheel("fifty")}
                      className="rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-400/40 text-pink-200 font-bold text-xs px-3 py-2.5 flex items-center gap-1 cursor-pointer"
                    >
                      <Disc className="w-4 h-4" />
                      50-50 Wheel
                    </button>

                    <button
                      onClick={handleResetRound}
                      className="rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 font-bold text-xs px-3 py-2.5 cursor-pointer"
                    >
                      End Round
                    </button>
                  </div>

                  {showAnswersOnScreen && answers.length > 1 && (
                    <button
                      onClick={handleNextAnswer}
                      className="rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-200 font-bold text-xs px-4 py-2.5 flex items-center gap-1.5 cursor-pointer"
                    >
                      Next Answer ({activeAnswerIndex + 1}/{answers.length})
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {showAnswersOnScreen && activeAnswer && (
                  <div className="rounded-2xl bg-[#090514] border border-purple-500/25 p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-purple-200">
                      🎯 Who is guessing the 50-50 ball? (Optional)
                    </span>
                    <select
                      value={guesserId}
                      onChange={(e) => handleSelectGuesser(e.target.value)}
                      className="rounded-xl bg-[#130b29] border border-cyan-400/40 px-3 py-1.5 text-xs text-white"
                    >
                      <option value="">-- No Guesser Selected --</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.avatar} {p.nickname}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  {answers.length === 0 ? (
                    <div className="rounded-2xl bg-[#090514]/70 border border-purple-500/20 p-6 text-center text-sm text-purple-300/60">
                      Waiting for players to submit answers from their phones...
                    </div>
                  ) : (
                    answers.map((ans, idx) => {
                      const author = playerMap[ans.player_id];
                      const isSelectedCard = activeAnswer?.id === ans.id;
                      const isSkipped = skippedAnswerIds.includes(ans.id);

                      return (
                        <div
                          key={ans.id}
                          onClick={() => handleSelectActiveAnswer(ans.id)}
                          className={`rounded-2xl p-4 border transition cursor-pointer ${
                            isSelectedCard
                              ? "bg-[#1c103b] border-cyan-400 shadow-lg"
                              : isSkipped
                              ? "bg-[#090514]/40 border-purple-500/10 opacity-60"
                              : "bg-[#090514]/80 border-purple-500/20 hover:border-purple-400/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-bold uppercase text-purple-300/70">
                              Answer #{idx + 1} {isSelectedCard && "• (On Big Screen)"}{" "}
                              {isSkipped && "• (Skipped)"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">
                              <span>Author:</span>
                              <AvatarThumb p={author} size="sm" />
                              <span>{author?.nickname || "Unknown"}</span>
                            </span>
                          </div>

                          <p className="text-base font-medium text-white mb-3">
                            &ldquo;{ans.content}&rdquo;
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-500/15">
                            <span className="text-xs text-purple-300/70">
                              50-50 Ball:{" "}
                              <strong className={ans.reveal_status === "revealed_correct" ? "text-lime-400" : "text-amber-300"}>
                                {ans.reveal_status === "revealed_correct"
                                  ? "REVEALED (Correct)"
                                  : ans.reveal_status === "kept_anonymous"
                                  ? "KEPT ANONYMOUS (Wrong)"
                                  : "Pending"}
                              </strong>
                            </span>

                            <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                              <button
                                onClick={() => handleSkipAnswer(ans.id)}
                                className="rounded-xl bg-purple-900/50 hover:bg-purple-800/60 border border-purple-400/30 text-purple-200 px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <SkipForward className="w-3.5 h-3.5" />
                                Skip
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
              <option value="flirting">😏 Flirting &amp; Attraction</option>
              <option value="spicy">🌶️ Spicy &amp; Dating</option>
              <option value="funny">😂 Funny &amp; Unexpected</option>
            </select>
            <input
              type="text"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="Write a new question for this room..."
              className="flex-1 rounded-xl bg-[#090514] border border-purple-500/30 px-4 py-3 text-sm text-white"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-pink-500 to-cyan-400 text-slate-950 font-bold text-sm px-5 py-3 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Question
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
                  className="rounded-2xl bg-[#090514]/80 border border-purple-500/20 p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1 min-w-[220px]">
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

                    {editingQuestionId === q.id ? (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={editingQuestionText}
                          onChange={(e) => setEditingQuestionText(e.target.value)}
                          className="flex-1 rounded-lg bg-[#130b29] border border-cyan-400 px-3 py-1.5 text-sm text-white"
                        />
                        <button
                          onClick={() => handleSaveEditedQuestion(q.id)}
                          className="rounded-lg bg-lime-400 text-slate-950 px-3 py-1.5 text-xs font-bold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingQuestionId(null)}
                          className="rounded-lg bg-purple-900/60 text-purple-200 px-2.5 py-1.5 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-white">{q.text}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedQuestionId(q.id);
                        setQuickCustomQuestion("");
                        setActiveTab("round");
                      }}
                      className="rounded-lg bg-cyan-500/15 border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 cursor-pointer"
                    >
                      Use Now
                    </button>
                    <button
                      onClick={() => handleToggleQuestionUsed(q)}
                      className="rounded-lg bg-purple-900/50 border border-purple-500/30 p-2 text-purple-200 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingQuestionId(q.id);
                        setEditingQuestionText(q.text);
                      }}
                      className="rounded-lg bg-purple-900/50 border border-purple-500/30 p-2 text-purple-200 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
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
          <h2 className="text-lg font-bold text-white">Anonymous Player Suggestions</h2>
          {suggestions.length === 0 ? (
            <p className="text-sm text-purple-300/60">No player suggestions submitted yet.</p>
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
                      Approve to Library
                    </button>
                    <button
                      onClick={() => handleRejectSuggestion(s.id)}
                      className="rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-300 px-3.5 py-2 text-xs font-bold cursor-pointer"
                    >
                      Reject
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
          <h2 className="text-lg font-bold text-white mb-4">Connected Players ({players.length})</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {players.map((p) => {
              const hasAnswered = answers.some((a) => a.player_id === p.id);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[#090514] border border-purple-500/25 p-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <AvatarThumb p={p} />
                    <div>
                      <div className="text-sm font-bold text-white">{p.nickname}</div>
                      <div className="text-[11px] text-purple-300/70">
                        {currentRound
                          ? hasAnswered
                            ? "✅ Answered"
                            : "⏳ Waiting"
                          : "Ready"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePlayer(p.id)}
                    className="text-rose-400/70 hover:text-rose-300 p-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spin Wheel Modal */}
      {showWheelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#130b29] border border-fuchsia-500/40 p-6 space-y-5 text-center">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setWheelMode("question");
                    setWheelResultText(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    wheelMode === "question" ? "bg-cyan-400 text-slate-950" : "bg-[#090514] text-purple-200"
                  }`}
                >
                  Question Wheel
                </button>
                <button
                  onClick={() => {
                    setWheelMode("fifty");
                    setWheelResultText(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    wheelMode === "fifty" ? "bg-pink-500 text-white" : "bg-[#090514] text-purple-200"
                  }`}
                >
                  50-50 Wheel
                </button>
              </div>
              <button onClick={() => setShowWheelModal(false)} className="text-purple-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
              <div className="absolute -top-2 text-2xl z-10">▼</div>
              <div
                style={{
                  transform: `rotate(${wheelAngle}deg)`,
                  transition: spinning ? "transform 1.7s cubic-bezier(0.18, 0.89, 0.32, 1)" : "none",
                }}
                className="w-40 h-40 rounded-full border-4 border-cyan-300 bg-[conic-gradient(#ec4899_0deg_90deg,#a855f7_90deg_180deg,#22d3ee_180deg_270deg,#a3e635_270deg_360deg)] flex items-center justify-center shadow-2xl"
              >
                <div className="w-14 h-14 rounded-full bg-[#090514] border-2 border-white flex items-center justify-center font-black text-xs text-white">
                  {wheelMode === "question" ? "Q?" : "50/50"}
                </div>
              </div>
            </div>

            {wheelResultText && (
              <div className="rounded-2xl bg-[#090514] border border-lime-400/40 p-3.5 text-sm font-bold text-white">
                {wheelResultText}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSpinWheel}
                disabled={spinning}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-300 disabled:opacity-50 cursor-pointer"
              >
                {spinning ? "Spinning..." : "Spin Wheel"}
              </button>

              {wheelMode === "question" && wheelPickedQuestionId && !spinning && (
                <button
                  onClick={() => {
                    setSelectedQuestionId(wheelPickedQuestionId);
                    setQuickCustomQuestion("");
                    setShowWheelModal(false);
                  }}
                  className="px-4 py-3 rounded-xl font-bold text-xs bg-lime-400 text-slate-950 cursor-pointer"
                >
                  Use Question
                </button>
              )}

              {wheelMode === "fifty" && wheelPicked5050 !== null && activeAnswer && !spinning && (
                <button
                  onClick={async () => {
                    await handle5050Result(activeAnswer.id, wheelPicked5050);
                    setShowWheelModal(false);
                  }}
                  className="px-4 py-3 rounded-xl font-bold text-xs bg-lime-400 text-slate-950 cursor-pointer"
                >
                  Apply Result
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#130b29] border border-fuchsia-500/40 p-6 text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                Scan to Join
              </span>
              <button onClick={() => setShowQrModal(false)} className="text-purple-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-2xl inline-block">
              {joinUrl && <QRCodeSVG value={joinUrl} size={210} />}
            </div>
            <div className="text-3xl font-black tracking-[0.25em] text-cyan-300">{pin}</div>
            <p className="text-xs text-purple-200/70 break-all">{joinUrl}</p>
          </div>
        </div>
      )}
    </main>
  );
}
