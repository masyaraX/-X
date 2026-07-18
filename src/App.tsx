import {
  Award,
  BadgeCheck,
  Brain,
  CalendarCheck,
  Coins,
  Crown,
  Gamepad2,
  Gem,
  Medal,
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

type GameKind = "number" | "color" | "memory" | "math" | "reflex" | "luck";
type Phase = "home" | "playing" | "result";

type MiniGame = {
  id: number;
  kind: GameKind;
  title: string;
  instruction: string;
  limit: number;
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

const STORAGE_KEY = "hirameki-challenge-save";
const todayKey = new Date().toISOString().slice(0, 10);

const defaultSave: SaveData = {
  bestScore: 0,
  coins: 120,
  xp: 0,
  plays: 0,
  sRanks: 0,
  totalCorrect: 0,
  lastLogin: "",
  owned: ["starter-icon"],
};

const gameTitles: Record<GameKind, string> = {
  number: "数字タップ",
  color: "色合わせ",
  memory: "記憶カード",
  math: "計算チャレンジ",
  reflex: "反射神経",
  luck: "運試しルーレット",
};

const palette = [
  { name: "赤", value: "#ef4444" },
  { name: "青", value: "#2563eb" },
  { name: "緑", value: "#16a34a" },
  { name: "黄", value: "#f59e0b" },
  { name: "紫", value: "#7c3aed" },
  { name: "桃", value: "#ec4899" },
];

const shopItems = [
  { id: "night-sky", name: "夜空テーマ", price: 180 },
  { id: "gold-icon", name: "金色アイコン", price: 220 },
  { id: "spark-effect", name: "ひらめき演出", price: 260 },
];

const achievements = [
  { label: "初プレイ", check: (save: SaveData) => save.plays >= 1 },
  { label: "1000 点突破", check: (save: SaveData) => save.bestScore >= 1000 },
  { label: "S ランク達成", check: (save: SaveData) => save.sRanks >= 1 },
  { label: "10 問正解", check: (save: SaveData) => save.totalCorrect >= 10 },
  { label: "Lv 5 到達", check: (save: SaveData) => levelFromXp(save.xp) >= 5 },
  { label: "コレクター", check: (save: SaveData) => save.owned.length >= 3 },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function levelFromXp(xp: number) {
  return Math.floor(Math.sqrt(xp / 90)) + 1;
}

function rankFromScore(score: number) {
  if (score >= 5200) return "S";
  if (score >= 3800) return "A";
  if (score >= 2400) return "B";
  return "C";
}

function makeGame(id: number): MiniGame {
  const kind = shuffle<GameKind>(["number", "color", "memory", "math", "reflex", "luck"])[0];

  if (kind === "number") {
    const numbers = shuffle(Array.from({ length: 9 }, (_, index) => index + 1));
    return {
      id,
      kind,
      title: gameTitles[kind],
      instruction: "1 から順番に押そう",
      limit: 12,
      payload: { numbers, next: 1 },
    };
  }

  if (kind === "color") {
    const answer = palette[randomInt(0, palette.length - 1)];
    return {
      id,
      kind,
      title: gameTitles[kind],
      instruction: `${answer.name}と同じ色を選ぼう`,
      limit: 8,
      payload: { answer: answer.value, options: shuffle(palette).slice(0, 4) },
    };
  }

  if (kind === "memory") {
    const symbols = shuffle(["星", "月", "花", "音", "光"]);
    const answer = symbols[0];
    return {
      id,
      kind,
      title: gameTitles[kind],
      instruction: `覚えて: ${answer}`,
      limit: 9,
      payload: { answer, options: shuffle(symbols.slice(0, 4)), revealedUntil: Date.now() + 1800 },
    };
  }

  if (kind === "math") {
    const left = randomInt(4, 18);
    const right = randomInt(2, 12);
    const answer = left + right;
    return {
      id,
      kind,
      title: gameTitles[kind],
      instruction: `${left} + ${right} = ?`,
      limit: 10,
      payload: { answer, options: shuffle([answer, answer + 1, answer - 2, answer + 3]) },
    };
  }

  if (kind === "reflex") {
    const delay = randomInt(900, 2200);
    return {
      id,
      kind,
      title: gameTitles[kind],
      instruction: "GO が出たら押そう",
      limit: 7,
      payload: { readyAt: Date.now() + delay },
    };
  }

  const answer = randomInt(0, 3);
  return {
    id,
    kind,
    title: gameTitles[kind],
    instruction: "当たりの宝石を選ぼう",
    limit: 8,
    payload: { answer },
  };
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultSave, ...JSON.parse(raw) } : defaultSave;
  } catch {
    return defaultSave;
  }
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
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }, [save]);

  useEffect(() => {
    if (save.lastLogin !== todayKey) {
      setSave((prev) => ({
        ...prev,
        coins: prev.coins + 30,
        lastLogin: todayKey,
      }));
    }
  }, [save.lastLogin]);

  useEffect(() => {
    if (phase !== "playing" || !currentGame) return;
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      const left = Math.max(0, currentGame.limit - (Date.now() - startedAt) / 1000);
      setTimeLeft(left);
      if (left <= 0) finishGame(false);
    }, 150);
    return () => window.clearInterval(timer);
  }, [phase, currentGame, startedAt]);

  const totalScore = useMemo(() => results.reduce((sum, result) => sum + result.points, 0), [results]);
  const successes = results.filter((result) => result.success).length;
  const noMiss = results.length > 0 && successes === results.length;
  const level = levelFromXp(save.xp);
  const rank = rankFromScore(totalScore + (noMiss ? 700 : 0));
  const currentMissions = [
    { label: "3 ゲーム成功", done: successes >= 3 },
    { label: "3000 点獲得", done: totalScore >= 3000 },
    { label: "ノーミス進行", done: noMiss && results.length >= 4 },
  ];

  function beginRun() {
    const nextQueue = Array.from({ length: 6 }, (_, index) => makeGame(index + 1));
    setQueue(nextQueue);
    setCurrentIndex(0);
    setResults([]);
    setCombo(0);
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
    if (!currentGame) return;
    const elapsed = Math.min(currentGame.limit, (Date.now() - startedAt) / 1000);
    const nextCombo = success ? combo + 1 : 0;
    const speedBonus = success ? Math.round((currentGame.limit - elapsed) * 55) : 0;
    const points = success ? 500 + speedBonus + nextCombo * 120 : 80;
    const nextResults = [...results, { game: currentGame, success, points, elapsed }];
    setResults(nextResults);
    setCombo(nextCombo);
    setMessage(success ? "クリア！" : "ざんねん");

    window.setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        completeRun(nextResults);
      } else {
        loadGame(queue[nextIndex], nextIndex);
        setMessage("");
      }
    }, 600);
  }

  function completeRun(nextResults: GameResult[]) {
    const score = nextResults.reduce((sum, result) => sum + result.points, 0);
    const correct = nextResults.filter((result) => result.success).length;
    const finalNoMiss = correct === nextResults.length;
    const finalScore = score + (finalNoMiss ? 700 : 0);
    const finalRank = rankFromScore(finalScore);
    setSave((prev) => ({
      ...prev,
      bestScore: Math.max(prev.bestScore, finalScore),
      coins: prev.coins + Math.round(finalScore / 120),
      xp: prev.xp + finalScore,
      plays: prev.plays + 1,
      sRanks: prev.sRanks + (finalRank === "S" ? 1 : 0),
      totalCorrect: prev.totalCorrect + correct,
    }));
    setPhase("result");
    setCurrentGame(null);
  }

  function buyItem(id: string, price: number) {
    if (save.owned.includes(id) || save.coins < price) return;
    setSave((prev) => ({
      ...prev,
      coins: prev.coins - price,
      owned: [...prev.owned, id],
    }));
  }

  function answer(value: unknown) {
    if (!currentGame) return;

    if (currentGame.kind === "number") {
      const next = currentGame.payload.next as number;
      if (value !== next) return finishGame(false);
      if (next >= 9) return finishGame(true);
      setCurrentGame({
        ...currentGame,
        payload: { ...currentGame.payload, next: next + 1 },
      });
      return;
    }

    if (currentGame.kind === "reflex") {
      const readyAt = currentGame.payload.readyAt as number;
      return finishGame(Date.now() >= readyAt);
    }

    finishGame(value === currentGame.payload.answer);
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-500 text-white shadow-soft">
              <Brain size={25} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-normal sm:text-3xl">ひらめきチャレンジ</h1>
              <p className="text-sm font-medium text-slate-500">クリックだけで遊べるミニゲーム集</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
            <Coins className="text-amber-500" size={20} />
            <span className="font-bold">{save.coins}</span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-h-[560px] rounded-lg border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
            {phase === "home" && (
              <HomePanel save={save} level={level} onStart={beginRun} />
            )}

            {phase === "playing" && currentGame && (
              <PlayingPanel
                game={currentGame}
                index={currentIndex}
                total={queue.length}
                timeLeft={timeLeft}
                combo={combo}
                message={message}
                tick={tick}
                onAnswer={answer}
              />
            )}

            {phase === "result" && (
              <ResultPanel
                score={totalScore + (noMiss ? 700 : 0)}
                rank={rank}
                results={results}
                noMiss={noMiss}
                best={save.bestScore}
                onRestart={beginRun}
              />
            )}
          </div>

          <aside className="grid content-start gap-4">
            <InfoCard icon={<Trophy size={19} />} title="ランキング">
              <Ranking best={save.bestScore} current={totalScore} />
            </InfoCard>
            <InfoCard icon={<CalendarCheck size={19} />} title="デイリーミッション">
              <div className="space-y-2">
                {currentMissions.map((mission) => (
                  <StatusRow key={mission.label} label={mission.label} active={mission.done} />
                ))}
              </div>
            </InfoCard>
            <InfoCard icon={<Award size={19} />} title="実績">
              <div className="grid grid-cols-2 gap-2">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.label}
                    className={`rounded-md px-2 py-2 text-xs font-bold ${
                      achievement.check(save)
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {achievement.label}
                  </div>
                ))}
              </div>
            </InfoCard>
            <InfoCard icon={<ShoppingBag size={19} />} title="ショップ">
              <div className="space-y-2">
                {shopItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => buyItem(item.id, item.price)}
                    disabled={save.owned.includes(item.id) || save.coins < item.price}
                    className="tap-target flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-bold transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <span>{item.name}</span>
                    <span>{save.owned.includes(item.id) ? "所持中" : `${item.price} C`}</span>
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
    <div className="grid h-full content-between gap-6">
      <div className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg bg-[#102a43] p-6 text-white">
          <div className="mb-5 flex items-center gap-2 text-sm font-bold text-emerald-200">
            <Sparkles size={18} />
            今日のログインボーナス +30 C
          </div>
          <h2 className="text-4xl font-black tracking-normal sm:text-5xl">ひらめきを連続クリア</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-200">
            数字、色、記憶、計算、反射、運試しをランダムに出題。1 回 3 分ほどでスコアとランクを競えます。
          </p>
          <button
            onClick={onStart}
            className="tap-target mt-7 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-6 py-3 text-base font-black text-slate-950 shadow-lg transition hover:bg-emerald-300"
          >
            <Play size={20} fill="currentColor" />
            ゲーム開始
          </button>
        </div>

        <div className="grid gap-3">
          <Stat icon={<Crown size={19} />} label="自己ベスト" value={`${save.bestScore.toLocaleString()} pt`} />
          <Stat icon={<Zap size={19} />} label="レベル" value={`Lv ${level}`} />
          <Stat icon={<Gamepad2 size={19} />} label="プレイ回数" value={`${save.plays} 回`} />
          <Stat icon={<BadgeCheck size={19} />} label="正解数" value={`${save.totalCorrect} 問`} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {["簡単操作", "短時間", "ランダム出題", "成長要素"].map((label) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center font-black">
            {label}
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
  message,
  tick,
  onAnswer,
}: {
  game: MiniGame;
  index: number;
  total: number;
  timeLeft: number;
  combo: number;
  message: string;
  tick: number;
  onAnswer: (value: unknown) => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-emerald-600">
            {index + 1} / {total}
          </p>
          <h2 className="text-3xl font-black tracking-normal">{game.title}</h2>
          <p className="mt-1 text-slate-500">{game.instruction}</p>
        </div>
        <div className="flex gap-2">
          <Meter icon={<Timer size={18} />} value={timeLeft.toFixed(1)} />
          <Meter icon={<Zap size={18} />} value={`${combo} combo`} />
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${Math.max(0, (timeLeft / game.limit) * 100)}%` }}
        />
      </div>

      <div className="relative grid min-h-[360px] place-items-center rounded-lg bg-slate-50 p-4">
        {message && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-white/75 text-4xl font-black text-emerald-600">
            {message}
          </div>
        )}
        <GameSurface game={game} tick={tick} onAnswer={onAnswer} />
      </div>
    </div>
  );
}

