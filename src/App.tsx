import {
  BadgeCheck,
  Brain,
  CalendarCheck,
  Coins,
  Crown,
  Flame,
  Gamepad2,
  Gem,
  Heart,
  Medal,
  MousePointerClick,
  Play,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Phase = "home" | "playing" | "result";
type GameKind = "target" | "number" | "color" | "odd" | "memory" | "reflex" | "risk";

type MiniGame = {
  id: number;
  kind: GameKind;
  title: string;
  prompt: string;
  limit: number;
  danger: boolean;
  payload: Record<string, unknown>;
};

type GameResult = {
  game: MiniGame;
  success: boolean;
  points: number;
  elapsed: number;
};

type SaveData = {
  bestScore: number;
  coins: number;
  xp: number;
  plays: number;
  sRanks: number;
  totalCorrect: number;
  lastLogin: string;
  owned: string[];
};

const STORAGE_KEY = "hirameki-rush-save";
const todayKey = new Date().toISOString().slice(0, 10);

const defaultSave: SaveData = {
  bestScore: 0,
  coins: 120,
  xp: 0,
  plays: 0,
  sRanks: 0,
  totalCorrect: 0,
  lastLogin: "",
  owned: ["starter"],
};

const colors = [
  { name: "RED", value: "#ef4444" },
  { name: "BLUE", value: "#2563eb" },
  { name: "GREEN", value: "#16a34a" },
  { name: "YELLOW", value: "#f59e0b" },
  { name: "PINK", value: "#ec4899" },
  { name: "CYAN", value: "#0891b2" },
];

const shopItems = [
  { id: "neon-bg", name: "Neon board", price: 180 },
  { id: "gold-badge", name: "Gold badge", price: 220 },
  { id: "fever-pop", name: "Fever pop", price: 260 },
];

const achievements = [
  { label: "First run", check: (save: SaveData) => save.plays >= 1 },
  { label: "2,000 pts", check: (save: SaveData) => save.bestScore >= 2000 },
  { label: "S rank", check: (save: SaveData) => save.sRanks >= 1 },
  { label: "25 hits", check: (save: SaveData) => save.totalCorrect >= 25 },
  { label: "Lv 5", check: (save: SaveData) => levelFromXp(save.xp) >= 5 },
  { label: "Collector", check: (save: SaveData) => save.owned.length >= 3 },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function levelFromXp(xp: number) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function rankFromScore(score: number) {
  if (score >= 7600) return "S";
  if (score >= 5600) return "A";
  if (score >= 3600) return "B";
  return "C";
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultSave, ...JSON.parse(raw) } : defaultSave;
  } catch {
    return defaultSave;
  }
}