function GameSurface({ game, tick, onAnswer }: { game: MiniGame; tick: number; onAnswer: (value: unknown) => void }) {
  if (game.kind === "number") {
    const numbers = game.payload.numbers as number[];
    const next = game.payload.next as number;
    return (
      <div className="grid w-full max-w-sm grid-cols-3 gap-3">
        {numbers.map((number) => (
          <button
            key={number}
            onClick={() => onAnswer(number)}
            className={`aspect-square rounded-lg text-3xl font-black shadow-sm transition ${
              number < next
                ? "bg-emerald-100 text-emerald-700"
                : "bg-white text-slate-900 hover:bg-emerald-50"
            }`}
          >
            {number}
          </button>
        ))}
      </div>
    );
  }

  if (game.kind === "color") {
    const options = game.payload.options as typeof palette;
    return (
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onAnswer(option.value)}
            className="tap-target h-28 rounded-lg border-4 border-white shadow-sm transition hover:scale-[1.02]"
            style={{ backgroundColor: option.value }}
            aria-label={option.name}
          />
        ))}
      </div>
    );
  }

  if (game.kind === "memory") {
    const options = game.payload.options as string[];
    const revealed = Date.now() < (game.payload.revealedUntil as number);
    return revealed ? (
      <div className="text-center">
        <div className="text-7xl font-black text-emerald-600">{game.payload.answer as string}</div>
        <p className="mt-3 font-bold text-slate-500">覚えてね</p>
      </div>
    ) : (
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onAnswer(option)}
            className="tap-target rounded-lg bg-white px-5 py-8 text-3xl font-black shadow-sm transition hover:bg-emerald-50"
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (game.kind === "math") {
    const options = game.payload.options as number[];
    return (
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onAnswer(option)}
            className="tap-target rounded-lg bg-white px-5 py-8 text-3xl font-black shadow-sm transition hover:bg-emerald-50"
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
        className={`tap-target h-44 w-44 rounded-full text-4xl font-black text-white shadow-soft transition ${
          ready ? "bg-emerald-500 hover:bg-emerald-400" : "bg-slate-400"
        }`}
      >
        {ready || tick < 0 ? "GO" : "WAIT"}
      </button>
    );
  }

  return (
    <div className="grid w-full max-w-md grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((index) => (
        <button
          key={index}
          onClick={() => onAnswer(index)}
          className="tap-target aspect-square rounded-lg bg-white text-4xl shadow-sm transition hover:bg-amber-50"
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
  onRestart,
}: {
  score: number;
  rank: string;
  results: GameResult[];
  noMiss: boolean;
  best: number;
  onRestart: () => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="rounded-lg bg-[#12372a] p-6 text-white">
        <div className="flex items-center gap-2 text-emerald-200">
          <Medal size={22} />
          <span className="font-black">結果発表</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-bold text-emerald-200">スコア</p>
            <p className="text-4xl font-black">{score.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-200">ランク</p>
            <p className="text-5xl font-black">{rank}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-200">自己ベスト</p>
            <p className="text-3xl font-black">{Math.max(best, score).toLocaleString()}</p>
          </div>
        </div>
        {noMiss && <p className="mt-4 font-black text-amber-200">ノーミスボーナス +700</p>}
        <button
          onClick={onRestart}
          className="tap-target mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-black text-slate-900 transition hover:bg-emerald-100"
        >
          <RotateCcw size={19} />
          もう一度
        </button>
      </div>

      <div className="grid gap-2">
        {results.map((result) => (
          <div key={result.game.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2 font-bold">
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
    ["世界", 9820],
    ["週間", 7340],
    ["今日", 6180],
    ["自己", Math.max(best, current)],
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