function makeGame(id: number, streak: number): MiniGame {
  const kind = shuffle<GameKind>(["target", "number", "color", "odd", "memory", "reflex", "risk"])[0];
  const danger = id > 4 && Math.random() < 0.45;
  const limit = Math.max(3.2, 7.2 - id * 0.18 - streak * 0.08);

  if (kind === "target") {
    return {
      id,
      kind,
      title: "Pop Target",
      prompt: "Hit the glowing target",
      limit,
      danger,
      payload: {
        x: randomInt(8, 78),
        y: randomInt(12, 74),
        fake: Array.from({ length: danger ? 5 : 3 }, () => ({
          x: randomInt(8, 78),
          y: randomInt(12, 74),
        })),
      },
    };
  }

  if (kind === "number") {
    const size = danger ? 12 : 9;
    return {
      id,
      kind,
      title: "Tap Ladder",
      prompt: "Tap 1, 2, 3... without a miss",
      limit: limit + 2,
      danger,
      payload: {
        numbers: shuffle(Array.from({ length: size }, (_, index) => index + 1)),
        next: 1,
        size,
      },
    };
  }

  if (kind === "color") {
    const answer = colors[randomInt(0, colors.length - 1)];
    const label = colors[randomInt(0, colors.length - 1)];
    return {
      id,
      kind,
      title: "Color Trap",
      prompt: danger ? `Tap the COLOR, ignore word: ${label.name}` : `Tap ${answer.name}`,
      limit,
      danger,
      payload: {
        answer: answer.value,
        label: label.name,
        labelColor: answer.value,
        options: shuffle(colors).slice(0, danger ? 6 : 4),
      },
    };
  }

  if (kind === "odd") {
    const base = shuffle(["7", "9", "Q", "O", "S"])[0];
    const odd = { "7": "1", "9": "6", Q: "O", O: "0", S: "5" }[base] ?? "X";
    const answer = randomInt(0, danger ? 15 : 8);
    return {
      id,
      kind,
      title: "Odd One",
      prompt: "Find the different tile",
      limit,
      danger,
      payload: {
        base,
        odd,
        answer,
        count: danger ? 16 : 9,
      },
    };
  }

  if (kind === "memory") {
    const symbols = shuffle(["STAR", "MOON", "FIRE", "WAVE", "RING", "BOLT"]);
    const answer = symbols[0];
    return {
      id,
      kind,
      title: "Flash Memory",
      prompt: "Remember it, then tap it",
      limit: limit + 1,
      danger,
      payload: {
        answer,
        options: shuffle(symbols.slice(0, danger ? 6 : 4)),
        revealedUntil: Date.now() + (danger ? 950 : 1400),
      },
    };
  }

  if (kind === "reflex") {
    return {
      id,
      kind,
      title: "Red Light Rush",
      prompt: "Tap only when it says GO",
      limit: 5.5,
      danger,
      payload: {
        readyAt: Date.now() + randomInt(750, danger ? 2400 : 1700),
      },
    };
  }

  const safe = randomInt(0, danger ? 5 : 3);
  return {
    id,
    kind: "risk",
    title: "Risk Pick",
    prompt: "One tile is jackpot. Others are bombs.",
    limit,
    danger,
    payload: {
      answer: safe,
      count: danger ? 6 : 4,
    },
  };
}

export function App() {
  const [phase, setPhase] = useState<Phase>("home");
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [queue, setQueue] = useState<MiniGame[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentGame, setCurrentGame] = useState<MiniGame | null>(null);
  const [results, setResults] = useState<GameResult[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [fever, setFever] = useState(0);
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }, [save]);

  useEffect(() => {
    if (save.lastLogin !== todayKey) {
      setSave((prev) => ({ ...prev, coins: prev.coins + 30, lastLogin: todayKey }));
    }
  }, [save.lastLogin]);

  useEffect(() => {
    if (phase !== "playing" || !currentGame) return;
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      const left = Math.max(0, currentGame.limit - (Date.now() - startedAt) / 1000);
      setTimeLeft(left);
      if (left <= 0) finishGame(false);
    }, 90);
    return () => window.clearInterval(timer);
  }, [phase, currentGame, startedAt]);

  const rawScore = useMemo(() => results.reduce((sum, result) => sum + result.points, 0), [results]);
  const successes = results.filter((result) => result.success).length;
  const noMiss = results.length > 0 && successes === results.length;
  const finalScore = rawScore + (noMiss ? 1000 : 0) + lives * 250;
  const rank = rankFromScore(finalScore);
  const level = levelFromXp(save.xp);
  const hitRate = results.length ? Math.round((successes / results.length) * 100) : 0;
  const currentMissions = [
    { label: "Win 5 rounds", done: successes >= 5 },
    { label: "Reach fever", done: fever >= 100 },
    { label: "Keep 2 lives", done: lives >= 2 && results.length >= 8 },
  ];

  function beginRun() {
    const nextQueue = Array.from({ length: 10 }, (_, index) => makeGame(index + 1, 0));
    setQueue(nextQueue);
    setCurrentIndex(0);
    setResults([]);
    setCombo(0);
    setLives(3);
    setFever(0);
    setMessage("");
    setPhase("playing");
    loadGame(nextQueue[0], 0);
  }

  function loadGame(game: MiniGame, index: number) {
    setCurrentGame(game);
    setCurrentIndex(index);
    setStartedAt(Date.now());
    setTimeLeft(game.limit);
  }

  function finishGame(success: boolean) {
    if (!currentGame || message) return;

    const elapsed = Math.min(currentGame.limit, (Date.now() - startedAt) / 1000);
    const nextCombo = success ? combo + 1 : 0;
    const speedBonus = success ? Math.round((currentGame.limit - elapsed) * 95) : 0;
    const feverBonus = fever >= 100 ? 350 : 0;
    const dangerBonus = currentGame.danger && success ? 240 : 0;
    const points = success ? 480 + speedBonus + nextCombo * 135 + feverBonus + dangerBonus : 60;
    const nextResults = [...results, { game: currentGame, success, points, elapsed }];
    const nextLives = success ? lives : lives - 1;
    const nextFever = success ? Math.min(100, fever + 18 + nextCombo * 3) : Math.max(0, fever - 28);

    setResults(nextResults);
    setCombo(nextCombo);
    setLives(nextLives);
    setFever(nextFever);
    setMessage(success ? (nextFever >= 100 ? "FEVER!" : "NICE!") : "MISS!");

    window.setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextLives <= 0 || nextIndex >= queue.length) {
        completeRun(nextResults, nextLives);
        return;
      }
      const nextGame = makeGame(nextIndex + 1, nextCombo);
      const nextQueue = [...queue];
      nextQueue[nextIndex] = nextGame;
      setQueue(nextQueue);
      loadGame(nextGame, nextIndex);
      setMessage("");
    }, success ? 430 : 700);
  }

  function completeRun(nextResults: GameResult[], nextLives: number) {
    const score = nextResults.reduce((sum, result) => sum + result.points, 0);
    const correct = nextResults.filter((result) => result.success).length;
    const cleanBonus = correct === nextResults.length ? 1000 : 0;
    const total = score + cleanBonus + Math.max(0, nextLives) * 250;
    const finalRank = rankFromScore(total);
    setSave((prev) => ({
      ...prev,
      bestScore: Math.max(prev.bestScore, total),
      coins: prev.coins + Math.round(total / 100),
      xp: prev.xp + total,
      plays: prev.plays + 1,
      sRanks: prev.sRanks + (finalRank === "S" ? 1 : 0),
      totalCorrect: prev.totalCorrect + correct,
    }));
    setCurrentGame(null);
    setPhase("result");
  }

  function buyItem(id: string, price: number) {
    if (save.owned.includes(id) || save.coins < price) return;
    setSave((prev) => ({ ...prev, coins: prev.coins - price, owned: [...prev.owned, id] }));
  }

  function answer(value: unknown) {
    if (!currentGame) return;

    if (currentGame.kind === "number") {
      const next = currentGame.payload.next as number;
      const size = currentGame.payload.size as number;
      if (value !== next) return finishGame(false);
      if (next >= size) return finishGame(true);
      setCurrentGame({
        ...currentGame,
        payload: { ...currentGame.payload, next: next + 1 },
      });
      return;
    }

    if (currentGame.kind === "reflex") {
      return finishGame(Date.now() >= (currentGame.payload.readyAt as number));
    }

    finishGame(value === currentGame.payload.answer);
  }

  return (
    <main className={`min-h-screen text-slate-950 ${phase === "playing" && fever >= 100 ? "fever-bg" : "app-bg"}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-950 text-emerald-300 shadow-soft">
              <Brain size={27} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-normal sm:text-3xl">Hirameki Rush</h1>
              <p className="text-sm font-bold text-slate-500">10 quick rounds. 3 lives. Chase fever.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
            <Coins className="text-amber-500" size={20} />
            <span className="font-black">{save.coins}</span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-h-[590px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
            {phase === "home" && <HomePanel save={save} level={level} onStart={beginRun} />}
            {phase === "playing" && currentGame && (
              <PlayingPanel
                game={currentGame}
                index={currentIndex}
                total={queue.length}
                timeLeft={timeLeft}
                combo={combo}
                lives={lives}
                fever={fever}
                message={message}
                tick={tick}
                onAnswer={answer}
              />
            )}
            {phase === "result" && (
              <ResultPanel
                score={finalScore}
                rank={rank}
                results={results}
                noMiss={noMiss}
                best={save.bestScore}
                lives={lives}
                hitRate={hitRate}
                onRestart={beginRun}
              />
            )}
          </div>

          <aside className="grid content-start gap-4">
            <InfoCard icon={<Trophy size={19} />} title="Scoreboard">
              <Ranking best={save.bestScore} current={rawScore} />
            </InfoCard>
            <InfoCard icon={<CalendarCheck size={19} />} title="Daily Missions">
              <div className="space-y-2">
                {currentMissions.map((mission) => (
                  <StatusRow key={mission.label} label={mission.label} active={mission.done} />
                ))}
              </div>
            </InfoCard>
            <InfoCard icon={<Star size={19} />} title="Achievements">
              <div className="grid grid-cols-2 gap-2">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.label}
                    className={`rounded-md px-2 py-2 text-xs font-black ${
                      achievement.check(save) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {achievement.label}
                  </div>
                ))}
              </div>
            </InfoCard>
            <InfoCard icon={<ShoppingBag size={19} />} title="Shop">
              <div className="space-y-2">
                {shopItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => buyItem(item.id, item.price)}
                    disabled={save.owned.includes(item.id) || save.coins < item.price}
                    className="tap-target flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-black transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <span>{item.name}</span>
                    <span>{save.owned.includes(item.id) ? "Owned" : `${item.price} C`}</span>
                  </button>
                ))}
              </div>
            </InfoCard>
          </aside>
        </section>
      </div>
    </main>
  );
}

function HomePanel({ save, level, onStart }: { save: SaveData; level: number; onStart: () => void }) {
  return (
    <div className="grid min-h-[590px] content-between gap-6 p-5 sm:p-6">
      <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden rounded-lg bg-slate-950 p-6 text-white">
          <div className="absolute right-[-70px] top-[-90px] h-64 w-64 rounded-full bg-emerald-400/25 blur-2xl" />
          <div className="absolute bottom-[-80px] left-[-50px] h-52 w-52 rounded-full bg-amber-300/20 blur-2xl" />
          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-black text-emerald-200">
              <Sparkles size={18} />
              Login bonus +30 C
            </div>
            <h2 className="max-w-xl text-5xl font-black tracking-normal sm:text-6xl">
              Tiny games, big combo.
            </h2>
            <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-slate-200">
              This version is faster, harsher, and more toy-like: ten random challenges, three lives,
              fever mode, danger rounds, and a score chase that actually bites back.
            </p>
            <button
              onClick={onStart}
              className="tap-target mt-7 inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-6 py-3 text-base font-black text-slate-950 shadow-lg transition hover:scale-[1.03] hover:bg-amber-200"
            >
              <Play size={20} fill="currentColor" />
              Start Rush
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          <Stat icon={<Crown size={19} />} label="Best" value={`${save.bestScore.toLocaleString()} pt`} />
          <Stat icon={<Zap size={19} />} label="Level" value={`Lv ${level}`} />
          <Stat icon={<Gamepad2 size={19} />} label="Runs" value={`${save.plays}`} />
          <Stat icon={<BadgeCheck size={19} />} label="Total hits" value={`${save.totalCorrect}`} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["3 lives", Heart],
          ["Fever", Flame],
          ["Danger", Target],
          ["One tap", MousePointerClick],
        ].map(([label, Icon]) => (
          <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center font-black">
            <Icon className="mx-auto mb-2 text-emerald-600" size={22} />
            {String(label)}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayingPanel({
  game,
  index,
  total,
  timeLeft,
  combo,
  lives,
  fever,
  message,
  tick,
  onAnswer,
}: {
  game: MiniGame;
  index: number;
  total: number;
  timeLeft: number;
  combo: number;
  lives: number;
  fever: number;
  message: string;
  tick: number;
  onAnswer: (value: unknown) => void;
}) {
  return (
    <div className="grid gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-emerald-600">
              ROUND {index + 1}/{total}
            </p>
            {game.danger && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-black text-rose-700">DANGER</span>}
          </div>
          <h2 className="text-3xl font-black tracking-normal">{game.title}</h2>
          <p className="mt-1 font-semibold text-slate-500">{game.prompt}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Meter icon={<Timer size={18} />} value={timeLeft.toFixed(1)} />
          <Meter icon={<Zap size={18} />} value={`${combo}x`} />
          <Meter icon={<Heart size={18} />} value={`${lives}`} />
        </div>
      </div>

      <div className="grid gap-2">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all ${timeLeft < 2 ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.max(0, (timeLeft / game.limit) * 100)}%` }}
          />
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${fever}%` }} />
        </div>
      </div>

      <div className={`game-stage relative grid min-h-[390px] place-items-center overflow-hidden rounded-lg p-4 ${game.danger ? "danger-stage" : "bg-slate-50"}`}>
        {message && (
          <div className={`result-pop absolute inset-0 z-20 grid place-items-center text-5xl font-black ${message === "MISS!" ? "text-rose-600" : "text-emerald-500"}`}>
            <span className="rounded-lg bg-white/85 px-7 py-4 shadow-soft">{message}</span>
          </div>
        )}
        <GameSurface game={game} tick={tick} onAnswer={onAnswer} />
      </div>
    </div>
  );
}

function GameSurface({ game, tick, onAnswer }: { game: MiniGame; tick: number; onAnswer: (value: unknown) => void }) {
  if (game.kind === "target") {
    const fakes = game.payload.fake as { x: number; y: number }[];
    return (
      <div className="relative h-[330px] w-full max-w-xl">
        {fakes.map((fake, index) => (
          <button
            key={index}
            onClick={() => onAnswer("fake")}
            className="target-fake absolute h-16 w-16 rounded-full bg-slate-300/75"
            style={{ left: `${fake.x}%`, top: `${fake.y}%` }}
            aria-label="fake target"
          />
        ))}
        <button
          onClick={() => onAnswer(true)}
          className="target-real absolute h-20 w-20 rounded-full bg-emerald-400 text-slate-950 shadow-soft"
          style={{ left: `${game.payload.x}%`, top: `${game.payload.y}%` }}
          aria-label="target"
        >
          <Target className="mx-auto" size={34} />
        </button>
      </div>
    );
  }

  if (game.kind === "number") {
    const numbers = game.payload.numbers as number[];
    const next = game.payload.next as number;
    const size = game.payload.size as number;
    return (
      <div className={`grid w-full max-w-md gap-2 ${size > 9 ? "grid-cols-4" : "grid-cols-3"}`}>
        {numbers.map((number) => (
          <button
            key={number}
            onClick={() => onAnswer(number)}
            className={`aspect-square rounded-lg text-3xl font-black shadow-sm transition hover:scale-[1.04] ${
              number < next ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-900 hover:bg-amber-100"
            }`}
          >
            {number}
          </button>
        ))}
      </div>
    );
  }

  if (game.kind === "color") {
    const options = game.payload.options as typeof colors;
    return (
      <div className="grid w-full max-w-lg gap-4">
        {game.danger && (
          <div className="text-center text-5xl font-black" style={{ color: game.payload.labelColor as string }}>
            {game.payload.label as string}
          </div>
        )}
        <div className={`grid gap-3 ${options.length > 4 ? "grid-cols-3" : "grid-cols-2"}`}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => onAnswer(option.value)}
              className="tap-target h-24 rounded-lg border-4 border-white shadow-sm transition hover:scale-[1.04]"
              style={{ backgroundColor: option.value }}
              aria-label={option.name}
            />
          ))}
        </div>
      </div>
    );
  }

  if (game.kind === "odd") {
    const count = game.payload.count as number;
    const answer = game.payload.answer as number;
    return (
      <div className={`grid w-full max-w-md gap-2 ${count > 9 ? "grid-cols-4" : "grid-cols-3"}`}>
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            onClick={() => onAnswer(index)}
            className="tap-target aspect-square rounded-lg bg-white text-4xl font-black shadow-sm transition hover:scale-[1.04] hover:bg-emerald-50"
          >
            {index === answer ? (game.payload.odd as string) : (game.payload.base as string)}
          </button>
        ))}
      </div>
    );
  }

  if (game.kind === "memory") {
    const options = game.payload.options as string[];
    const revealed = Date.now() < (game.payload.revealedUntil as number);
    return revealed ? (
      <div className="memory-flash text-center">
        <div className="text-6xl font-black text-emerald-500">{game.payload.answer as string}</div>
        <p className="mt-3 font-black text-slate-500">Remember this</p>
      </div>
    ) : (
      <div className={`grid w-full max-w-lg gap-3 ${options.length > 4 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onAnswer(option)}
            className="tap-target rounded-lg bg-white px-3 py-8 text-2xl font-black shadow-sm transition hover:scale-[1.04] hover:bg-amber-100"
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (game.kind === "reflex") {
    const ready = Date.now() >= (game.payload.readyAt as number);
    return (
      <button
        onClick={() => onAnswer("tap")}
        className={`tap-target reflex-button h-48 w-48 rounded-full text-5xl font-black text-white shadow-soft transition ${
          ready ? "bg-emerald-500 hover:scale-[1.04]" : "bg-rose-500"
        }`}
      >
        {ready || tick < 0 ? "GO" : "WAIT"}
      </button>
    );
  }

  const count = game.payload.count as number;
  return (
    <div className={`grid w-full max-w-lg gap-3 ${count > 4 ? "grid-cols-3" : "grid-cols-4"}`}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          onClick={() => onAnswer(index)}
          className="tap-target aspect-square rounded-lg bg-white shadow-sm transition hover:scale-[1.05] hover:bg-amber-100"
        >
          <Gem className="mx-auto text-amber-500" size={44} />
        </button>
      ))}
    </div>
  );
}

function ResultPanel({
  score,
  rank,
  results,
  noMiss,
  best,
  lives,
  hitRate,
  onRestart,
}: {
  score: number;
  rank: string;
  results: GameResult[];
  noMiss: boolean;
  best: number;
  lives: number;
  hitRate: number;
  onRestart: () => void;
}) {
  return (
    <div className="grid gap-5 p-5 sm:p-6">
      <div className="rounded-lg bg-slate-950 p-6 text-white">
        <div className="flex items-center gap-2 text-emerald-200">
          <Medal size={22} />
          <span className="font-black">Run Complete</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <ResultStat label="Score" value={score.toLocaleString()} />
          <ResultStat label="Rank" value={rank} />
          <ResultStat label="Hit rate" value={`${hitRate}%`} />
          <ResultStat label="Lives" value={`${Math.max(0, lives)}`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-black">
          {noMiss && <span className="rounded-full bg-amber-300 px-3 py-1 text-slate-950">Clean +1000</span>}
          <span className="rounded-full bg-white/10 px-3 py-1 text-emerald-100">
            Best {Math.max(best, score).toLocaleString()}
          </span>
        </div>
        <button
          onClick={onRestart}
          className="tap-target mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-5 py-3 font-black text-slate-950 transition hover:scale-[1.03] hover:bg-amber-200"
        >
          <RotateCcw size={19} />
          Retry
        </button>
      </div>

      <div className="grid gap-2">
        {results.map((result) => (
          <div key={result.game.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2 font-black">
              {result.success ? (
                <ShieldCheck className="text-emerald-600" size={19} />
              ) : (
                <Target className="text-rose-500" size={19} />
              )}
              {result.game.title}
            </div>
            <span className="font-black">{result.points} pt</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-emerald-200">{label}</p>
      <p className="text-4xl font-black">{value}</p>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 font-black">
        <span className="text-emerald-600">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Ranking({ best, current }: { best: number; current: number }) {
  const rows = [
    ["World", 12680],
    ["Weekly", 9340],
    ["Today", 7180],
    ["You", Math.max(best, current)],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([label, score]) => (
        <div key={label} className="flex items-center justify-between text-sm">
          <span className="font-bold text-slate-500">{label}</span>
          <span className="font-black">{Number(score).toLocaleString()} pt</span>
        </div>
      ))}
    </div>
  );
}

function StatusRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
      <span className="font-bold">{label}</span>
      <Star className={active ? "text-amber-500" : "text-slate-300"} size={18} fill="currentColor" />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-emerald-600">{icon}</div>
      <p className="mt-3 text-sm font-bold text-slate-500">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function Meter({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 font-black">
      <span className="text-emerald-600">{icon}</span>
      {value}
    </div>
  );
}
