import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useGameController } from "./app/useGameController";
import { seededRoll } from "./app/actions/minigameActions";
import type { LocationId, NpcId } from "./types/game";
import { ESCORT_READY_DRUNK_LEVEL, WARNING_LIMITS, warningMeter } from "./gameplay/progressionRules";
import { resolveBackgroundImage, resolveCharacterImage } from "./assets/AssetManifest";
import asswineIcon from "./assets/items/items_assswine.png";
import beansIcon from "./assets/items/items_beans.png";
import campusMapIcon from "./assets/items/items_campus_map.png";
import energyShotIcon from "./assets/items/items_energy_shot.png";
import handcuffsIcon from "./assets/items/items_fuzzy_handcuffs.png";
import glitterIcon from "./assets/items/items_glitter.png";
import meatIcon from "./assets/items/items_meat.png";
import scheduleIcon from "./assets/items/items_schedule.png";
import sludgeIcon from "./assets/items/items_sludge.png";
import stampIcon from "./assets/items/items_stamp.png";
import studentIdIcon from "./assets/items/student_id.png";
import warmBeerIcon from "./assets/items/items_warm_beer.png";
import whiskeyIcon from "./assets/items/items_whiskey.png";
import whistleIcon from "./assets/items/items_whistle.png";
import { ScenePanel } from "./components/game/ScenePanel";
import { PresenceBar } from "./components/game/PresenceBar";
import { BottomActionStrip } from "./components/game/BottomActionStrip";
import "./App.css";

type UiAction =
  | { type: "RESET_GAME" }
  | { type: "MOVE"; target: LocationId }
  | { type: "FORCE_MOVE"; target: LocationId }
  | { type: "START_DIALOGUE"; npcId: NpcId; auto?: boolean }
  | { type: "PLAY_BEER_PONG_SCORE"; cupsHit: number; matchup: BeerMatchup }
  | { type: "PLAY_BEER_PONG_SHOT"; shot: "safe" | "bank" | "hero" }
  | { type: "PLAY_LORE_RIDDLE"; answer: "315" | "quarter" | "midnight" }
  | { type: "PLAY_STRIP_POKER_ROUND" }
  | { type: "START_STRIP_POKER_SESSION" }
  | { type: "END_STRIP_POKER_SESSION" }
  | { type: "ASK_EGGMAN_QUIZ" }
  | { type: "DECLINE_EGGMAN_QUIZ" }
  | {
      type: "PLAY_EGGMAN_LAB_ROUND";
      catalyst: "red" | "green" | "blue";
      heat: "low" | "mid" | "high";
      stir: "pulse" | "steady" | "whip";
      scansUsed: number;
    }
  | { type: "PLAY_BEER_PONG_FRAT" }
  | { type: "PLAY_BEER_PONG_SONIC" }
  | { type: "PLAY_SOGGY_BISCUIT" }
  | { type: "SEARCH_DEAN_DESK" }
  | { type: "SEARCH_QUAD" }
  | { type: "SEARCH_EGGMAN_CLASSROOM" }
  | { type: "SEARCH_FRAT_HOUSE" }
  | { type: "SEARCH_SORORITY_HOUSE" }
  | { type: "SEARCH_TUNNEL" }
  | { type: "SEARCH_CAFETERIA" }
  | { type: "SEARCH_DORMS" }
  | { type: "SEARCH_DORM_ROOM" }
  | { type: "SEARCH_STADIUM" }
  | { type: "USE_CAMPUS_MAP" }
  | { type: "USE_GATE_STAMP" }
  | { type: "USE_MYSTERY_MEAT" }
  | { type: "USE_SECURITY_SCHEDULE" }
  | { type: "USE_RA_WHISTLE" }
  | { type: "GET_MYSTERY_MEAT" }
  | { type: "GET_SUPER_DEAN_BEANS" }
  | { type: "TAKE_FOUND_ITEM"; location: LocationId; item: string }
  | { type: "MIX_GLITTER_WARM_BEER" }
  | { type: "MIX_BEANS_WARM_BEER" }
  | { type: "USE_SUPER_DEAN_BEANS" }
  | { type: "USE_EXPIRED_ENERGY_SHOT" }
  | { type: "USE_WARM_BEER" }
  | { type: "USE_GLITTER_BOMB_BREW" }
  | { type: "USE_TURBO_SLUDGE" }
  | { type: "TRADE_THUNDERHEAD" }
  | { type: "ANSWER_THUNDERHEAD"; answer: string }
  | { type: "GIVE_WHISKEY" }
  | { type: "GIVE_ASSWINE" }
  | { type: "USE_FURRY_HANDCUFFS" }
  | { type: "USE_ITEM_ON_TARGET"; item: string; target: NpcId }
  | { type: "ESCORT_SONIC" }
  | { type: "STADIUM_ENTRY" }
  | { type: "GET_HINT" }
  | { type: "SUBMIT_DIALOGUE"; npcId: NpcId; input: string };

type ActionButtonDef = {
  key: string;
  label: string;
  action: UiAction;
  priority: number;
  group?: "immediate" | "move" | "use" | "risky";
  disabled?: boolean;
  badge?: string;
};

function titleCase(input: string): string {
  return input.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

type NoticeState = { title: string; body: string } | null;
type SearchLootState = { location: LocationId; message: string } | null;
type TopToastKind = "rumor" | "status";
type TopToastState = { id: string; text: string; kind: TopToastKind } | null;
const ITEM_HELP: Record<string, { desc: string; useHint: string; targetHint?: string; riskHint?: string }> = {
  "Student ID": { desc: "Campus clearance pass.", useHint: "Needed for key checks and entry." },
  "Dean Whiskey": { desc: "Heavy liquor stash.", useHint: "Use in Dorm Room to push Sonic up.", targetHint: "Target: Sonic in Dorm Room.", riskHint: "Carrying contraband can trigger warnings." },
  Asswine: { desc: "Thunderhead trade reward.", useHint: "Fast drunk boost in Dorm Room.", targetHint: "Target: Sonic in Dorm Room.", riskHint: "Trade setup costs time." },
  "Furry Handcuffs": { desc: "High-risk control item.", useHint: "Use on Sonic at drunk level 3+.", targetHint: "Target: Sonic when escort-ready.", riskHint: "Wrong target can hard-fail." },
  "Frat Bong": { desc: "High-risk contraband.", useHint: "Do not carry near enforcement.", riskHint: "Can cause confiscation or expulsion." },
  "Spare Socks": { desc: "Strip poker buffer.", useHint: "Burn to avoid one forfeit.", targetHint: "Target: Strip Poker side pot.", riskHint: "Single-use item." },
  "RA Whistle": { desc: "Fake authority tool.", useHint: "Best in Dorms to reduce Luigi pressure.", targetHint: "Target: Luigi pressure in residential lanes.", riskHint: "Using at Frat escalates fast." },
  "Lace Undies": { desc: "Sorority contraband.", useHint: "Top Thunderhead trade item.", targetHint: "Target: Thunderhead in Tunnel.", riskHint: "Getting caught means a ban." },
  "Sorority Mascara": { desc: "Sorority contraband.", useHint: "Valid Thunderhead trade item.", targetHint: "Target: Thunderhead in Tunnel.", riskHint: "Theft can trigger ejection + ban." },
  "Sorority Composite": { desc: "Sorority contraband.", useHint: "Valid Thunderhead trade item.", targetHint: "Target: Thunderhead in Tunnel.", riskHint: "High social penalty if caught." },
  "Hairbrush": { desc: "Low-value filler.", useHint: "Not valid for Thunderhead trade.", riskHint: "Bad trade wastes time." },
  "Warm Beer": { desc: "Mix base item.", useHint: "Use or mix in Dorm Room.", targetHint: "Target: Sonic or mix recipes.", riskHint: "Weak alone; best when mixed." },
  "Super Dean Beans": { desc: "Volatile ingredient.", useHint: "Mix for high-impact sludge.", targetHint: "Target: mix path in Dorm Room.", riskHint: "Can backfire hard." },
  "Expired Energy Shot": { desc: "High-variance stim.", useHint: "Use only when gambling.", targetHint: "Target: Sonic in Dorm Room.", riskHint: "Can lower progress and raise pressure." },
  "Glitter Flask": { desc: "Mix container.", useHint: "Needed for Glitter Bomb Brew.", targetHint: "Target: mix path.", riskHint: "No direct value alone." },
  "Glitter Bomb Brew": { desc: "Chaotic mixed drink.", useHint: "Use in Dorm Room for swingy gain.", targetHint: "Target: Sonic in Dorm Room.", riskHint: "Can spike Dean warning." },
  "Turbo Sludge": { desc: "Heavy mixed brew.", useHint: "Big spike attempt in Dorm Room.", targetHint: "Target: Sonic in Dorm Room.", riskHint: "Big backfire risk." },
  "Campus Map": { desc: "Route intel.", useHint: "Use to reveal search lanes.", targetHint: "Target: route planning.", riskHint: "Costs time to use." },
  "Lost Lanyard": { desc: "Early clue item.", useHint: "Minor hunt support.", targetHint: "Target: early progression.", riskHint: "Low late-game value." },
  "Lecture Notes": { desc: "Flavor intel scrap.", useHint: "Low impact utility.", riskHint: "Can clutter inventory." },
  "Remote Battery": { desc: "Minor utility part.", useHint: "Side item only.", riskHint: "No core route impact." },
  "Pocket Flashlight": { desc: "Tunnel helper.", useHint: "Minor tunnel support.", riskHint: "Low mission impact." },
  "Rusty Token": { desc: "Tunnel relic.", useHint: "Flavor-only pickup.", riskHint: "Low route value." },
  "Gate Stamp": { desc: "Gate credential.", useHint: "Use at Stadium; better with Student ID.", riskHint: "Without ID, can add Dean warning." },
  "Security Schedule": { desc: "Guard timing intel.", useHint: "Best used at Stadium.", targetHint: "Target: stadium timing and entry.", riskHint: "Using elsewhere burns time." },
  "Ping Pong Paddle": { desc: "Frat flavor item.", useHint: "Not required for progression.", riskHint: "Stealing can raise hostility." },
  "Party Wristband": { desc: "Frat trinket.", useHint: "Low impact utility.", riskHint: "Mostly inventory noise." },
  "Extra Sock": { desc: "Spare clothing scrap.", useHint: "Low impact backup item.", riskHint: "Minimal route value." },
  "Laundry Detergent": { desc: "Dorm supply.", useHint: "Low priority item.", riskHint: "Mostly inventory noise." },
  "Mystery Meat": { desc: "Cafeteria wildcard.", useHint: "Use on Sonic in Dorm Room.", riskHint: "Can help or backfire." }
};
const ITEM_ICONS: Partial<Record<string, string>> = {
  "Student ID": studentIdIcon,
  "Dean Whiskey": whiskeyIcon,
  Asswine: asswineIcon,
  "Furry Handcuffs": handcuffsIcon,
  "RA Whistle": whistleIcon,
  "Warm Beer": warmBeerIcon,
  "Super Dean Beans": beansIcon,
  "Expired Energy Shot": energyShotIcon,
  "Glitter Flask": glitterIcon,
  "Glitter Bomb Brew": glitterIcon,
  "Turbo Sludge": sludgeIcon,
  "Campus Map": campusMapIcon,
  "Gate Stamp": stampIcon,
  "Security Schedule": scheduleIcon,
  "Mystery Meat": meatIcon
};
const DEFAULT_ITEM_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#6e86ff"/>
        <stop offset="100%" stop-color="#3f4fb5"/>
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="104" height="104" rx="18" fill="url(#g)" stroke="#f7d66d" stroke-width="6"/>
    <circle cx="60" cy="44" r="16" fill="#f7d66d" opacity="0.92"/>
    <rect x="52" y="58" width="16" height="30" rx="7" fill="#f7d66d" opacity="0.92"/>
    <rect x="48" y="90" width="24" height="10" rx="5" fill="#f7d66d" opacity="0.92"/>
  </svg>`
)}`;
type PongBall = { x: number; y: number; vx: number; vy: number; spin: number; arc: number; active: boolean };
type PongCup = { x: number; y: number; r: number; hit: boolean; wobble: number; dip: number };
type SplashParticle = { x: number; y: number; vx: number; vy: number; life: number; size: number };
type HitText = { text: string; x: number; y: number; life: number };
type TrailPoint = { x: number; y: number; life: number };
type CupFlash = { x: number; y: number; life: number; maxR: number };
type BeerMatchup = "frat" | "sonic";
type BeerSummary = {
  cupsHit: number;
  throwsUsed: number;
  accuracy: number;
  perfectSinks: number;
  heat: number[];
  message: string;
  refillLeft: number;
} | null;
type BeerTauntState = {
  speaker: string;
  text: string;
};
type BeerRoundMemory = {
  cupsHit: number;
  accuracy: number;
  perfectSinks: number;
  won: boolean;
};
type LocationSplash = {
  locationId: LocationId;
  title: string;
  subtitle: string;
  occupants: string;
} | null;
type SoggySequenceStage = "mock" | null;
type StripCard = { rank: string; suit: string; value: number; code: string };
type StripPokerStage = "deal" | "dealing" | "showdown";
type StripOpponent = {
  name: string;
  cards: StripCard[];
  hand: string;
  isWinner: boolean;
};
type StripPokerDeal = {
  round: number;
  guestId: NpcId;
  opponentNpcIds: NpcId[];
  opponentNames: string[];
  playerCards: StripCard[];
  opponents: StripOpponent[];
  deckRemainder: StripCard[];
  selectedDiscard: number[];
  drawnCards: StripCard[];
  stage: StripPokerStage;
  playerHand: string;
  winningOpponentName: string;
  winningOpponentHand: string;
  edgeNote: string;
} | null;
type StripRiskMode = "safe" | "balanced" | "bluff";
type EggmanCatalyst = "red" | "green" | "blue";
type EggmanHeat = "low" | "mid" | "high";
type EggmanStir = "pulse" | "steady" | "whip";
type EggmanLabProtocol = { catalyst: EggmanCatalyst; heat: EggmanHeat; stir: EggmanStir };
type EggmanHintText = Partial<Record<keyof EggmanLabProtocol, string>>;
type EggmanLabFx = "perfect" | "good" | "fail" | "meltdown" | null;

const CARD_SUITS = ["♠", "♥", "♦", "♣"] as const;
const CARD_RANKS: Array<{ rank: string; value: number }> = [
  { rank: "2", value: 2 }, { rank: "3", value: 3 }, { rank: "4", value: 4 }, { rank: "5", value: 5 },
  { rank: "6", value: 6 }, { rank: "7", value: 7 }, { rank: "8", value: 8 }, { rank: "9", value: 9 },
  { rank: "10", value: 10 }, { rank: "J", value: 11 }, { rank: "Q", value: 12 }, { rank: "K", value: 13 },
  { rank: "A", value: 14 }
];
const STRIP_POKER_CLOTHING_STAKES = ["Shirt", "Pants", "Shoes", "Socks", "Underwear"] as const;
const EGGMAN_CATALYSTS: EggmanCatalyst[] = ["red", "green", "blue"];
const EGGMAN_HEATS: EggmanHeat[] = ["low", "mid", "high"];
const EGGMAN_STIRS: EggmanStir[] = ["pulse", "steady", "whip"];

function resolveEggmanProtocol(seed: string, round: number): EggmanLabProtocol {
  const catalyst = EGGMAN_CATALYSTS[Math.floor(seededRoll(`${seed}:eggman:${round}:catalyst`) * EGGMAN_CATALYSTS.length)];
  const heat = EGGMAN_HEATS[Math.floor(seededRoll(`${seed}:eggman:${round}:heat`) * EGGMAN_HEATS.length)];
  const stir = EGGMAN_STIRS[Math.floor(seededRoll(`${seed}:eggman:${round}:stir`) * EGGMAN_STIRS.length)];
  return { catalyst, heat, stir };
}
function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededFloat(input: string): number {
  return hashSeed(input) / 4294967295;
}

function shuffledDeck(seedKey: string): StripCard[] {
  const deck: StripCard[] = [];
  CARD_SUITS.forEach((suit) => {
    CARD_RANKS.forEach(({ rank, value }) => {
      deck.push({ rank, suit, value, code: `${rank}${suit}` });
    });
  });
  let seed = hashSeed(seedKey) || 1;
  for (let i = deck.length - 1; i > 0; i -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

function evalHand(cards: StripCard[]): { rank: number; name: string; high: number } {
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const counts = new Map<number, number>();
  sorted.forEach((c) => counts.set(c.value, (counts.get(c.value) ?? 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || (b[0] - a[0]));
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const values = [...new Set(sorted.map((c) => c.value))];
  const straight = values.length === 5 && (values[0] - values[4] === 4 || (values.join(",") === "14,5,4,3,2"));
  if (straight && flush) return { rank: 8, name: "Straight Flush", high: values[0] === 14 && values[1] === 5 ? 5 : values[0] };
  if (groups[0][1] === 4) return { rank: 7, name: "Four of a Kind", high: groups[0][0] };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { rank: 6, name: "Full House", high: groups[0][0] };
  if (flush) return { rank: 5, name: "Flush", high: sorted[0].value };
  if (straight) return { rank: 4, name: "Straight", high: values[0] === 14 && values[1] === 5 ? 5 : values[0] };
  if (groups[0][1] === 3) return { rank: 3, name: "Three of a Kind", high: groups[0][0] };
  if (groups[0][1] === 2 && groups[1][1] === 2) return { rank: 2, name: "Two Pair", high: Math.max(groups[0][0], groups[1][0]) };
  if (groups[0][1] === 2) return { rank: 1, name: "One Pair", high: groups[0][0] };
  return { rank: 0, name: "High Card", high: sorted[0].value };
}

function compareHands(a: StripCard[], b: StripCard[]): number {
  const ea = evalHand(a);
  const eb = evalHand(b);
  if (ea.rank !== eb.rank) return ea.rank - eb.rank;
  if (ea.high !== eb.high) return ea.high - eb.high;
  const sa = [...a].sort((x, y) => y.value - x.value).map((c) => c.value);
  const sb = [...b].sort((x, y) => y.value - x.value).map((c) => c.value);
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return sa[i] - sb[i];
  }
  return 0;
}

function cardSuitClass(card: StripCard): "suit-red" | "suit-black" {
  return card.suit === "♥" || card.suit === "♦" ? "suit-red" : "suit-black";
}

function removeCards(pool: StripCard[], cards: StripCard[]): StripCard[] {
  const removeSet = new Set(cards.map((c) => c.code));
  return pool.filter((c) => !removeSet.has(c.code));
}

function pickWinningHandFromPool(pool: StripCard[], playerCards: StripCard[], seedKey: string): StripCard[] | null {
  if (pool.length < 5) return null;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const shuffled = shuffledDeck(`${seedKey}:pick:${attempt}`).filter((c) => pool.some((p) => p.code === c.code));
    const candidate = shuffled.slice(0, 5);
    if (candidate.length < 5) continue;
    if (compareHands(candidate, playerCards) > 0) return candidate;
  }
  return null;
}

function App() {
  const PONG = {
    canvas: { w: 900, h: 560 },
    table: { x: 40, y: 124, w: 820, h: 396 },
    spawn: { x: 112, y: 468 },
    floorY: 520,
    cupRadius: 16
  };
  const BEER_GRAVITY = 0.16;
  const BEER_LAUNCH_SCALE = 0.145;
  const BEER_SPIN_ACCEL = 0.028;
  const { state, content, ready, performAction, getNpcsAtCurrentLocation } = useGameController();
  const [activeNpc, setActiveNpc] = useState<NpcId | null>(null);
  const [activeNpcFocusAtMs, setActiveNpcFocusAtMs] = useState(0);
  const [playerInput, setPlayerInput] = useState("");
  const [isAwaitingNpcReply, setIsAwaitingNpcReply] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [hudMenuOpen, setHudMenuOpen] = useState(false);
  const [beerGameOpen, setBeerGameOpen] = useState(false);
  const [stripPokerOpen, setStripPokerOpen] = useState(false);
  const [stripPokerDeal, setStripPokerDeal] = useState<StripPokerDeal>(null);
  const [stripPokerBusy, setStripPokerBusy] = useState(false);
  const [stripRiskMode, setStripRiskMode] = useState<StripRiskMode>("balanced");
  const [eggmanLabOpen, setEggmanLabOpen] = useState(false);
  const [eggmanLabBusy, setEggmanLabBusy] = useState(false);
  const [eggmanLabRound, setEggmanLabRound] = useState(1);
  const [eggmanScansLeft, setEggmanScansLeft] = useState(2);
  const [eggmanMix, setEggmanMix] = useState<EggmanLabProtocol>({ catalyst: "red", heat: "mid", stir: "steady" });
  const [eggmanScanHints, setEggmanScanHints] = useState<EggmanHintText>({});
  const [eggmanHeatValue, setEggmanHeatValue] = useState(50);
  const [eggmanStirPower, setEggmanStirPower] = useState(34);
  const [eggmanDoses, setEggmanDoses] = useState<Record<EggmanCatalyst, number>>({ red: 0, green: 0, blue: 0 });
  const [eggmanLabFx, setEggmanLabFx] = useState<EggmanLabFx>(null);
  const [beerAngle, setBeerAngle] = useState(48);
  const [beerPower, setBeerPower] = useState(62);
  const [beerThrowsLeft, setBeerThrowsLeft] = useState(3);
  const [beerCupsCleared, setBeerCupsCleared] = useState(0);
  const [beerInFlight, setBeerInFlight] = useState(false);
  const [draggingAim, setDraggingAim] = useState(false);
  const [draggingLauncher, setDraggingLauncher] = useState(false);
  const [launcherY, setLauncherY] = useState(468);
  const [beerCountdown, setBeerCountdown] = useState(0);
  const [beerSummary, setBeerSummary] = useState<BeerSummary>(null);
  const [beerTaunt, setBeerTaunt] = useState<BeerTauntState | null>(null);
  const [cupMetricPulse, setCupMetricPulse] = useState(false);
  const [shotMetricFlash, setShotMetricFlash] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [topToast, setTopToast] = useState<TopToastState>(null);
  const [searchLoot, setSearchLoot] = useState<SearchLootState>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [beerMatchup, setBeerMatchup] = useState<BeerMatchup>("frat");
  const [locationSplash, setLocationSplash] = useState<LocationSplash>(null);
  const [hintCooldownUntilMs, setHintCooldownUntilMs] = useState(0);
  const [showBeerLauncherTip, setShowBeerLauncherTip] = useState(false);
  const [beerPointerMode, setBeerPointerMode] = useState<"aim" | "launcher" | null>(null);
  const [beerControlStep, setBeerControlStep] = useState<"position" | "aim">("position");
  const [orientationAgendaOpen, setOrientationAgendaOpen] = useState(false);
  const [orientationAgendaName, setOrientationAgendaName] = useState("Student");
  const [campusMapOpen, setCampusMapOpen] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [landingClosing, setLandingClosing] = useState(false);
  const [soggySequenceStage, setSoggySequenceStage] = useState<SoggySequenceStage>(null);
  const [selectedActionItem, setSelectedActionItem] = useState<string | null>(null);
  const beerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const beerRafRef = useRef<number | null>(null);
  const beerBallRef = useRef<PongBall>({ x: 36, y: 152, vx: 0, vy: 0, spin: 0, arc: 0, active: false });
  const beerCupsRef = useRef<PongCup[]>([]);
  const beerTrailRef = useRef<TrailPoint[]>([]);
  const shotReplayRef = useRef<TrailPoint[]>([]);
  const splashParticlesRef = useRef<SplashParticle[]>([]);
  const hitTextsRef = useRef<HitText[]>([]);
  const cupFlashesRef = useRef<CupFlash[]>([]);
  const cupHeatRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const roundPerfectRef = useRef(0);
  const shakeUntilRef = useRef(0);
  const slowMotionUntilRef = useRef(0);
  const camPulseUntilRef = useRef(0);
  const camKickRef = useRef(0);
  const beerResolvingRef = useRef(false);
  const flickStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBounceAtRef = useRef(0);
  const cupNearPulseRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const prevLocationRef = useRef<LocationId | null>(null);
  const prevUnlockSnapshotRef = useRef<Record<string, boolean> | null>(null);
  const lastMissionIntakeEventRef = useRef<string>("");
  const lastRumorEventRef = useRef<string>("");
  const lastRumorToastAtRef = useRef(0);
  const toastQueueRef = useRef<Array<{ id: string; text: string; kind: TopToastKind }>>([]);
  const nextToastReadyAtRef = useRef(0);
  const suppressLocationSplashUntilRef = useRef(0);
  const lastForcedRelocationEventRef = useRef<string>("");
  const pendingForcedRelocationTargetRef = useRef<LocationId | null>(null);
  const latestForcedRelocationEvent = useMemo(
    () => [...(state?.world.events ?? [])].reverse().find((entry) => entry.startsWith("FORCED_RELOCATE::")) ?? "",
    [state?.world.events]
  );
  const beerTipSeenRef = useRef(false);
  const beerTauntSnapshotRef = useRef<{ cupsCleared: number; throwsLeft: number; inFlight: boolean } | null>(null);
  const beerTauntLastAtRef = useRef(0);
  const previousHudMetricsRef = useRef<{ cupsCleared: number; throwsUsed: number } | null>(null);
  const stripDealTimerRef = useRef<number | null>(null);
  const soggyTimersRef = useRef<number[]>([]);
  const beerRoundMemoryRef = useRef<Record<BeerMatchup, BeerRoundMemory | null>>({
    frat: null,
    sonic: null
  });
  const modeConfig = useMemo(() => ({
    frat: { label: "Frat Match", throws: 5, cupRadius: PONG.cupRadius, assistBlend: 0.3 },
    sonic: { label: "Sonic Match", throws: 5, cupRadius: PONG.cupRadius - 1.2, assistBlend: 0.14 }
  }), [PONG.cupRadius]);
  const activeMode = modeConfig[beerMatchup];
  const launcherBounds = useMemo(() => {
    const minY = PONG.table.y + 44;
    const maxY = PONG.floorY - 10;
    return { minY, maxY };
  }, [PONG.floorY, PONG.table.y]);
  const launchOrigin = useMemo(() => {
    const topInset = 40;
    const bottomInset = 8;
    const tl = { x: PONG.table.x + topInset, y: PONG.table.y };
    const bl = { x: PONG.table.x + bottomInset, y: PONG.table.y + PONG.table.h };
    const k = Math.max(0, Math.min(1, (launcherY - PONG.table.y) / PONG.table.h));
    const leftEdgeX = tl.x + ((bl.x - tl.x) * k);
    return { x: leftEdgeX + 16, y: launcherY };
  }, [PONG.table.h, PONG.table.x, PONG.table.y, launcherY]);

  const currentLocation = state?.player.location;
  const locationRecord = useMemo(
    () => content?.locations.find((l) => l.id === currentLocation),
    [content?.locations, currentLocation]
  );
  const sceneBackgroundImage = useMemo(
    () => (content ? resolveBackgroundImage(content.assetManifest, currentLocation ?? "quad") : ""),
    [content, currentLocation]
  );
  const isSoggySequenceActive = soggySequenceStage !== null;

  const runAction = useCallback(async (action: UiAction, silent = false) => {
    if (action.type !== "TAKE_FOUND_ITEM") {
      setSearchLoot(null);
    }
    setCampusMapOpen(false);
    const result = await performAction(action);
    if (!silent && action.type !== "SUBMIT_DIALOGUE" && action.type !== "START_DIALOGUE" && action.type !== "MOVE") {
      setNotice({
        title: result.ok ? "Done" : "Blocked",
        body: result.message
      });
    }
    return result;
  }, [performAction]);
  const openLandingPage = useCallback(() => {
    setLandingClosing(false);
    setShowLandingPage(true);
  }, []);
  const closeLandingPage = useCallback(async (mode: "continue" | "enroll") => {
    if (landingClosing) return;
    setLandingClosing(true);
    window.setTimeout(async () => {
      if (mode === "enroll") {
        await runAction({ type: "RESET_GAME" }, true);
      }
      setShowLandingPage(false);
      setLandingClosing(false);
    }, 230);
  }, [landingClosing, runAction]);
  const clearSoggyTimers = useCallback(() => {
    if (soggyTimersRef.current.length === 0) return;
    soggyTimersRef.current.forEach((id) => window.clearTimeout(id));
    soggyTimersRef.current = [];
  }, []);
  const runSoggySequence = useCallback(() => {
    if (isSoggySequenceActive) return;
    clearSoggyTimers();
    setSoggySequenceStage("mock");
    setActionMenuOpen(false);
    setHudMenuOpen(false);
    setNotice(null);
    const failTimer = window.setTimeout(() => {
      void (async () => {
        await runAction({ type: "PLAY_SOGGY_BISCUIT" }, true);
        setSoggySequenceStage(null);
        soggyTimersRef.current = [];
      })();
    }, 1900);
    soggyTimersRef.current = [failTimer];
  }, [clearSoggyTimers, isSoggySequenceActive, runAction]);
  const handleDialogueSubmit = useCallback(async (action: UiAction) => {
    if (action.type !== "SUBMIT_DIALOGUE") {
      return runAction(action);
    }
    const trimmed = action.input.trim();
    if (import.meta.env.DEV && /^\/refresh(\s+persona)?$/i.test(trimmed) && (action.npcId === "sonic" || action.npcId === "thunderhead")) {
      try {
        const response = await fetch("/api/dialogue/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character_id: action.npcId })
        });
        const payload = await response.json().catch(() => ({}));
        setNotice({
          title: response.ok ? "Persona Refreshed" : "Refresh Failed",
          body: response.ok
            ? `Cleared cached persona context for ${titleCase(action.npcId)}.`
            : String(payload?.message || "Unable to refresh persona cache.")
        });
      } catch {
        setNotice({
          title: "Refresh Failed",
          body: "Dev refresh endpoint unavailable"
        });
      }
      return { ok: true, message: "Persona refresh requested." };
    }
    return runAction(action);
  }, [runAction]);
  const submitDialogueLocked = useCallback(async (action: UiAction) => {
    if (action.type !== "SUBMIT_DIALOGUE") return handleDialogueSubmit(action);
    if (isAwaitingNpcReply) return { ok: false, message: "Waiting for NPC response." };
    setIsAwaitingNpcReply(true);
    try {
      return await handleDialogueSubmit(action);
    } finally {
      setIsAwaitingNpcReply(false);
    }
  }, [handleDialogueSubmit, isAwaitingNpcReply]);
  const isSearchAction = useCallback((action: UiAction): action is Extract<UiAction, { type:
    | "SEARCH_DEAN_DESK"
    | "SEARCH_QUAD"
    | "SEARCH_EGGMAN_CLASSROOM"
    | "SEARCH_FRAT_HOUSE"
    | "SEARCH_SORORITY_HOUSE"
    | "SEARCH_TUNNEL"
    | "SEARCH_CAFETERIA"
    | "SEARCH_DORMS"
    | "SEARCH_DORM_ROOM"
    | "SEARCH_STADIUM"
  }> => action.type.startsWith("SEARCH_"), []);
  const closeStripPokerSession = useCallback(async (withReaction = false) => {
    setStripPokerOpen(false);
    setStripPokerDeal(null);
    setStripPokerBusy(false);
    if (stripDealTimerRef.current !== null) {
      window.clearTimeout(stripDealTimerRef.current);
      stripDealTimerRef.current = null;
    }
    void (async () => {
      if (withReaction) {
        const losses = state?.world.minigames.stripPokerLosses ?? 0;
        const nextStake = STRIP_POKER_CLOTHING_STAKES[Math.min(losses, STRIP_POKER_CLOTHING_STAKES.length - 1)];
        await runAction({
          type: "SUBMIT_DIALOGUE",
          npcId: "sorority_girls",
          input: `__SYSTEM__:You left strip poker table after ${losses} losses and current stake ${nextStake}. Give a short in-character reaction.`
        }, true);
      }
      await runAction({ type: "END_STRIP_POKER_SESSION" }, true);
    })();
  }, [runAction, state?.world.minigames.stripPokerLosses]);

  const presentNpcsRaw = useMemo(() => (ready && state ? getNpcsAtCurrentLocation() : []), [ready, state, getNpcsAtCurrentLocation]);
  const isResolved = Boolean(state?.phase === "resolved");
  const beerThrowsTotal = activeMode.throws;
  const beerThrowsUsed = Math.max(0, beerThrowsTotal - beerThrowsLeft);
  const engagedNpc = activeNpc;
  const presentNpcs = useMemo(() => {
    if (!engagedNpc) return presentNpcsRaw;
    return presentNpcsRaw.includes(engagedNpc) ? presentNpcsRaw : [...presentNpcsRaw, engagedNpc];
  }, [engagedNpc, presentNpcsRaw]);
  const clockText = `${Math.floor((state?.timer.remainingSec ?? 0) / 60).toString().padStart(2, "0")}:${((state?.timer.remainingSec ?? 0) % 60).toString().padStart(2, "0")}`;
  const resolveNpcImage = useCallback((npc: NpcId) => {
    if (!content) return "";
    return resolveCharacterImage(content.assetManifest, npc, "neutral");
  }, [content]);
  const npcHasFreshLine = useCallback((npc: NpcId) => {
    if (!state) return false;
    const target = titleCase(npc).toLowerCase();
    const recent = state.dialogue.turns.slice(-2);
    return recent.some((turn) => {
      if (turn.speaker === "You") return false;
      const speakerA = (turn.displaySpeaker ?? "").toLowerCase();
      const speakerB = (turn.speaker ?? "").toLowerCase();
      return speakerA === target || speakerB === npc;
    });
  }, [state]);
  const focusNpcConversation = useCallback(async (npc: NpcId) => {
    if (isAwaitingNpcReply) return;
    setSearchLoot(null);
    setActiveNpcFocusAtMs(Date.now());
    setActiveNpc(npc);
    if (engagedNpc === npc) return;
    if (npcHasFreshLine(npc)) return;
    setIsAwaitingNpcReply(true);
    try {
      await runAction({ type: "START_DIALOGUE", npcId: npc }, true);
    } finally {
      setIsAwaitingNpcReply(false);
    }
  }, [engagedNpc, isAwaitingNpcReply, npcHasFreshLine, runAction]);
  const hintSignalStrong = useMemo(() => {
    if (!state) return false;
    if (state.timer.remainingSec < 180) return true;
    if (state.sonic.drunkLevel >= ESCORT_READY_DRUNK_LEVEL && !state.sonic.following) return true;
    if (state.sonic.drunkLevel < 2 && !state.routes.routeA.complete) return true;
    if (!state.player.inventory.includes("Dean Whiskey")) return true;
    if (!state.player.inventory.includes("Asswine") && !state.routes.routeC.complete) return true;
    return false;
  }, [state]);
  const hintCooldownSec = Math.max(0, Math.ceil((hintCooldownUntilMs - Date.now()) / 1000));
  const canUseHint = !isResolved && hintCooldownSec === 0 && hintSignalStrong;
  const hintButtonNote = isResolved
    ? "Run ended."
    : hintCooldownSec > 0
      ? `Hint ready in ${hintCooldownSec}s`
      : hintSignalStrong
        ? "Hint available."
        : "No urgent hint.";

  useEffect(() => {
    if (!beerGameOpen) {
      previousHudMetricsRef.current = null;
      setCupMetricPulse(false);
      setShotMetricFlash(false);
      return;
    }
    const previous = previousHudMetricsRef.current;
    if (!previous) {
      previousHudMetricsRef.current = { cupsCleared: beerCupsCleared, throwsUsed: beerThrowsUsed };
      return;
    }
    let cupTimer: number | null = null;
    let shotTimer: number | null = null;
    if (beerCupsCleared > previous.cupsCleared) {
      setCupMetricPulse(true);
      cupTimer = window.setTimeout(() => setCupMetricPulse(false), 260);
    }
    if (beerThrowsUsed > previous.throwsUsed) {
      setShotMetricFlash(true);
      shotTimer = window.setTimeout(() => setShotMetricFlash(false), 220);
    }
    previousHudMetricsRef.current = { cupsCleared: beerCupsCleared, throwsUsed: beerThrowsUsed };
    return () => {
      if (cupTimer !== null) window.clearTimeout(cupTimer);
      if (shotTimer !== null) window.clearTimeout(shotTimer);
    };
  }, [beerCupsCleared, beerGameOpen, beerThrowsUsed]);

  useEffect(() => {
    if (!state) return;
    if (activeNpc) return;
    if (state.player.location !== "dean_office") return;
    if (!state.world.presentNpcs.dean_office.includes("dean_cain")) return;
    if (state.dialogue.deanStage !== "intro_pending" && state.dialogue.deanStage !== "name_pending") return;
    setActiveNpc("dean_cain");
    // Keep initial dean greeting visible even if it was emitted pre-focus.
    setActiveNpcFocusAtMs(0);
  }, [activeNpc, state]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      const message = detail?.message || "Dialogue request validation failed.";
      setNotice({
        title: "Dialogue",
        body: message
      });
    };
    window.addEventListener("dialogue-validation-issue", handler as EventListener);
    return () => {
      window.removeEventListener("dialogue-validation-issue", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!state || !content) return;
    const current = state.player.location;
    if (prevLocationRef.current === null) {
      prevLocationRef.current = current;
      return;
    }
    if (prevLocationRef.current !== current) {
      setActiveNpc(null);
      setActiveNpcFocusAtMs(0);
      setPlayerInput("");
      if (Date.now() < suppressLocationSplashUntilRef.current) {
        prevLocationRef.current = current;
        return;
      }
      const locationTitle = content.locations.find((l) => l.id === current)?.name ?? titleCase(current);
      const occupants = state.world.presentNpcs[current];
      setLocationSplash({
        locationId: current,
        title: locationTitle,
        subtitle: "Now here",
        occupants: occupants.length > 0 ? occupants.map((npc) => titleCase(npc)).join(" • ") : "Quiet"
      });
      prevLocationRef.current = current;
    }
  }, [content, state]);

  useEffect(() => {
    if (!locationSplash) return;
    const id = window.setTimeout(() => setLocationSplash(null), 1800);
    return () => window.clearTimeout(id);
  }, [locationSplash]);

  useEffect(() => {
    if (!state) return;
    const latestEvent = state.world.events[state.world.events.length - 1] ?? "";
    if (!latestEvent.startsWith("MISSION_INTAKE::")) return;
    if (lastMissionIntakeEventRef.current === latestEvent) return;
    const [, rawName = "Student"] = latestEvent.split("::");
    setOrientationAgendaName(rawName || "Student");
    setOrientationAgendaOpen(true);
    lastMissionIntakeEventRef.current = latestEvent;
  }, [state]);

  useEffect(() => {
    if (!latestForcedRelocationEvent) return;
    if (lastForcedRelocationEventRef.current === latestForcedRelocationEvent) return;
    lastForcedRelocationEventRef.current = latestForcedRelocationEvent;
    const [, targetRaw = "quad", titleRaw = "Ejected", encodedBody = "You were removed from this location."] = latestForcedRelocationEvent.split("::");
    const target = targetRaw as LocationId;
    const title = titleRaw || "Ejected";
    const body = decodeURIComponent(encodedBody || "You were removed from this location.");
    setNotice({ title, body });
    pendingForcedRelocationTargetRef.current = target;
    setActiveNpc(null);
    setActiveNpcFocusAtMs(0);
    setPlayerInput("");
    suppressLocationSplashUntilRef.current = Date.now() + 2600;
    const relocateId = window.setTimeout(() => {
      void runAction({ type: "FORCE_MOVE", target }, true);
      pendingForcedRelocationTargetRef.current = null;
      window.setTimeout(() => setNotice(null), 500);
    }, 1800);
    return () => window.clearTimeout(relocateId);
  }, [latestForcedRelocationEvent, runAction]);

  const queueTopToast = useCallback((text: string, kind: TopToastKind) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (topToast && topToast.text === trimmed && topToast.kind === kind) return;
    const queuedLast = toastQueueRef.current[toastQueueRef.current.length - 1];
    if (queuedLast && queuedLast.text === trimmed && queuedLast.kind === kind) return;
    const item = { id: `${kind}:${Date.now()}:${Math.random().toString(16).slice(2, 7)}`, text: trimmed, kind };
    toastQueueRef.current.push(item);
    if (!topToast && Date.now() >= nextToastReadyAtRef.current) {
      const next = toastQueueRef.current.shift() ?? null;
      if (next) setTopToast(next);
    }
  }, [topToast]);

  useEffect(() => {
    if (!state) return;
    const latestEvent = state.world.events[state.world.events.length - 1] ?? "";
    if (!latestEvent.startsWith("Rumor update:")) return;
    if (latestEvent === lastRumorEventRef.current) return;
    lastRumorEventRef.current = latestEvent;
    const now = Date.now();
    if (now - lastRumorToastAtRef.current < 12000) return;
    const rumorLocation = latestEvent.toLowerCase().match(/around (.+?)\./)?.[1] ?? "";
    const playerLocationName = state.player.location.replace(/_/g, " ").toLowerCase();
    const sonicHere = (state.world.presentNpcs[state.player.location] ?? []).includes("sonic");
    const inSonicDialogue = activeNpc === "sonic";
    if (sonicHere && inSonicDialogue && rumorLocation && rumorLocation !== playerLocationName) {
      return;
    }
    lastRumorToastAtRef.current = now;
    queueTopToast(latestEvent, "rumor");
  }, [activeNpc, queueTopToast, state]);

  useEffect(() => {
    if (!state) return;
    const unlocks = state.world.actionUnlocks;
    const prev = prevUnlockSnapshotRef.current;
    if (!prev) {
      prevUnlockSnapshotRef.current = { ...unlocks };
      return;
    }
    const labels: Partial<Record<keyof typeof unlocks, string>> = {
      beerPongFrat: "Unlocked: Beer Pong (Frat)",
      beerPongSonic: "Unlocked: Challenge Sonic",
      searchDeanDesk: "Unlocked: Search Dean Desk",
      searchQuad: "Unlocked: Search Quad",
      searchEggmanClassroom: "Unlocked: Search Classroom",
      searchFratHouse: "Unlocked: Search Frat",
      searchSororityHouse: "Unlocked: Search Sorority",
      searchTunnel: "Unlocked: Search Tunnel",
      searchCafeteria: "Unlocked: Search Cafeteria",
      searchDorms: "Unlocked: Search Dorm Hall",
      tradeThunderhead: "Unlocked: Thunderhead Trade",
      giveWhiskey: "Unlocked: Give Whiskey",
      giveAsswine: "Unlocked: Give Asswine",
      escortSonic: "Unlocked: Escort Sonic",
      stadiumEntry: "Unlocked: Stadium Entry",
      searchStadium: "Unlocked: Search Gate"
    };
    const newlyUnlocked = (Object.keys(unlocks) as Array<keyof typeof unlocks>)
      .filter((key) => !prev[key] && unlocks[key])
      .map((key) => labels[key] ?? `${titleCase(key)} unlocked`);
    if (newlyUnlocked.length > 0) {
      queueTopToast(newlyUnlocked[0], "status");
    }
    prevUnlockSnapshotRef.current = { ...unlocks };
  }, [queueTopToast, state]);

  useEffect(() => {
    const suppressTopToast = Boolean(
      notice
      || orientationAgendaOpen
      || campusMapOpen
      || beerGameOpen
      || eggmanLabOpen
      || stripPokerOpen
      || searchLoot
      || locationSplash
      || isSoggySequenceActive
      || showLandingPage
      || landingClosing
    );
    if (suppressTopToast) return;
    if (!topToast) {
      if (Date.now() < nextToastReadyAtRef.current) return;
      const promoteId = window.setTimeout(() => {
        if (Date.now() < nextToastReadyAtRef.current) return;
        const next = toastQueueRef.current.shift() ?? null;
        if (next) setTopToast(next);
      }, 120);
      return () => window.clearTimeout(promoteId);
    }
    const id = window.setTimeout(() => {
      setTopToast(null);
      nextToastReadyAtRef.current = Date.now() + 500;
    }, topToast.kind === "rumor" ? 4600 : 3200);
    return () => window.clearTimeout(id);
  }, [beerGameOpen, campusMapOpen, eggmanLabOpen, isSoggySequenceActive, landingClosing, locationSplash, notice, orientationAgendaOpen, searchLoot, showLandingPage, stripPokerOpen, topToast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    beerTipSeenRef.current = window.localStorage.getItem("beerLauncherTipSeen") === "1";
  }, []);

  useEffect(() => {
    if (!beerGameOpen) return;
    if (beerTipSeenRef.current) return;
    setShowBeerLauncherTip(true);
    const hideId = window.setTimeout(() => {
      setShowBeerLauncherTip(false);
      beerTipSeenRef.current = true;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("beerLauncherTipSeen", "1");
      }
    }, 3200);
    return () => window.clearTimeout(hideId);
  }, [beerGameOpen]);

  useEffect(() => {
    if (beerGameOpen) return;
    setBeerPointerMode(null);
  }, [beerGameOpen]);

  useEffect(() => {
    const syncViewportMode = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 1024;
      const h = typeof window !== "undefined" ? window.innerHeight : 768;
      setIsCompactViewport(w < 430 || h < 760);
    };
    syncViewportMode();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", syncViewportMode);
      return () => window.removeEventListener("resize", syncViewportMode);
    }
    return undefined;
  }, []);

  const resetBeerPhysicsGame = useCallback((matchup?: BeerMatchup) => {
    const mode = modeConfig[matchup ?? beerMatchup];
    const centerY = PONG.table.y + (PONG.table.h / 2);
    const colGap = 31;
    const rowGap = 26;
    const cupRadius = mode.cupRadius;
    const topInset = 40;
    const bottomInset = 8;
    const tr = { x: PONG.table.x + PONG.table.w - topInset, y: PONG.table.y };
    const br = { x: PONG.table.x + PONG.table.w - bottomInset, y: PONG.table.y + PONG.table.h };
    const rightBoundaryAtY = (y: number) => {
      const k = Math.max(0, Math.min(1, (y - PONG.table.y) / PONG.table.h));
      return tr.x + ((br.x - tr.x) * k);
    };
    const backRowX = rightBoundaryAtY(centerY) - cupRadius - 2;
    const apexX = backRowX - (colGap * 2);
    const backTopY = centerY - (rowGap * 2);
    const backMidY = centerY;
    const backBotY = centerY + (rowGap * 2);
    const cups: PongCup[] = [
      // Rack at far/right edge. Apex points toward shooter (leftward).
      { x: apexX, y: centerY, r: cupRadius, hit: false, wobble: 0, dip: 0 },
      { x: apexX + colGap, y: centerY - rowGap, r: cupRadius, hit: false, wobble: 0, dip: 0 },
      { x: apexX + colGap, y: centerY + rowGap, r: cupRadius, hit: false, wobble: 0, dip: 0 },
      { x: rightBoundaryAtY(backTopY) - cupRadius - 2, y: backTopY, r: cupRadius, hit: false, wobble: 0, dip: 0 },
      { x: rightBoundaryAtY(backMidY) - cupRadius - 2, y: backMidY, r: cupRadius, hit: false, wobble: 0, dip: 0 },
      { x: rightBoundaryAtY(backBotY) - cupRadius - 2, y: backBotY, r: cupRadius, hit: false, wobble: 0, dip: 0 }
    ];
    beerCupsRef.current = cups;
    const defaultLauncherY = PONG.spawn.y;
    const launcherTopInset = 40;
    const launcherBottomInset = 8;
    const tl = { x: PONG.table.x + launcherTopInset, y: PONG.table.y };
    const bl = { x: PONG.table.x + launcherBottomInset, y: PONG.table.y + PONG.table.h };
    const kLaunch = Math.max(0, Math.min(1, (defaultLauncherY - PONG.table.y) / PONG.table.h));
    const launchX = tl.x + ((bl.x - tl.x) * kLaunch) + 16;
    setLauncherY(defaultLauncherY);
    beerBallRef.current = { x: launchX, y: defaultLauncherY, vx: 0, vy: 0, spin: 0, arc: 0, active: false };
    beerTrailRef.current = [];
    shotReplayRef.current = [];
    splashParticlesRef.current = [];
    hitTextsRef.current = [];
    cupFlashesRef.current = [];
    shakeUntilRef.current = 0;
    slowMotionUntilRef.current = 0;
    camPulseUntilRef.current = 0;
    camKickRef.current = 0;
    cupNearPulseRef.current = [0, 0, 0, 0, 0, 0];
    setBeerThrowsLeft(mode.throws);
    setBeerCupsCleared(0);
    roundPerfectRef.current = 0;
    setBeerInFlight(false);
    setDraggingAim(false);
    setDraggingLauncher(false);
    setBeerControlStep("position");
    setBeerAngle(20);
    setBeerPower(62);
  }, [PONG.spawn.y, PONG.table.h, PONG.table.w, PONG.table.x, PONG.table.y, beerMatchup, modeConfig]);

  const playPongTone = useCallback((freq: number, durationMs: number, type: OscillatorType = "triangle") => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioCtxRef.current = new Ctx();
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (durationMs / 1000));
    osc.start(now);
    osc.stop(now + (durationMs / 1000) + 0.02);
  }, []);

  const vibratePulse = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  }, []);

  useEffect(() => {
    if (!beerGameOpen) {
      setBeerCountdown(0);
      return;
    }
    if (beerCountdown <= 0) return;
    const id = window.setTimeout(() => {
      setBeerCountdown((prev) => Math.max(0, prev - 1));
    }, 500);
    return () => window.clearTimeout(id);
  }, [beerGameOpen, beerCountdown]);

  useEffect(() => {
    if (!beerGameOpen) return undefined;
    const canvas = beerCanvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const now = Date.now();
      const shakeActive = now < shakeUntilRef.current;
      const shakeX = shakeActive ? (Math.random() - 0.5) * 6 : 0;
      const shakeY = shakeActive ? (Math.random() - 0.5) * 4 : 0;
      if (now < camPulseUntilRef.current) {
        camKickRef.current = Math.max(camKickRef.current, 0.7);
      }
      camKickRef.current *= 0.88;
      const camScale = 1 + (camKickRef.current * 0.028);
      const framingScale = isCompactViewport ? 0.93 : 1;
      ctx.save();
      ctx.translate((w * 0.5) + shakeX, (h * 0.5) + shakeY);
      ctx.scale(camScale * framingScale, camScale * framingScale);
      ctx.translate(-(w * 0.5), -(h * 0.5));
      ctx.fillStyle = "#150f38";
      ctx.fillRect(0, 0, w, h);

      const t = PONG.table;
      const tableGrad = ctx.createLinearGradient(t.x, t.y, t.x, t.y + t.h);
      tableGrad.addColorStop(0, "#2da851");
      tableGrad.addColorStop(1, "#248a43");
      const topInset = 40;
      const bottomInset = 8;
      const tl = { x: t.x + topInset, y: t.y };
      const tr = { x: t.x + t.w - topInset, y: t.y };
      const br = { x: t.x + t.w - bottomInset, y: t.y + t.h };
      const bl = { x: t.x + bottomInset, y: t.y + t.h };
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fillStyle = tableGrad;
      ctx.fill();
      const glowDrift = Math.sin(now * 0.0012) * 0.5 + 0.5;
      const driftX = t.x + 120 + (glowDrift * (t.w - 240));
      const driftGrad = ctx.createRadialGradient(driftX, t.y + (t.h * 0.42), 14, driftX, t.y + (t.h * 0.42), 220);
      driftGrad.addColorStop(0, "rgba(255,255,255,0.12)");
      driftGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = driftGrad;
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.98)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = 2.6;
      const midLeft = { x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 };
      const midRight = { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 };
      const midTop = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
      const midBottom = { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(midLeft.x, midLeft.y);
      ctx.lineTo(midRight.x, midRight.y);
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.beginPath();
      ctx.moveTo(midTop.x, midTop.y + 3);
      ctx.lineTo(midBottom.x, midBottom.y - 3);
      ctx.stroke();
      const netY = t.y + (t.h / 2);
      ctx.fillStyle = "rgba(236,243,255,0.22)";
      ctx.fillRect(midLeft.x, netY - 3, midRight.x - midLeft.x, 6);
      ctx.strokeStyle = "rgba(255,255,255,0.86)";
      ctx.lineWidth = 1;
      for (let nx = midLeft.x + 8; nx < midRight.x - 4; nx += 10) {
        ctx.beginPath();
        ctx.moveTo(nx, netY - 3);
        ctx.lineTo(nx, netY + 3);
        ctx.stroke();
      }

      // Single curved predictive guide while aiming.
      if (!beerInFlight) {
        const vx0 = Math.cos((beerAngle * Math.PI) / 180) * (beerPower * BEER_LAUNCH_SCALE);
        const vy0 = -Math.sin((beerAngle * Math.PI) / 180) * (beerPower * BEER_LAUNCH_SCALE);
        const spin0 = beerBallRef.current.spin || 0;
        const arcPeak = Math.max(18, Math.min(62, (beerPower * 0.52)));
        ctx.beginPath();
        ctx.moveTo(launchOrigin.x, launchOrigin.y);
        for (let i = 1; i <= 20; i += 1) {
          const tStep = i * 1.0;
          const px = launchOrigin.x + (vx0 * tStep) + (0.5 * spin0 * BEER_SPIN_ACCEL * tStep * tStep);
          const baseY = launchOrigin.y + (vy0 * tStep) + (0.5 * BEER_GRAVITY * tStep * tStep);
          const progress = Math.max(0, Math.min(1, tStep / 20));
          const py = baseY - (Math.sin(progress * Math.PI) * arcPeak);
          if (py > (PONG.table.y + PONG.table.h + 8)) break;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(6, 28, 44, 0.42)";
        ctx.lineWidth = 5.4;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.strokeStyle = "rgba(186, 230, 255, 0.95)";
        ctx.lineWidth = 2.8;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draggable launch rail along back edge.
      if (!beerInFlight) {
        const topInset = 40;
        const bottomInset = 8;
        const railTopX = PONG.table.x + topInset + 18;
        const railBotX = PONG.table.x + bottomInset + 18;
        ctx.beginPath();
        ctx.moveTo(railTopX, launcherBounds.minY);
        ctx.lineTo(railBotX, launcherBounds.maxY);
        ctx.strokeStyle = "rgba(214, 229, 255, 0.36)";
        ctx.lineWidth = 3.2;
        ctx.stroke();
      }

      if (shotReplayRef.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shotReplayRef.current[0].x, shotReplayRef.current[0].y);
        for (let i = 1; i < shotReplayRef.current.length; i += 1) {
          ctx.lineTo(shotReplayRef.current[i].x, shotReplayRef.current[i].y);
        }
        const replayAlpha = Math.max(0.1, shotReplayRef.current[0].life);
        ctx.strokeStyle = `rgba(173, 220, 255, ${replayAlpha * 0.55})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      const refillSlide = beerCountdown > 0 ? (beerCountdown * 8) + (Math.sin(Date.now() * 0.012) * 2.5) : 0;
      beerCupsRef.current.forEach((cup, idx) => {
        const wobbleOffset = cup.wobble > 0 ? Math.sin((Date.now() * 0.03) + idx) * cup.wobble : 0;
        const dipOffset = cup.dip * 6.8;
        const idleDrift = !beerInFlight ? Math.sin((now * 0.0017) + (idx * 0.9)) * 0.45 : 0;
        const cx = cup.x + wobbleOffset;
        const cy = cup.y + dipOffset + refillSlide + idleDrift;
        ctx.beginPath();
        ctx.ellipse(cx, cy + (cup.r * 0.5), cup.r * 0.88, cup.r * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fill();

        // Single cohesive top-down cup style (rim + fill), avoids mismatched base shape.
        ctx.beginPath();
        ctx.arc(cx, cy, cup.r, 0, Math.PI * 2);
        ctx.fillStyle = cup.hit ? "rgba(110,110,120,0.36)" : "rgba(247, 66, 105, 0.95)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, cup.r - 3.2, 0, Math.PI * 2);
        ctx.fillStyle = cup.hit ? "rgba(84,84,96,0.45)" : "rgba(219, 33, 79, 0.96)";
        ctx.fill();
        if (!cup.hit) {
          ctx.beginPath();
          ctx.ellipse(cx, cy - 2.2, cup.r - 5.1, 3.4, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(250, 224, 78, 0.62)";
          ctx.fill();
          ctx.beginPath();
          const nearPulse = cupNearPulseRef.current[idx] ?? 0;
          ctx.ellipse(cx - 1.2, cy - 6.4, cup.r - 6.2, 1.55 + (nearPulse * 0.35), -0.06, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,255,255,${0.78 + (nearPulse * 0.22)})`;
          ctx.lineWidth = 1.35 + (nearPulse * 0.8);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, cup.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 229, 142, 0.95)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });

      beerTrailRef.current.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2 + (idx * 0.08), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,210,74,${Math.max(0.08, pt.life)})`;
        ctx.fill();
      });

      splashParticlesRef.current.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,248,255,${Math.max(0.06, p.life)})`;
        ctx.fill();
      });
      cupFlashesRef.current.forEach((flash) => {
        const ratio = 1 - flash.life;
        const r = 8 + (flash.maxR * ratio);
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212, 242, 255, ${Math.max(0.08, flash.life * 0.58)})`;
        ctx.lineWidth = 2.2 - (ratio * 1.2);
        ctx.stroke();
      });

      hitTextsRef.current.forEach((label) => {
        ctx.font = "bold 18px Comic Neue";
        ctx.fillStyle = `rgba(255,240,188,${Math.max(0.1, label.life)})`;
        ctx.strokeStyle = `rgba(40,20,84,${Math.max(0.1, label.life)})`;
        ctx.lineWidth = 3;
        ctx.strokeText(label.text, label.x, label.y);
        ctx.fillText(label.text, label.x, label.y);
      });

      // Dynamic height-based shadow keeps ball grounded visually.
      const sb = beerBallRef.current;
      const depthProgress = Math.max(0, Math.min(1, (sb.x - launchOrigin.x) / (PONG.table.w * 0.84)));
      const shadowRadiusX = 10.2 - (depthProgress * 3.2);
      const shadowRadiusY = 5 - (depthProgress * 1.7);
      const shadowAlpha = 0.31 - (depthProgress * 0.18);
      const shadowX = sb.active ? (sb.x + (sb.vx * 1.1)) : launchOrigin.x;
      const shadowY = sb.active ? Math.min(PONG.floorY + 4, sb.y + 6) : launchOrigin.y + 8;
      ctx.beginPath();
      ctx.ellipse(shadowX, shadowY, Math.max(2.8, shadowRadiusX), Math.max(1.6, shadowRadiusY), 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, shadowAlpha)})`;
      ctx.fill();

      const b = beerBallRef.current;
      if (b.active) {
        const zLift = Math.sin(depthProgress * Math.PI) * b.arc;
        const renderY = b.y - zLift;
        const scale = 1 - (depthProgress * 0.22);
        const r = 8 * scale;
        ctx.beginPath();
        ctx.arc(b.x + 1.5, renderY + 1.5, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, renderY, r, 0, Math.PI * 2);
        ctx.fillStyle = "#f9fbff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x - (r * 0.33), renderY - (r * 0.33), Math.max(1.1, r * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(launchOrigin.x + 2.1, launchOrigin.y + 2.1, 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(launchOrigin.x, launchOrigin.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#f9fbff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(launchOrigin.x - 2.4, launchOrigin.y - 2.4, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fill();
      }
      ctx.restore();
    };

    const step = () => {
      const b = beerBallRef.current;
      const now = Date.now();
      const timeScale = now < slowMotionUntilRef.current ? 0.45 : 1;
      if (b.active) {
        b.vy += BEER_GRAVITY * timeScale;
        b.vx += (b.spin * BEER_SPIN_ACCEL) * timeScale;
        b.x += b.vx * timeScale;
        b.y += b.vy * timeScale;
        b.vx *= (1 - (0.003 * timeScale));
        b.spin *= 0.996;
        beerTrailRef.current.push({ x: b.x, y: b.y, life: 0.7 });
        if (beerTrailRef.current.length > 18) beerTrailRef.current.shift();

        if (b.y >= PONG.floorY) {
          b.y = PONG.floorY;
          b.vy *= -0.45;
          b.vx *= 0.78;
          // Side-swipe spin bends the bounce lane.
          b.vx += b.spin * 0.95;
          b.spin *= 0.9;
          const now = Date.now();
          if (now - lastBounceAtRef.current > 90) {
            lastBounceAtRef.current = now;
            playPongTone(180 + (Math.abs(b.vx) * 25), 45, "square");
          }
          if (Math.abs(b.vy) < 1.2 && Math.abs(b.vx) < 0.6) {
            b.active = false;
            setBeerInFlight(false);
          }
        }
        if (b.x > (PONG.table.x + PONG.table.w + 30) || b.y > (PONG.table.y + PONG.table.h + 35) || b.x < (PONG.table.x - 30) || b.y < (PONG.table.y - 70)) {
          b.active = false;
          setBeerInFlight(false);
        }

        beerCupsRef.current.forEach((cup, idx) => {
          if (cup.hit || !b.active) return;
          const dx = b.x - cup.x;
          const dy = b.y - cup.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= cup.r + 16 && dist > cup.r + 6) {
            cupNearPulseRef.current[idx] = Math.max(cupNearPulseRef.current[idx] ?? 0, 1);
          }
          if (dist <= cup.r + 6) {
            const wasPerfect = dist <= (cup.r * 0.42);
            cup.hit = true;
            cup.wobble = 7;
            cup.dip = 1;
            beerCupsRef.current.forEach((other) => {
              if (!other.hit) {
                other.wobble = Math.max(other.wobble, 2.5);
                other.dip = Math.max(other.dip, 0.25);
              }
            });
            const droplets: SplashParticle[] = Array.from({ length: 22 }).map((_, i) => ({
              x: cup.x,
              y: cup.y - 2,
              vx: (Math.cos((Math.PI * 2 * i) / 22) * (0.9 + Math.random() * 1.5)),
              vy: -1.6 - (Math.random() * 2.2),
              life: 0.95,
              size: 1.2 + Math.random() * 2.2
            }));
            splashParticlesRef.current.push(...droplets);
            if (splashParticlesRef.current.length > 140) {
              splashParticlesRef.current = splashParticlesRef.current.slice(-140);
            }
            cupFlashesRef.current.push({ x: cup.x, y: cup.y, life: 1, maxR: cup.r + 18 });
            if (cupFlashesRef.current.length > 18) cupFlashesRef.current.shift();
            shakeUntilRef.current = Date.now() + 130;
            hitTextsRef.current.push({
              text: wasPerfect ? "PERFECT SINK!" : "SINK!",
              x: cup.x - 42,
              y: cup.y - 18,
              life: 0.98
            });
            if (wasPerfect) {
              slowMotionUntilRef.current = Date.now() + 340;
              playPongTone(560, 120, "triangle");
              roundPerfectRef.current += 1;
              vibratePulse([24, 20, 18]);
            } else {
              vibratePulse(16);
            }
            camPulseUntilRef.current = Date.now() + 130;
            b.active = false;
            setBeerInFlight(false);
            camKickRef.current = Math.max(camKickRef.current, 0.55);
            cupHeatRef.current[idx] = (cupHeatRef.current[idx] ?? 0) + 1;
            setBeerCupsCleared((prev) => prev + 1);
            playPongTone(420, 90, "triangle");
          }
        });
      }
      splashParticlesRef.current = splashParticlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.12,
          vx: p.vx * 0.98,
          life: p.life * 0.94
        }))
        .filter((p) => p.life > 0.08 && p.y < 230);
      beerTrailRef.current = beerTrailRef.current
        .map((pt) => ({ ...pt, life: pt.life * 0.92 }))
        .filter((pt) => pt.life > 0.08);
      shotReplayRef.current = shotReplayRef.current
        .map((pt) => ({ ...pt, life: pt.life * 0.985 }))
        .filter((pt) => pt.life > 0.08);
      hitTextsRef.current = hitTextsRef.current
        .map((label) => ({ ...label, y: label.y - 0.22, life: label.life * 0.92 }))
        .filter((label) => label.life > 0.08);
      cupFlashesRef.current = cupFlashesRef.current
        .map((flash) => ({ ...flash, life: flash.life * 0.88 }))
        .filter((flash) => flash.life > 0.08);
      cupNearPulseRef.current = cupNearPulseRef.current.map((v) => Math.max(0, v * 0.86));
      beerCupsRef.current.forEach((cup) => {
        cup.wobble *= 0.86;
        cup.dip *= 0.82;
      });
      draw();
      beerRafRef.current = window.requestAnimationFrame(step);
    };

    beerRafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (beerRafRef.current !== null) window.cancelAnimationFrame(beerRafRef.current);
      beerRafRef.current = null;
    };
  }, [beerGameOpen, beerAngle, beerPower, isCompactViewport, launchOrigin.x, launchOrigin.y, launcherBounds.maxY, launcherBounds.minY, playPongTone, vibratePulse, PONG.floorY, PONG.table.h, PONG.table.w, PONG.table.x, PONG.table.y]);

  const launchBeerBall = useCallback((override?: { angle: number; power: number; spin?: number }) => {
    if (beerInFlight || beerThrowsLeft <= 0 || beerCountdown > 0) return;
    const angle = override?.angle ?? beerAngle;
    let power = override?.power ?? beerPower;
    let finalAngle = angle;
    const round = state?.world.minigames.globalRound ?? 0;
    const cups = beerCupsRef.current.filter((cup) => !cup.hit);
    if (round < 3 && cups.length > 0) {
      const target = cups.reduce((acc, cup) => ({ x: acc.x + cup.x, y: acc.y + cup.y }), { x: 0, y: 0 });
      const tx = target.x / cups.length;
      const ty = target.y / cups.length;
      const dx = tx - launchOrigin.x;
      const dy = launchOrigin.y - ty;
      const helperAngle = Math.max(-18, Math.min(62, (Math.atan2(dy, dx) * 180) / Math.PI));
      finalAngle = (finalAngle * (1 - activeMode.assistBlend)) + (helperAngle * activeMode.assistBlend);
      power = Math.min(95, power * 1.06);
    }
    const rad = (finalAngle * Math.PI) / 180;
    beerBallRef.current = {
      x: launchOrigin.x,
      y: launchOrigin.y,
      vx: Math.cos(rad) * (power * BEER_LAUNCH_SCALE),
      vy: -Math.sin(rad) * (power * BEER_LAUNCH_SCALE),
      spin: override?.spin ?? 0,
      arc: Math.max(18, Math.min(62, (power * 0.52))),
      active: true
    };
    {
      const vx0 = Math.cos(rad) * (power * BEER_LAUNCH_SCALE);
      const vy0 = -Math.sin(rad) * (power * BEER_LAUNCH_SCALE);
      const arcPeak = Math.max(18, Math.min(62, (power * 0.52)));
      const points: TrailPoint[] = [];
      for (let i = 1; i <= 24; i += 1) {
        const tStep = i * 0.95;
        const px = launchOrigin.x + (vx0 * tStep);
        const baseY = launchOrigin.y + (vy0 * tStep) + (0.5 * BEER_GRAVITY * tStep * tStep);
        const progress = Math.max(0, Math.min(1, (px - launchOrigin.x) / (PONG.table.w * 0.84)));
        const py = baseY - (Math.sin(progress * Math.PI) * arcPeak);
        if (py > (PONG.table.y + PONG.table.h + 6)) break;
        points.push({ x: px, y: py, life: 1 });
      }
      shotReplayRef.current = points;
    }
    setBeerInFlight(true);
    setBeerThrowsLeft((prev) => Math.max(0, prev - 1));
    setBeerControlStep("position");
    playPongTone(250 + (power * 1.2), 55, "sawtooth");
    camPulseUntilRef.current = Date.now() + 90;
    camKickRef.current = Math.max(camKickRef.current, 1);
  }, [activeMode.assistBlend, beerAngle, beerCountdown, beerInFlight, beerPower, beerThrowsLeft, launchOrigin.x, launchOrigin.y, playPongTone, state?.world.minigames.globalRound, PONG.table.h, PONG.table.w, PONG.table.y]);

  const buildBeerTaunt = useCallback((
    matchup: BeerMatchup,
    event: "opening" | "sink" | "miss" | "clutch" | "idle",
    cupsCleared: number,
    throwsLeft: number
  ): BeerTauntState => {
    const memory = beerRoundMemoryRef.current[matchup];
    const priorRoundPool = matchup === "sonic"
      ? memory?.won
        ? [
            { speaker: "Sonic", text: `Last round you hit ${memory.cupsHit} cups. Don't get emotionally attached to competence.` },
            { speaker: "Sonic", text: `You're coming off ${memory.accuracy}% accuracy. Annoying, but noted.` }
          ]
        : [
            { speaker: "Sonic", text: `You went ${memory?.cupsHit ?? 0} cups last round. Redemption arc starts now.` },
            { speaker: "Sonic", text: "Last game was rough. Try aiming at cups this time." }
          ]
      : memory?.won
        ? [
            { speaker: "Diesel", text: `You just posted ${memory.cupsHit} cups. Run it back.` },
            { speaker: "Provolone Toney", text: `Previous round was ${memory.accuracy}% accuracy. Pressure's on now.` }
          ]
        : [
            { speaker: "Provolone Toney", text: "Last round you blinked. Don't blink this one." },
            { speaker: "Diesel", text: `Reset. Last game was ${memory?.cupsHit ?? 0} cups. Earn your bounce-back.` }
          ];

    const sonicByEvent: Record<string, BeerTauntState[]> = {
      opening: [
        ...(priorRoundPool || []),
        { speaker: "Sonic", text: "Rack's live. Impress me or at least entertain me." },
        { speaker: "Sonic", text: "We doing this? Cool. Keep the arc clean." }
      ],
      sink: [
        { speaker: "Sonic", text: "Clean sink. Hate that for me." },
        { speaker: "Sonic", text: "Okay, that one had sauce." },
        { speaker: "Sonic", text: "Nice cup. Don't start celebrating yet." }
      ],
      miss: [
        { speaker: "Sonic", text: "That ball had no plan." },
        { speaker: "Sonic", text: "You just passed to the floor. Bold strategy." },
        { speaker: "Sonic", text: "Miss like that again and I'm charging tuition." }
      ],
      clutch: [
        { speaker: "Sonic", text: "Final shots. Hero mode or apology mode, choose." },
        { speaker: "Sonic", text: "Clutch window. Don't turn this into a cautionary tale." },
        { speaker: "Sonic", text: "Pressure time. Keep your mechanics out of the group-project tier." }
      ],
      idle: [
        { speaker: "Sonic", text: "Whenever you're ready, professor arc-shot." },
        { speaker: "Sonic", text: "I've seen slower setups, but only in admin offices." }
      ]
    };
    const fratByEvent: Record<string, BeerTauntState[]> = {
      opening: [
        ...(priorRoundPool || []),
        { speaker: "Diesel", text: "Cups are set. Bring execution." },
        { speaker: "Frat Boys", text: "Rack up. Talk down." }
      ],
      sink: [
        { speaker: "Diesel", text: "That's one. Keep stacking." },
        { speaker: "Provolone Toney", text: "Okay, that release wasn't tragic." },
        { speaker: "Provolone Toney", text: "There it is. Real shot shape." }
      ],
      miss: [
        { speaker: "Provolone Toney", text: "You threw that like a resignation letter." },
        { speaker: "Diesel", text: "Miss noted. Next rep cleaner." },
        { speaker: "Provolone Toney", text: "That arc looked nervous." }
      ],
      clutch: [
        { speaker: "Diesel", text: "Last throws. Stay composed." },
        { speaker: "Provolone Toney", text: "Clutch reps now. No tourist energy." },
        { speaker: "Provolone Toney", text: "Hit this and I stop doubting your form." }
      ],
      idle: [
        { speaker: "Frat Boys", text: "Crowd's waiting. Send it." },
        { speaker: "Diesel", text: "Take your read and launch." }
      ]
    };
    const pool = matchup === "sonic" ? sonicByEvent[event] : fratByEvent[event];
    const idx = Math.abs((cupsCleared * 7) + (throwsLeft * 5) + event.length + (matchup === "sonic" ? 1 : 0)) % pool.length;
    return pool[idx];
  }, []);

  useEffect(() => {
    if (!beerGameOpen) {
      setBeerTaunt(null);
      beerTauntSnapshotRef.current = null;
      return;
    }
    const now = Date.now();
    const previous = beerTauntSnapshotRef.current;
    const openedFresh = previous === null;
    let event: "opening" | "sink" | "miss" | "clutch" | "idle" = "idle";

    if (openedFresh) {
      event = "opening";
      beerTauntLastAtRef.current = 0;
    } else if (beerCupsCleared > previous.cupsCleared) {
      event = "sink";
    } else if (beerThrowsLeft < previous.throwsLeft && !beerInFlight && beerCupsCleared === previous.cupsCleared) {
      event = "miss";
    } else if (beerThrowsLeft <= 1 && !beerInFlight) {
      event = "clutch";
    } else if (now - beerTauntLastAtRef.current >= 2900 && !beerInFlight) {
      event = "idle";
    } else {
      beerTauntSnapshotRef.current = { cupsCleared: beerCupsCleared, throwsLeft: beerThrowsLeft, inFlight: beerInFlight };
      return;
    }

    setBeerTaunt(buildBeerTaunt(beerMatchup, event, beerCupsCleared, beerThrowsLeft));
    beerTauntLastAtRef.current = now;
    beerTauntSnapshotRef.current = { cupsCleared: beerCupsCleared, throwsLeft: beerThrowsLeft, inFlight: beerInFlight };
  }, [beerCupsCleared, beerGameOpen, beerInFlight, beerMatchup, beerThrowsLeft, buildBeerTaunt]);

  const applyAimFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = beerCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    const dx = px - launchOrigin.x;
    const dy = launchOrigin.y - py;
    const angle = Math.max(-18, Math.min(62, (Math.atan2(dy, dx) * 180) / Math.PI));
    const power = Math.max(38, Math.min(95, Math.hypot(dx, dy) * 0.85));
    setBeerAngle(angle);
    setBeerPower(power);
  }, [launchOrigin.x, launchOrigin.y]);

  const updateLauncherFromPointer = useCallback((clientY: number) => {
    const canvas = beerCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    const clamped = Math.max(launcherBounds.minY, Math.min(launcherBounds.maxY, py));
    setLauncherY(clamped);
  }, [launcherBounds.maxY, launcherBounds.minY]);

  const flickToLaunch = useCallback((endClientX: number, endClientY: number) => {
    const canvas = beerCanvasRef.current;
    const start = flickStartRef.current;
    if (!canvas || !start) {
      launchBeerBall();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const sx = ((start.x - rect.left) / rect.width) * canvas.width;
    const sy = ((start.y - rect.top) / rect.height) * canvas.height;
    const ex = ((endClientX - rect.left) / rect.width) * canvas.width;
    const ey = ((endClientY - rect.top) / rect.height) * canvas.height;
    const dx = ex - sx;
    const dy = sy - ey;
    const dist = Math.hypot(dx, dy);
    const dt = Math.max(8, Date.now() - start.t);
    const speed = dist / dt;
    if (dist < 10 && speed < 0.35) {
      return;
    }
    const angle = Math.max(-18, Math.min(62, (Math.atan2(dy, dx) * 180) / Math.PI));
    const basePower = Math.hypot(dx, dy) * 0.78;
    const velocityBonus = speed * 52;
    const power = Math.max(40, Math.min(95, basePower + velocityBonus));
    const spin = Math.max(-1.4, Math.min(1.4, (dx / Math.max(24, dist)) * (0.9 + (speed * 6))));
    setBeerAngle(angle);
    setBeerPower(power);
    launchBeerBall({ angle, power, spin });
  }, [launchBeerBall]);

  const localBeerRoundBlurb = useCallback((cupsHit: number): string => {
    if (cupsHit >= 6) return "Perfect sweep. Crowd goes feral.";
    if (cupsHit >= 4) return "Strong round. You controlled the table.";
    if (cupsHit >= 2) return "Solid round. You kept momentum.";
    return "Cold round. Table pressure spikes.";
  }, []);

  const startStripPokerRound = useCallback((opponentNpcIds: NpcId[], round: number) => {
    const trimmedOpponents = [...new Set(opponentNpcIds)].slice(0, 4);
    const guestId = trimmedOpponents[0] ?? "sorority_girls";
    const seedRoot = `${state?.meta.seed ?? "seed"}:strip:${trimmedOpponents.join(",")}:${round}`;
    const deck = shuffledDeck(seedRoot);
    const playerCards = deck.slice(0, 5);
    const deckRemainder = deck.slice(5);
    setStripPokerDeal({
      round,
      guestId,
      opponentNpcIds: trimmedOpponents,
      opponentNames: trimmedOpponents.map((npcId) => titleCase(npcId)),
      playerCards,
      opponents: [],
      deckRemainder,
      selectedDiscard: [],
      drawnCards: [],
      stage: "deal",
      playerHand: evalHand(playerCards).name,
      winningOpponentName: "",
      winningOpponentHand: "",
      edgeNote: "Pick up to 3 cards to discard. Strategy: Balanced."
    });
  }, [state?.meta.seed]);

  const toggleStripDiscard = useCallback((idx: number) => {
    setStripPokerDeal((prev) => {
      if (!prev || prev.stage !== "deal") return prev;
      const exists = prev.selectedDiscard.includes(idx);
      if (exists) {
        return { ...prev, selectedDiscard: prev.selectedDiscard.filter((v) => v !== idx) };
      }
      if (prev.selectedDiscard.length >= 3) return prev;
      return { ...prev, selectedDiscard: [...prev.selectedDiscard, idx] };
    });
  }, []);

  const drawStripPokerCards = useCallback(() => {
    setStripPokerBusy(true);
    setStripPokerDeal((prev) => {
      if (!prev || prev.stage !== "deal") return prev;
      const nextPlayer = [...prev.playerCards];
      const drawnCards: StripCard[] = [];
      let cursor = 0;
      prev.selectedDiscard.slice(0, 3).forEach((slot) => {
        const replacement = prev.deckRemainder[cursor];
        if (replacement) {
          nextPlayer[slot] = replacement;
          drawnCards.push(replacement);
          cursor += 1;
        }
      });
      const remainingDeck = prev.deckRemainder.slice(cursor);
      const playerEval = evalHand(nextPlayer);
      const opponentNames = prev.opponentNames.length > 0 ? prev.opponentNames : [titleCase(prev.guestId)];
      let opponentPool = [...remainingDeck];
      const forceChance = stripRiskMode === "safe" ? 0.58 : stripRiskMode === "bluff" ? 0.76 : 0.68;
      const shouldForceWinner = seededFloat(`${state?.meta.seed ?? "seed"}:strip:force-roll:${prev.guestId}:${prev.round}:${stripRiskMode}`) <= forceChance;
      const forcedWinner = shouldForceWinner
        ? pickWinningHandFromPool(opponentPool, nextPlayer, `${state?.meta.seed ?? "seed"}:strip:force:${prev.guestId}:${prev.round}:${stripRiskMode}`)
        : null;
      const opponents: StripOpponent[] = [];
      if (forcedWinner) {
        const forcedEval = evalHand(forcedWinner);
        opponents.push({
          name: opponentNames[0],
          cards: forcedWinner,
          hand: forcedEval.name,
          isWinner: true
        });
        opponentPool = removeCards(opponentPool, forcedWinner);
      }
      for (let i = opponents.length; i < opponentNames.length; i += 1) {
        const cards = opponentPool.slice(0, 5);
        opponentPool = opponentPool.slice(5);
        const hand = evalHand(cards).name;
        opponents.push({
          name: opponentNames[i],
          cards,
          hand,
          isWinner: false
        });
      }
      const winners = opponents.filter((opp) => compareHands(opp.cards, nextPlayer) > 0);
      const winnerSet = new Set(winners.map((w) => w.name));
      const resolvedOpponents = opponents.map((opp) => ({
        ...opp,
        isWinner: winnerSet.has(opp.name)
      }));
      const strongest = winners.length > 0
        ? winners.sort((a, b) => compareHands(a.cards, b.cards)).at(-1)
        : resolvedOpponents[0];
      const strongestEval = strongest ? evalHand(strongest.cards) : null;
      const rankGap = Math.max(0, (strongestEval?.rank ?? 0) - playerEval.rank);
      const telemetryHint = rankGap >= 2
        ? "Telemetry: table is hot; switch to Safe next hand."
        : rankGap === 1
          ? "Telemetry: close loss; Balanced line is stable."
          : "Telemetry: window open; Bluff line can pressure the table.";
      const edgeNote = strongest && strongestEval
        ? strongestEval.rank === playerEval.rank
          ? `${strongest.name} ties your hand class and wins on kicker. ${telemetryHint}`
          : strongestEval.rank >= playerEval.rank + 2
            ? `${strongest.name} jumps two tiers ahead at showdown. ${telemetryHint}`
            : `${strongest.name} edges your hand by one tier. ${telemetryHint}`
        : `House edge holds. ${telemetryHint}`;
      return {
        ...prev,
        playerCards: nextPlayer,
        opponents: resolvedOpponents,
        deckRemainder: opponentPool,
        drawnCards,
        stage: "dealing",
        playerHand: playerEval.name,
        winningOpponentName: strongest?.name ?? "Table",
        winningOpponentHand: strongestEval?.name ?? "High Card",
        edgeNote
      };
    });
  }, [state?.meta.seed, stripRiskMode]);

  const autoPickStripDiscards = useCallback((mode: StripRiskMode) => {
    setStripRiskMode(mode);
    setStripPokerDeal((prev) => {
      if (!prev || prev.stage !== "deal") return prev;
      const sortedByValue = prev.playerCards
        .map((card, idx) => ({ idx, value: card.value }))
        .sort((a, b) => a.value - b.value);
      const counts = new Map<number, number>();
      prev.playerCards.forEach((c) => counts.set(c.value, (counts.get(c.value) ?? 0) + 1));
      let picks: number[];
      if (mode === "safe") {
        picks = sortedByValue
          .filter(({ idx, value }) => (counts.get(prev.playerCards[idx].value) ?? 0) < 2 && value < 11)
          .slice(0, 2)
          .map(({ idx }) => idx);
      } else if (mode === "bluff") {
        picks = sortedByValue.slice(0, 3).map(({ idx }) => idx);
      } else {
        picks = sortedByValue
          .filter(({ idx }) => (counts.get(prev.playerCards[idx].value) ?? 0) < 2)
          .slice(0, 3)
          .map(({ idx }) => idx);
      }
      return { ...prev, selectedDiscard: picks };
    });
  }, []);

  const openEggmanLab = useCallback(() => {
    const round = (state?.world.minigames.loreRound ?? 0) + 1;
    setEggmanLabRound(round);
    setEggmanScansLeft(2);
    setEggmanMix({ catalyst: "red", heat: "mid", stir: "steady" });
    setEggmanScanHints({});
    setEggmanHeatValue(50);
    setEggmanStirPower(34);
    setEggmanDoses({ red: 0, green: 0, blue: 0 });
    setEggmanLabFx(null);
    setEggmanLabBusy(false);
    setEggmanLabOpen(true);
  }, [state?.world.minigames.loreRound]);

  const runEggmanScan = useCallback((slot: keyof EggmanLabProtocol) => {
    if (!state) return;
    if (eggmanScansLeft <= 0) return;
    const protocol = resolveEggmanProtocol(state.meta.seed, eggmanLabRound);
    const hintBySlot: Record<keyof EggmanLabProtocol, string> = {
      catalyst: protocol.catalyst === "red"
        ? "Flavor skews warm."
        : protocol.catalyst === "green"
          ? "Flavor skews herbal."
          : "Flavor skews cool.",
      heat: protocol.heat === "low"
        ? "Keep flame below mid."
        : protocol.heat === "mid"
          ? "Flame should stay near center."
          : "Flame should run hot.",
      stir: protocol.stir === "pulse"
        ? "Use a light cadence."
        : protocol.stir === "steady"
          ? "Use a balanced cadence."
          : "Use an aggressive cadence."
    };
    setEggmanScanHints((prev) => ({ ...prev, [slot]: hintBySlot[slot] }));
    setEggmanScansLeft((prev) => Math.max(0, prev - 1));
  }, [eggmanLabRound, eggmanScansLeft, state]);

  const submitEggmanLabRound = useCallback(async () => {
    if (!state || eggmanLabBusy) return;
    setEggmanLabBusy(true);
    const protocol = resolveEggmanProtocol(state.meta.seed, eggmanLabRound);
    const score = Number(eggmanMix.catalyst === protocol.catalyst)
      + Number(eggmanMix.heat === protocol.heat)
      + Number(eggmanMix.stir === protocol.stir);
    const fxState: EggmanLabFx = score === 3 ? "perfect" : score === 2 ? "good" : score === 1 ? "fail" : "meltdown";
    setEggmanLabFx(fxState);
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 760);
    });
    const scansUsed = 2 - eggmanScansLeft;
    const result = await runAction({
      type: "PLAY_EGGMAN_LAB_ROUND",
      catalyst: eggmanMix.catalyst,
      heat: eggmanMix.heat,
      stir: eggmanMix.stir,
      scansUsed
    }, true);
    setEggmanLabBusy(false);
    setEggmanLabOpen(false);
    setEggmanLabFx(null);
    if (!result.gameOver) {
      setNotice({
        title: result.ok ? "Done" : "Blocked",
        body: result.message
      });
    }
  }, [eggmanLabBusy, eggmanLabRound, eggmanMix.catalyst, eggmanMix.heat, eggmanMix.stir, eggmanScansLeft, runAction, state]);

  const eggmanDoseTotal = eggmanDoses.red + eggmanDoses.green + eggmanDoses.blue;
  const eggmanBeakerFill = Math.min(100, eggmanDoseTotal * 10);
  const eggmanFluidColor = eggmanMix.catalyst === "red"
    ? "rgba(255, 116, 92, 0.84)"
    : eggmanMix.catalyst === "green"
      ? "rgba(122, 239, 141, 0.84)"
      : "rgba(93, 174, 255, 0.84)";
  const eggmanBubbleSpeedSec = Math.max(1.2, 2.9 - ((eggmanHeatValue / 100) * 1.2) - ((eggmanStirPower / 100) * 0.8));

  useEffect(() => {
    const dominant: EggmanCatalyst = eggmanDoses.green >= eggmanDoses.red && eggmanDoses.green >= eggmanDoses.blue
      ? "green"
      : eggmanDoses.blue >= eggmanDoses.red && eggmanDoses.blue >= eggmanDoses.green
        ? "blue"
        : "red";
    const heat: EggmanHeat = eggmanHeatValue < 34 ? "low" : eggmanHeatValue < 67 ? "mid" : "high";
    const stir: EggmanStir = eggmanStirPower < 34 ? "pulse" : eggmanStirPower < 67 ? "steady" : "whip";
    setEggmanMix({ catalyst: dominant, heat, stir });
  }, [eggmanDoses.blue, eggmanDoses.green, eggmanDoses.red, eggmanHeatValue, eggmanStirPower]);

  useEffect(() => {
    if (!eggmanLabOpen || eggmanLabBusy) return;
    const id = window.setTimeout(() => {
      setEggmanStirPower((prev) => Math.max(0, prev - 3));
    }, 700);
    return () => window.clearTimeout(id);
  }, [eggmanLabBusy, eggmanLabOpen, eggmanStirPower]);

  useEffect(() => {
    if (!stripPokerDeal || stripPokerDeal.stage !== "dealing") return;
    if (stripDealTimerRef.current !== null) {
      window.clearTimeout(stripDealTimerRef.current);
      stripDealTimerRef.current = null;
    }
    stripDealTimerRef.current = window.setTimeout(() => {
      setStripPokerDeal((prev) => (prev && prev.stage === "dealing" ? { ...prev, stage: "showdown" } : prev));
      setStripPokerBusy(false);
      stripDealTimerRef.current = null;
    }, 1400);
    return () => {
      if (stripDealTimerRef.current !== null) {
        window.clearTimeout(stripDealTimerRef.current);
        stripDealTimerRef.current = null;
      }
    };
  }, [stripPokerDeal]);

  useEffect(() => {
    if (stripPokerOpen) return;
    if (stripDealTimerRef.current !== null) {
      window.clearTimeout(stripDealTimerRef.current);
      stripDealTimerRef.current = null;
    }
  }, [stripPokerOpen]);

  useEffect(() => {
    if (stripPokerOpen) return;
    if (!state?.world.minigames.stripPokerTableLocked) return;
    void runAction({ type: "END_STRIP_POKER_SESSION" }, true);
  }, [runAction, state?.world.minigames.stripPokerTableLocked, stripPokerOpen]);

  useEffect(() => {
    if (!stripPokerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stripPokerBusy) return;
      e.preventDefault();
      void closeStripPokerSession(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeStripPokerSession, stripPokerBusy, stripPokerOpen]);

  useEffect(() => {
    if (!beerGameOpen) return;
    if (beerResolvingRef.current) return;
    const shouldResolve = !beerInFlight && (beerThrowsLeft <= 0 || beerCupsCleared >= 6);
    if (!shouldResolve) return;
    beerResolvingRef.current = true;
    const cupsHit = beerCupsCleared;
    const throwsUsed = Math.max(0, activeMode.throws - beerThrowsLeft);
    const accuracy = throwsUsed > 0 ? Math.round((cupsHit / throwsUsed) * 100) : 0;
    const perfectSinks = roundPerfectRef.current;
    const heat = [...cupHeatRef.current];
    window.setTimeout(() => {
      beerRoundMemoryRef.current[beerMatchup] = {
        cupsHit,
        accuracy,
        perfectSinks,
        won: cupsHit >= 2
      };
      setBeerSummary({
        cupsHit,
        throwsUsed,
        accuracy,
        perfectSinks,
        heat,
        message: localBeerRoundBlurb(cupsHit),
        refillLeft: 3
      });
      setBeerGameOpen(false);
      beerResolvingRef.current = false;
    }, 420);
  }, [activeMode.throws, beerGameOpen, beerInFlight, beerMatchup, beerThrowsLeft, beerCupsCleared, localBeerRoundBlurb]);

  useEffect(() => {
    if (!beerSummary) return;
    if (beerSummary.refillLeft <= 0) return;
    const id = window.setTimeout(() => {
      setBeerSummary((prev) => (prev ? { ...prev, refillLeft: prev.refillLeft - 1 } : prev));
    }, 550);
    return () => window.clearTimeout(id);
  }, [beerSummary]);

  useEffect(() => () => {
    if (soggyTimersRef.current.length === 0) return;
    soggyTimersRef.current.forEach((id) => window.clearTimeout(id));
    soggyTimersRef.current = [];
  }, []);

  if (!ready || !state || !content) {
    return (
      <main className="app">
        <section className="panel">
          <h1>Sonic RPG V2</h1>
          <p>Bootstrapping deterministic world systems...</p>
        </section>
      </main>
    );
  }

  const exits = locationRecord?.exits ?? [];
  const locationTurns = state.dialogue.turns.filter(
    (turn) => !turn.locationId || turn.locationId === state.player.location
  );
  const latestNpcTurn = engagedNpc
    ? [...locationTurns]
      .reverse()
      .find((turn) => {
        if (turn.speaker === "You" || turn.npcId !== engagedNpc || turn.text.trim() === "...") return false;
        if (!activeNpcFocusAtMs) return true;
        const createdAtMs = turn.createdAt ? Date.parse(turn.createdAt) : 0;
        return createdAtMs >= activeNpcFocusAtMs;
      })
    : undefined;
  const popupNpcId: NpcId | null = engagedNpc;
  const popupTyping = Boolean(engagedNpc && isAwaitingNpcReply);
  const popupDialogueText = popupTyping ? "" : (latestNpcTurn?.text ?? "");
  const popupDisplaySpeaker = latestNpcTurn?.displaySpeaker ?? (popupNpcId ? titleCase(popupNpcId) : "");
  const popupPoseState = latestNpcTurn?.poseKey ?? "neutral";
  const popupCharacterImage = popupNpcId && content
    ? resolveCharacterImage(content.assetManifest, popupNpcId, popupPoseState, popupDisplaySpeaker)
    : "";
  const landingBackgroundImage = resolveBackgroundImage(content.assetManifest, "landing_page");
  const landingSignImage = resolveBackgroundImage(content.assetManifest, "landing_page_sign");
  const kickoutModalImage = resolveCharacterImage(content.assetManifest, "expulsion_card", "default");
  const isKickoutFailure = state.fail.hardFailed && /(expel|kicked?\s+out|kick\s*out)/i.test(state.fail.reason);
  const isDropoutFailure = state.fail.hardFailed && /(drop\s*out|embarass|embarrass)/i.test(state.fail.reason);
  const shouldShowExpelCard = isKickoutFailure || isDropoutFailure;
  const soggyFratImage = resolveCharacterImage(content.assetManifest, "frat_boys", "neutral", "Diesel");
  const shouldShowDialoguePopup = Boolean(
    engagedNpc
    && popupNpcId
    && (popupDialogueText || popupTyping)
    && !hudMenuOpen
    && !actionMenuOpen
    && !beerGameOpen
    && !eggmanLabOpen
    && !stripPokerOpen
    && !notice
    && !locationSplash
    && !isSoggySequenceActive
  );
  const scenePopupPlacement: "upper" = "upper";
  const scenePopupTextPosition: "above" = "above";
  const stripPokerLosses = state.world.minigames.stripPokerLosses ?? 0;
  const stripPokerNextStake = STRIP_POKER_CLOTHING_STAKES[Math.min(stripPokerLosses, STRIP_POKER_CLOTHING_STAKES.length - 1)];
  const stripPokerStakesRemaining = Math.max(0, STRIP_POKER_CLOTHING_STAKES.length - stripPokerLosses);
  const currentSearchCache = searchLoot ? (state.world.searchCaches[searchLoot.location] ?? []) : [];
  const suppressTopToast = Boolean(
    notice
    || orientationAgendaOpen
    || beerGameOpen
    || eggmanLabOpen
    || stripPokerOpen
    || searchLoot
    || locationSplash
    || isSoggySequenceActive
    || showLandingPage
    || landingClosing
  );
  const deanInOffice = state.world.presentNpcs.dean_office.includes("dean_cain");
  const sororityOccupants = state.world.presentNpcs.sorority;
  const sororityBanned = state.world.restrictions.sororityBanned;
  const sororityPokerEligible = sororityOccupants.includes("sorority_girls");
  const showMissionTracker = false;
  const routeSnapshots = [
    {
      id: "A",
      label: "Beer Pong Route",
      complete: state.routes.routeA.complete,
      note: state.routes.routeA.complete ? "Route done." : "Win rounds to raise Sonic drunk level."
    },
    {
      id: "B",
      label: "Dean Whiskey Route",
      complete: state.routes.routeB.complete,
      note: state.player.inventory.includes("Dean Whiskey") ? "Bottle ready. Use in Dorm Room." : "Search Dean Desk when office is clear."
    },
    {
      id: "C",
      label: "Tunnel Trade Route",
      complete: state.routes.routeC.complete,
      note: state.player.inventory.includes("Asswine") ? "Asswine ready." : "Trade Sorority contraband for Asswine."
    },
    {
      id: "D",
      label: "Handcuffs Route",
      complete: state.sonic.following && !state.player.inventory.includes("Furry Handcuffs"),
      note: state.player.inventory.includes("Furry Handcuffs")
        ? "Use in Dorm Room when Sonic is ready."
        : "Search Sorority (when clear) for Handcuffs."
    }
  ];

  const routeActionButtons: ActionButtonDef[] = [];
  const unlocks = state.world.actionUnlocks;
  if (state.player.location === "frat" && unlocks.beerPongFrat) {
    routeActionButtons.push({
      key: "PLAY_BEER_PONG_MINIGAME_FRAT",
      label: "Play Beer Pong",
      action: { type: "PLAY_BEER_PONG_SHOT", shot: "safe" },
      priority: state.sonic.drunkLevel < 3 ? 91 : 50
    });
  }
  const sonicPresentAtCurrentLocation = (state.world.presentNpcs[state.player.location] ?? []).includes("sonic");
  if (
    state.player.location === "frat"
    && sonicPresentAtCurrentLocation
    && !state.sonic.following
    && !state.world.restrictions.fratBanned
  ) {
    routeActionButtons.push({
      key: "PLAY_BEER_PONG_MINIGAME_SONIC",
      label: "Challenge Sonic",
      action: { type: "PLAY_BEER_PONG_SHOT", shot: "hero" },
      priority: state.sonic.drunkLevel < 4 ? 89 : 52
    });
  }
  if (state.player.location === "dean_office" && !deanInOffice && unlocks.searchDeanDesk) {
    routeActionButtons.push({
      key: "SEARCH_DEAN_DESK",
      label: "Search Dean Desk",
      action: { type: "SEARCH_DEAN_DESK" },
      priority: !state.player.inventory.includes("Dean Whiskey") ? 88 : 46
    });
  }
  if (state.player.location === "quad" && unlocks.searchQuad) {
    routeActionButtons.push({
      key: "SEARCH_QUAD",
      label: "Search Quad",
      action: { type: "SEARCH_QUAD" },
      priority: 76
    });
  }
  if (state.player.location === "eggman_classroom" && unlocks.searchEggmanClassroom) {
    routeActionButtons.push({
      key: "SEARCH_EGGMAN_CLASSROOM",
      label: "Search Classroom",
      action: { type: "SEARCH_EGGMAN_CLASSROOM" },
      priority: 74
    });
  }
  if (state.player.location === "eggman_classroom" && (state.world.presentNpcs.eggman_classroom ?? []).includes("eggman")) {
    routeActionButtons.push({
      key: "ASK_EGGMAN_QUIZ",
      label: "Run Eggman Lab",
      action: { type: "ASK_EGGMAN_QUIZ" },
      priority: 77
    });
    routeActionButtons.push({
      key: "DECLINE_EGGMAN_QUIZ",
      label: "Skip Lab",
      action: { type: "DECLINE_EGGMAN_QUIZ" },
      priority: 22
    });
  }
  if (state.player.location === "frat" && unlocks.searchFratHouse) {
    routeActionButtons.push({
      key: "SEARCH_FRAT_HOUSE",
      label: "Search Frat",
      action: { type: "SEARCH_FRAT_HOUSE" },
      priority: 72
    });
  }
  if (state.player.location === "frat") {
    routeActionButtons.push({
      key: "PLAY_SOGGY_BISCUIT",
      label: "Play Soggy",
      action: { type: "PLAY_SOGGY_BISCUIT" },
      priority: 12
    });
  }
  if (state.player.location === "cafeteria" && unlocks.searchCafeteria) {
    routeActionButtons.push({
      key: "SEARCH_CAFETERIA",
      label: "Search Cafeteria",
      action: { type: "SEARCH_CAFETERIA" },
      priority: 88
    });
  }
  if (state.player.location === "sorority" && !sororityBanned && !state.world.presentNpcs.sorority.includes("sorority_girls")) {
    routeActionButtons.push({
      key: "SEARCH_SORORITY_HOUSE",
      label: "Search Sorority",
      action: { type: "SEARCH_SORORITY_HOUSE" },
      priority: 72
    });
  }
  if (state.player.location === "sorority" && !sororityBanned && sororityPokerEligible) {
    routeActionButtons.push({
      key: "STRIP_POKER_MINIGAME",
      label: "Play Poker",
      action: { type: "PLAY_STRIP_POKER_ROUND" },
      priority: 83
    });
  }
  if (state.player.location === "tunnel") {
    if (unlocks.searchTunnel) {
      routeActionButtons.push({
        key: "SEARCH_TUNNEL",
        label: "Search Tunnel",
        action: { type: "SEARCH_TUNNEL" },
        priority: 69
      });
    }
    if (unlocks.tradeThunderhead) {
      routeActionButtons.push({
        key: "TRADE_THUNDERHEAD",
        label: "Trade",
        action: { type: "TRADE_THUNDERHEAD" },
        priority: state.player.inventory.includes("Lace Undies") ? 95 : 43
      });
    }
  }
  if (state.player.location === "dorm_room") {
    routeActionButtons.push({
      key: "SEARCH_DORM_ROOM",
      label: "Search Room",
      action: { type: "SEARCH_DORM_ROOM" },
      priority: 88
    });
    if (unlocks.giveAsswine) {
      routeActionButtons.push({
        key: "GIVE_ASSWINE",
        label: "Give Asswine",
        action: { type: "GIVE_ASSWINE" },
        priority: state.player.inventory.includes("Asswine") ? 99 : 40,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
    if (unlocks.giveWhiskey) {
      routeActionButtons.push({
        key: "GIVE_WHISKEY",
        label: "Give Whiskey",
        action: { type: "GIVE_WHISKEY" },
        priority: state.player.inventory.includes("Dean Whiskey") ? 94 : 38,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
    if (unlocks.escortSonic) {
      routeActionButtons.push({
        key: "ESCORT_SONIC",
        label: "Escort Sonic",
        action: { type: "ESCORT_SONIC" },
        priority: state.sonic.drunkLevel >= 3 && !state.sonic.following ? 100 : 36,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
    if (state.player.inventory.includes("Super Dean Beans")) {
      routeActionButtons.push({
        key: "USE_SUPER_DEAN_BEANS",
        label: "Use Beans",
        action: { type: "USE_SUPER_DEAN_BEANS" },
        priority: 74,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
    if (state.player.inventory.includes("Expired Energy Shot")) {
      routeActionButtons.push({
        key: "USE_EXPIRED_ENERGY_SHOT",
        label: "Use Energy Shot",
        action: { type: "USE_EXPIRED_ENERGY_SHOT" },
        priority: 41,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
    if (state.player.inventory.includes("Warm Beer")) {
      routeActionButtons.push({
        key: "USE_WARM_BEER",
        label: "Use Warm Beer",
        action: { type: "USE_WARM_BEER" },
        priority: 66,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
    if (state.player.inventory.includes("Glitter Flask") && state.player.inventory.includes("Warm Beer")) {
      routeActionButtons.push({
        key: "MIX_GLITTER_WARM_BEER",
        label: "Mix Glitter Brew",
        action: { type: "MIX_GLITTER_WARM_BEER" },
        priority: 64
      });
    }
    if (state.player.inventory.includes("Super Dean Beans") && state.player.inventory.includes("Warm Beer")) {
      routeActionButtons.push({
        key: "MIX_BEANS_WARM_BEER",
        label: "Mix Turbo Sludge",
        action: { type: "MIX_BEANS_WARM_BEER" },
        priority: 63
      });
    }
    if (state.player.inventory.includes("Glitter Bomb Brew")) {
      routeActionButtons.push({
        key: "USE_GLITTER_BOMB_BREW",
        label: "Use Glitter Brew",
        action: { type: "USE_GLITTER_BOMB_BREW" },
        priority: 73,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
    if (state.player.inventory.includes("Turbo Sludge")) {
      routeActionButtons.push({
        key: "USE_TURBO_SLUDGE",
        label: "Use Turbo Sludge",
        action: { type: "USE_TURBO_SLUDGE" },
        priority: 72,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
    if (state.player.inventory.includes("Mystery Meat")) {
      routeActionButtons.push({
        key: "USE_MYSTERY_MEAT",
        label: "Use Mystery Meat",
        action: { type: "USE_MYSTERY_MEAT" },
        priority: 42,
        disabled: !sonicPresentAtCurrentLocation
      });
    }
  }
  if (state.player.location === "dorms" && unlocks.searchDorms) {
    routeActionButtons.push({
      key: "SEARCH_DORMS",
      label: "Search Hall",
      action: { type: "SEARCH_DORMS" },
      priority: 67
    });
  }
  if (state.player.inventory.includes("Furry Handcuffs")) {
    const handcuffTargets = presentNpcs.filter((npc) =>
      npc === "sonic" || npc === "dean_cain" || npc === "sorority_girls" || npc === "frat_boys"
    );
    handcuffTargets.forEach((target) => {
      const highValue = target === "sonic" && state.sonic.drunkLevel >= ESCORT_READY_DRUNK_LEVEL && !state.sonic.following;
      routeActionButtons.push({
        key: `USE_ITEM_FURRY_HANDCUFFS_${target}`,
        label: `Cuff ${titleCase(target)}`,
        action: { type: "USE_ITEM_ON_TARGET", item: "Furry Handcuffs", target },
        priority: highValue ? 98 : 26
      });
    });
  }
  if (state.player.location === "stadium" && (unlocks.stadiumEntry || state.sonic.following)) {
    routeActionButtons.push({
      key: "STADIUM_ENTRY",
      label: "Enter Stadium",
      action: { type: "STADIUM_ENTRY" },
      priority: state.sonic.following && state.sonic.drunkLevel >= ESCORT_READY_DRUNK_LEVEL ? 100 : 60
    });
  }
  if (state.player.location === "stadium" && state.player.inventory.includes("Gate Stamp")) {
    routeActionButtons.push({
      key: "USE_GATE_STAMP",
      label: "Use Gate Stamp",
      action: { type: "USE_GATE_STAMP" },
      priority: state.player.inventory.includes("Student ID") ? 78 : 34
    });
  }
  if (state.player.location === "stadium" && unlocks.searchStadium) {
    routeActionButtons.push({
      key: "SEARCH_STADIUM",
      label: "Search Gate",
      action: { type: "SEARCH_STADIUM" },
      priority: 66
    });
  }
  if (state.timer.remainingSec <= 210) {
    routeActionButtons.forEach((item) => {
      item.priority += 5;
    });
  }
  if (state.player.inventory.includes("Security Schedule")) {
    routeActionButtons.push({
      key: "USE_SECURITY_SCHEDULE",
      label: "Use Schedule",
      action: { type: "USE_SECURITY_SCHEDULE" },
      priority: state.player.location === "stadium" ? 79 : 35
    });
  }
  if (state.player.inventory.includes("RA Whistle")) {
    routeActionButtons.push({
      key: "USE_RA_WHISTLE",
      label: "Use RA Whistle",
      action: { type: "USE_RA_WHISTLE" },
      priority: state.player.location === "dorms" || state.player.location === "dorm_room" ? 53 : 24
    });
  }
  if (state.player.inventory.includes("Campus Map")) {
    routeActionButtons.push({
      key: "USE_CAMPUS_MAP",
      label: "Use Map",
      action: { type: "USE_CAMPUS_MAP" },
      priority: 39
    });
  }
  routeActionButtons.sort((a, b) => b.priority - a.priority);

  const nextBestActionKey = routeActionButtons[0]?.key ?? null;
  const moveActions: ActionButtonDef[] = exits.map((target) => {
    const isFratBannedMove = target === "frat" && state.world.restrictions.fratBanned;
    return {
      key: `MOVE_${target}`,
      label: `Go ${content?.locations.find((l) => l.id === target)?.name ?? titleCase(target)}`,
      action: { type: "MOVE", target } as UiAction,
      priority: 30,
      group: "move",
      disabled: isFratBannedMove,
      badge: isFratBannedMove ? "BANNED" : undefined
    };
  });
  const riskyKeys = new Set([
    "USE_FURRY_HANDCUFFS",
    "USE_SUPER_DEAN_BEANS",
    "USE_EXPIRED_ENERGY_SHOT",
    "USE_WARM_BEER",
    "USE_GLITTER_BOMB_BREW",
    "USE_TURBO_SLUDGE",
    "USE_MYSTERY_MEAT",
    "USE_GATE_STAMP",
    "USE_RA_WHISTLE",
    "STADIUM_ENTRY"
  ]);
  const immediateActions: ActionButtonDef[] = routeActionButtons.slice(0, 2).map((a) => ({ ...a, group: "immediate" }));
  const immediateSet = new Set(immediateActions.map((a) => a.key));
  const remainingRouteActions = routeActionButtons.filter((a) => !immediateSet.has(a.key));
  const riskyActions = remainingRouteActions.filter((a) => riskyKeys.has(a.key)).map((a) => ({ ...a, group: "risky" as const }));
  const targetedRiskyActions = remainingRouteActions
    .filter((a) => a.key.startsWith("USE_ITEM_FURRY_HANDCUFFS_"))
    .map((a) => ({ ...a, group: "risky" as const }));
  const riskyActionsAll = [...riskyActions, ...targetedRiskyActions];
  const riskySet = new Set(riskyActionsAll.map((a) => a.key));
  const immediateSetAll = new Set(immediateActions.map((a) => a.key));
  const groupedActionRows: Array<{ title: string; items: ActionButtonDef[] }> = [
    { title: "Top", items: immediateActions },
    { title: "Move", items: moveActions },
    { title: "Risk", items: riskyActionsAll },
    {
      title: "More",
      items: remainingRouteActions
        .filter((a) => !riskySet.has(a.key) && !immediateSetAll.has(a.key))
        .map((a) => ({ ...a }))
    }
  ].filter((group) => group.items.length > 0);
  const inventoryItems = [...state.player.inventory];
  const itemActionMatchers: Array<{ test: (item: string) => boolean; match: (action: ActionButtonDef) => boolean }> = [
    { test: (item) => item === "Dean Whiskey", match: (action) => action.action.type === "GIVE_WHISKEY" },
    { test: (item) => item === "Asswine", match: (action) => action.action.type === "GIVE_ASSWINE" },
    { test: (item) => item === "Furry Handcuffs", match: (action) => action.key.startsWith("USE_ITEM_FURRY_HANDCUFFS_") },
    { test: (item) => item === "Warm Beer", match: (action) => action.action.type === "USE_WARM_BEER" || action.action.type === "MIX_GLITTER_WARM_BEER" || action.action.type === "MIX_BEANS_WARM_BEER" },
    { test: (item) => item === "Super Dean Beans", match: (action) => action.action.type === "USE_SUPER_DEAN_BEANS" || action.action.type === "MIX_BEANS_WARM_BEER" },
    { test: (item) => item === "Expired Energy Shot", match: (action) => action.action.type === "USE_EXPIRED_ENERGY_SHOT" },
    { test: (item) => item === "Glitter Flask", match: (action) => action.action.type === "MIX_GLITTER_WARM_BEER" },
    { test: (item) => item === "Glitter Bomb Brew", match: (action) => action.action.type === "USE_GLITTER_BOMB_BREW" },
    { test: (item) => item === "Turbo Sludge", match: (action) => action.action.type === "USE_TURBO_SLUDGE" },
    { test: (item) => item === "Campus Map", match: (action) => action.action.type === "USE_CAMPUS_MAP" },
    { test: (item) => item === "Gate Stamp", match: (action) => action.action.type === "USE_GATE_STAMP" },
    { test: (item) => item === "Mystery Meat", match: (action) => action.action.type === "USE_MYSTERY_MEAT" },
    { test: (item) => item === "Security Schedule", match: (action) => action.action.type === "USE_SECURITY_SCHEDULE" },
    { test: (item) => item === "RA Whistle", match: (action) => action.action.type === "USE_RA_WHISTLE" }
  ];
  const resolveItemActions = (item: string): ActionButtonDef[] => {
    const matcher = itemActionMatchers.find((m) => m.test(item));
    if (!matcher) return [];
    return routeActionButtons.filter((a) => matcher.match(a));
  };
  const selectedItemActions = selectedActionItem ? resolveItemActions(selectedActionItem) : [];
  const getOpponentSeatStyle = (index: number, total: number): CSSProperties => {
    const normalizedTotal = Math.max(1, total);
    if (normalizedTotal === 1) {
      return { left: "50%", top: "28%", "--seat-scale": 1 } as CSSProperties;
    }
    const spread = Math.PI * 0.7;
    const start = Math.PI + ((Math.PI - spread) / 2);
    const step = spread / Math.max(1, normalizedTotal - 1);
    const theta = start + (step * index);
    const radiusX = normalizedTotal >= 4 ? 38 : 30;
    const radiusY = normalizedTotal >= 4 ? 22 : 16;
    const x = 50 + (Math.cos(theta) * radiusX);
    const y = 44 + (Math.sin(theta) * radiusY);
    const scale = normalizedTotal >= 4 ? 0.94 : 1;
    return {
      left: `${x.toFixed(2)}%`,
      top: `${y.toFixed(2)}%`,
      "--seat-scale": scale
    } as CSSProperties;
  };

  return (
    <main className="app">
      <ScenePanel
        locationId={state.player.location}
        sceneBackgroundImage={sceneBackgroundImage}
        shouldShowDialoguePopup={shouldShowDialoguePopup}
        scenePopupPlacement={scenePopupPlacement}
        scenePopupTextPosition={scenePopupTextPosition}
        popupCharacterImage={popupCharacterImage}
        popupDisplaySpeaker={popupDisplaySpeaker}
        popupDialogueText={popupDialogueText}
        popupTyping={popupTyping}
        engagedNpc={engagedNpc}
        playerInput={playerInput}
        isAwaitingNpcReply={isAwaitingNpcReply}
        isResolved={isResolved || isSoggySequenceActive}
        titleCase={titleCase}
        onPlayerInputChange={setPlayerInput}
        onSubmitDialogue={submitDialogueLocked}
      />

      <PresenceBar
        presentNpcs={presentNpcs}
        engagedNpc={engagedNpc}
        isResolved={isResolved || isSoggySequenceActive}
        titleCase={titleCase}
        resolveNpcImage={resolveNpcImage}
        onFocusNpc={(npc) => { void focusNpcConversation(npc); }}
      />

      {showMissionTracker && (
        <section className="mission-tracker" aria-label="Mission tracker">
          <p className="mission-kicker">Objective</p>
          <p className="mission-title">{state.mission.objective}</p>
          <p className="mission-subtitle">{state.mission.subObjective}</p>
          <div className="mission-stats">
            <span>Sonic drunk: {state.sonic.drunkLevel}/4</span>
            <span>Following: {state.sonic.following ? "yes" : "no"}</span>
            <span>ID: {state.player.inventory.includes("Student ID") ? "ready" : "missing"}</span>
            <span>Warnings — Dean {warningMeter(state.fail.warnings.dean, WARNING_LIMITS.dean)}, Luigi {warningMeter(state.fail.warnings.luigi, WARNING_LIMITS.luigi)}, Frat {warningMeter(state.fail.warnings.frat, WARNING_LIMITS.frat)}</span>
          </div>
          <div className="route-matrix">
            {routeSnapshots.map((route) => (
              <div key={`route-${route.id}`} className={`route-chip ${route.complete ? "complete" : ""}`}>
                <strong>Route {route.id}</strong> {route.label} - {route.note}
              </div>
            ))}
          </div>
        </section>
      )}

      <BottomActionStrip
        engagedNpc={engagedNpc}
        playerInput={playerInput}
        isResolved={isResolved || isSoggySequenceActive}
        clockText={clockText}
        onOpenActions={() => {
          setSelectedActionItem(null);
          setActionMenuOpen(true);
        }}
        onOpenMenu={() => setHudMenuOpen(true)}
      />

      {hudMenuOpen && (
        <section className="modal-overlay" onClick={() => setHudMenuOpen(false)}>
          <article className="modal-card menu-sheet-card" onClick={(e) => e.stopPropagation()}>
            <header className="sheet-header">
              <h3>Menu</h3>
              <button className="ghost sheet-close-btn" aria-label="Close menu" onClick={() => setHudMenuOpen(false)}>✕</button>
            </header>
            <div className="action-groups">
              <section className="action-group">
                <h4>Status</h4>
                <p className="menu-inline-copy muted">Sonic: {state.sonic.drunkLevel}/4 • Following: {state.sonic.following ? "yes" : "no"} • ID: {state.player.inventory.includes("Student ID") ? "ready" : "missing"}</p>
                <p className="menu-inline-copy muted">Warn: Dean {warningMeter(state.fail.warnings.dean, WARNING_LIMITS.dean)} • Luigi {warningMeter(state.fail.warnings.luigi, WARNING_LIMITS.luigi)} • Frat {warningMeter(state.fail.warnings.frat, WARNING_LIMITS.frat)}</p>
              </section>
              <section className="action-group">
                <h4>Utilities</h4>
                <div className="button-grid action-grid">
                  <button
                    disabled={!canUseHint}
                    onClick={async () => {
                      if (!canUseHint) return;
                      setHudMenuOpen(false);
                      await runAction({ type: "GET_HINT" });
                      setHintCooldownUntilMs(Date.now() + 30000);
                    }}
                  >
                    Get Hint
                  </button>
                  <button onClick={async () => {
                    setHudMenuOpen(false);
                    setActiveNpc(null);
                    setActiveNpcFocusAtMs(0);
                    setPlayerInput("");
                    openLandingPage();
                    setHintCooldownUntilMs(0);
                  }}>Restart Run</button>
                </div>
                <p className="menu-inline-copy muted">{hintButtonNote}</p>
              </section>
            </div>
          </article>
        </section>
      )}

      {actionMenuOpen && (
        <section className="modal-overlay action-sheet-overlay" onClick={() => {
          setActionMenuOpen(false);
          setSelectedActionItem(null);
        }}>
          <article className="modal-card action-sheet-card" onClick={(e) => e.stopPropagation()}>
            <h3>Actions</h3>
            <div className="action-groups">
              <section className="action-group">
                <h4>Items</h4>
                <div className="menu-chip-wrap">
                  {inventoryItems.length > 0 ? (
                    inventoryItems.map((item) => (
                      <button
                        key={`action-item-${item}`}
                        className={`menu-chip item-chip-button ${selectedActionItem === item ? "active-talk-btn" : ""}`}
                        onClick={() => setSelectedActionItem(item)}
                      >
                        <img className="item-chip-icon" src={ITEM_ICONS[item] ?? DEFAULT_ITEM_ICON} alt="" />
                        {item}
                      </button>
                    ))
                  ) : (
                    <span className="menu-chip menu-chip-muted">No items</span>
                  )}
                </div>
                {selectedActionItem && (
                  <div className="panel" style={{ marginTop: 8 }}>
                    <p className="menu-inline-copy item-title-row">
                      <img className="item-title-icon" src={ITEM_ICONS[selectedActionItem] ?? DEFAULT_ITEM_ICON} alt="" />
                      <strong>{selectedActionItem}</strong>
                    </p>
                    <p className="menu-inline-copy muted">{ITEM_HELP[selectedActionItem]?.desc ?? "No description"}</p>
                    <p className="menu-inline-copy muted">{ITEM_HELP[selectedActionItem]?.useHint ?? "Use when context fits"}</p>
                    {ITEM_HELP[selectedActionItem]?.targetHint && (
                      <p className="menu-inline-copy muted">{ITEM_HELP[selectedActionItem]?.targetHint}</p>
                    )}
                    {ITEM_HELP[selectedActionItem]?.riskHint && (
                      <p className="menu-inline-copy muted">Risk: {ITEM_HELP[selectedActionItem]?.riskHint}</p>
                    )}
                    <div className="button-grid action-grid">
                      {selectedItemActions.length > 0 ? (
                        selectedItemActions.map((item) => (
                          <button
                            key={`use-selected-${item.key}`}
                            disabled={isResolved || isSoggySequenceActive || Boolean(item.disabled)}
                            onClick={async () => {
                              setActionMenuOpen(false);
                              await runAction(item.action);
                            }}
                          >
                            {item.label}
                          </button>
                        ))
                      ) : (
                        <button disabled>
                          No usable action here
                        </button>
                      )}
                    </div>
                    {selectedActionItem === "Campus Map" && (
                      <div className="button-grid action-grid" style={{ marginTop: 8 }}>
                        <button
                          onClick={() => {
                            setActionMenuOpen(false);
                            setCampusMapOpen(true);
                          }}
                        >
                          Open Map
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
              {groupedActionRows.map((group) => (
                <section key={group.title} className="action-group">
                  <h4>{group.title}</h4>
                  <div className="button-grid action-grid">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        disabled={isResolved || isSoggySequenceActive || Boolean(item.disabled)}
                        className={item.key === nextBestActionKey ? "next-best-action" : ""}
                        onClick={async () => {
                          if (item.key === "PLAY_SOGGY_BISCUIT") {
                            runSoggySequence();
                            return;
                          }
                          if (item.key === "PLAY_BEER_PONG_MINIGAME_FRAT" || item.key === "PLAY_BEER_PONG_MINIGAME_SONIC") {
                            setActionMenuOpen(false);
                            const matchup = item.key === "PLAY_BEER_PONG_MINIGAME_SONIC" ? "sonic" : "frat";
                            if (matchup === "sonic") {
                              const setup = await runAction({ type: "PLAY_BEER_PONG_SONIC" }, true);
                              if (!setup.ok) {
                                setNotice({
                                  title: "Blocked",
                                  body: setup.message
                                });
                                return;
                              }
                            }
                            setBeerMatchup(matchup);
                            resetBeerPhysicsGame(matchup);
                            setBeerCountdown(3);
                            setBeerGameOpen(true);
                            return;
                          }
                          if (item.key === "STRIP_POKER_MINIGAME") {
                            setActionMenuOpen(false);
                            const opponentNpcIds = [...new Set(sororityOccupants)].slice(0, 4);
                            await runAction({ type: "START_STRIP_POKER_SESSION" }, true);
                            const round = (state.world.minigames.globalRound ?? 0) + 1;
                            startStripPokerRound(opponentNpcIds, round);
                            setStripPokerOpen(true);
                            return;
                          }
                          if (item.key === "ASK_EGGMAN_QUIZ") {
                            setActionMenuOpen(false);
                            const setup = await runAction({ type: "ASK_EGGMAN_QUIZ" }, true);
                            if (!setup.ok) {
                              setNotice({ title: "Blocked", body: setup.message });
                              return;
                            }
                            openEggmanLab();
                            return;
                          }
                          setActionMenuOpen(false);
                          if (isSearchAction(item.action)) {
                            const searchResult = await runAction(item.action, true);
                            if (searchResult.ok) {
                              setSearchLoot({
                                location: state.player.location,
                                message: searchResult.message
                              });
                            } else {
                              const caughtByFrat = /diesel caught you searching|banned from frat/i.test(searchResult.message);
                              setNotice({
                                title: caughtByFrat ? "Caught" : "Blocked",
                                body: searchResult.message
                              });
                            }
                          } else {
                            await runAction(item.action);
                          }
                          if (item.action.type === "MOVE") {
                            setActiveNpc(null);
                            setActiveNpcFocusAtMs(0);
                          }
                        }}
                      >
                        {item.label}
                        {item.badge ? <span className="action-pill-label">{item.badge}</span> : null}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <button className="ghost" onClick={() => {
              setActionMenuOpen(false);
              setSelectedActionItem(null);
            }}>Close</button>
          </article>
        </section>
      )}

      {eggmanLabOpen && (
        <section
          className="modal-overlay"
          onClick={() => {
            if (eggmanLabBusy || eggmanLabFx) return;
            setEggmanLabOpen(false);
            setEggmanLabFx(null);
          }}
        >
          <article className="modal-card eggman-lab-card" onClick={(e) => e.stopPropagation()}>
            <div className="eggman-lab-head">
              <h3>Eggman Lab</h3>
              <span className="eggman-lab-chip">Round {eggmanLabRound}</span>
              <span className="eggman-lab-chip">Scans {eggmanScansLeft}/2</span>
            </div>
            <p className="muted">Target: synthetic taco-flavored weight-loss cough syrup.</p>
            <div className="eggman-bench">
              <div className="eggman-reagents">
                <p className="eggman-lab-label">Reagents</p>
                <div className="eggman-dose-row">
                  <button disabled={eggmanLabBusy || eggmanDoseTotal >= 10} onClick={() => setEggmanDoses((prev) => ({ ...prev, red: prev.red + 1 }))}>
                    Add Red
                  </button>
                  <span className="muted">Red dose: {eggmanDoses.red}</span>
                </div>
                <div className="eggman-dose-row">
                  <button disabled={eggmanLabBusy || eggmanDoseTotal >= 10} onClick={() => setEggmanDoses((prev) => ({ ...prev, green: prev.green + 1 }))}>
                    Add Green
                  </button>
                  <span className="muted">Green dose: {eggmanDoses.green}</span>
                </div>
                <div className="eggman-dose-row">
                  <button disabled={eggmanLabBusy || eggmanDoseTotal >= 10} onClick={() => setEggmanDoses((prev) => ({ ...prev, blue: prev.blue + 1 }))}>
                    Add Blue
                  </button>
                  <span className="muted">Blue dose: {eggmanDoses.blue}</span>
                </div>
                <button
                  className="ghost"
                  disabled={eggmanLabBusy}
                  onClick={() => setEggmanDoses({ red: 0, green: 0, blue: 0 })}
                >
                  Reset Reagents
                </button>
                <div className="eggman-reagent-meters">
                  <div className="eggman-meter eggman-meter-red">
                    <div className="eggman-meter-fill" style={{ height: `${Math.min(100, eggmanDoses.red * 10)}%` }} />
                  </div>
                  <div className="eggman-meter eggman-meter-green">
                    <div className="eggman-meter-fill" style={{ height: `${Math.min(100, eggmanDoses.green * 10)}%` }} />
                  </div>
                  <div className="eggman-meter eggman-meter-blue">
                    <div className="eggman-meter-fill" style={{ height: `${Math.min(100, eggmanDoses.blue * 10)}%` }} />
                  </div>
                </div>
              </div>
              <div className="eggman-glassware">
                <p className="eggman-lab-label">Erlenmeyer Flask</p>
                <div className={`eggman-flask-wrap ${eggmanLabFx ? `eggman-fx-${eggmanLabFx}` : ""}`}>
                  <div className="eggman-flask-neck" />
                  <div className="eggman-beaker-shell">
                    <div
                      className="eggman-beaker-fluid"
                      style={{ height: `${eggmanBeakerFill}%`, background: `linear-gradient(180deg, rgba(255,255,255,0.2), ${eggmanFluidColor})` }}
                    >
                      {Array.from({ length: 7 }).map((_, idx) => (
                        <span
                          key={`egg-bubble-${idx}`}
                          className="eggman-bubble"
                          style={{
                            left: `${12 + (idx * 11)}%`,
                            animationDuration: `${eggmanBubbleSpeedSec + (idx * 0.12)}s`,
                            animationDelay: `${idx * 0.18}s`
                          }}
                        />
                      ))}
                    </div>
                    <div className="eggman-flask-glare" />
                  </div>
                  {eggmanLabFx && (
                    <div className="eggman-fx-overlay">
                      <span className="eggman-fx-label">
                        {eggmanLabFx === "perfect"
                          ? "Perfect Viscosity"
                          : eggmanLabFx === "good"
                            ? "Stable Batch"
                            : eggmanLabFx === "fail"
                              ? "Unstable Mix"
                              : "Meltdown"}
                      </span>
                    </div>
                  )}
                </div>
                <p className="muted">Fill: {eggmanBeakerFill}%</p>
                <p className="muted">Syrup profile: {titleCase(eggmanMix.catalyst)} taco note</p>
              </div>
              <div className="eggman-burner">
                <p className="eggman-lab-label">Bunsen Burner</p>
                <div className="eggman-flame-track">
                  <div className="eggman-flame eggman-flame-outer" style={{ height: `${Math.max(10, eggmanHeatValue)}%`, opacity: 0.34 + (eggmanHeatValue / 170) }} />
                  <div className="eggman-flame eggman-flame-inner" style={{ height: `${Math.max(8, eggmanHeatValue * 0.68)}%`, opacity: 0.45 + (eggmanHeatValue / 190) }} />
                  <div className="eggman-burner-stem" />
                  <div className="eggman-burner-base" />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={eggmanHeatValue}
                  disabled={eggmanLabBusy}
                  onChange={(e) => setEggmanHeatValue(Number(e.target.value))}
                />
                <p className="muted">Heat: {titleCase(eggmanMix.heat)}</p>
              </div>
            </div>
            <div className="eggman-lab-row">
              <span className="eggman-lab-label">Flavor profile (from dominant reagent)</span>
              <p className="muted">Current: {titleCase(eggmanMix.catalyst)}</p>
              <button
                className="ghost"
                disabled={eggmanLabBusy || eggmanScansLeft <= 0 || Boolean(eggmanScanHints.catalyst)}
                onClick={() => runEggmanScan("catalyst")}
              >
                Scan Flavor
              </button>
              {eggmanScanHints.catalyst && <p className="muted">Flavor hint: {eggmanScanHints.catalyst}</p>}
            </div>
            <div className="eggman-lab-row">
              <span className="eggman-lab-label">Heat band (from burner)</span>
              <p className="muted">Current: {titleCase(eggmanMix.heat)}</p>
              <button
                className="ghost"
                disabled={eggmanLabBusy || eggmanScansLeft <= 0 || Boolean(eggmanScanHints.heat)}
                onClick={() => runEggmanScan("heat")}
              >
                Scan Heat
              </button>
              {eggmanScanHints.heat && <p className="muted">Heat hint: {eggmanScanHints.heat}</p>}
            </div>
            <div className="eggman-lab-row">
              <span className="eggman-lab-label">Viscosity pattern (from stir)</span>
              <div className="button-grid action-grid">
                <button
                  disabled={eggmanLabBusy}
                  onClick={() => setEggmanStirPower((prev) => Math.min(100, prev + 14))}
                >
                  Stir
                </button>
                <button
                  className="ghost"
                  disabled={eggmanLabBusy}
                  onClick={() => setEggmanStirPower(34)}
                >
                  Reset Stir
                </button>
              </div>
              <p className="muted">Stir power: {eggmanStirPower}% • Current: {titleCase(eggmanMix.stir)}</p>
              <button
                className="ghost"
                disabled={eggmanLabBusy || eggmanScansLeft <= 0 || Boolean(eggmanScanHints.stir)}
                onClick={() => runEggmanScan("stir")}
              >
                Scan Texture
              </button>
              {eggmanScanHints.stir && <p className="muted">Texture hint: {eggmanScanHints.stir}</p>}
            </div>
            <div className="button-grid action-grid">
              <button disabled={eggmanLabBusy} onClick={async () => submitEggmanLabRound()}>
                {eggmanLabBusy ? "Mixing..." : "Submit Mix"}
              </button>
              <button className="ghost" disabled={eggmanLabBusy || Boolean(eggmanLabFx)} onClick={() => {
                setEggmanLabOpen(false);
                setEggmanLabFx(null);
              }}>
                Close
              </button>
            </div>
          </article>
        </section>
      )}

      {searchLoot && (
        <section className="search-loot-toast" aria-live="polite">
          <article className="modal-card search-loot-card">
            <h3>Search Results</h3>
            <p>{searchLoot.message}</p>
            <p className="muted">Your search turned up:</p>
            {currentSearchCache.length > 0 ? (
              <div className="button-grid action-grid">
                {currentSearchCache.map((item, idx) => (
                  <button
                    key={`loot-take-${item}-${idx}`}
                    onClick={async () => {
                      const takeResult = await runAction({
                        type: "TAKE_FOUND_ITEM",
                        location: searchLoot.location,
                        item
                      }, true);
                      if (!takeResult.ok) {
                        setNotice({ title: "Blocked", body: takeResult.message });
                      }
                    }}
                  >
                    <img className="loot-item-icon" src={ITEM_ICONS[item] ?? DEFAULT_ITEM_ICON} alt="" />
                    <span>Take {item}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Nothing left here.</p>
            )}
            <button className="ghost" onClick={() => setSearchLoot(null)}>Close</button>
          </article>
        </section>
      )}

      {campusMapOpen && (
        <section className="modal-overlay" onClick={() => setCampusMapOpen(false)}>
          <article className="modal-card campus-map-card" onClick={(e) => e.stopPropagation()}>
            <h3>Campus Map</h3>
            <p className="muted">Current location: {titleCase(state.player.location)}</p>
            <div className="campus-map-grid">
              {(content?.locations ?? []).map((location) => (
                <div key={`map-${location.id}`} className={`campus-map-node ${location.id === state.player.location ? "active" : ""}`}>
                  <p className="campus-map-title">{location.name}</p>
                  <p className="campus-map-exits">Exits: {location.exits.map((exit) => titleCase(exit)).join(" • ") || "None"}</p>
                </div>
              ))}
            </div>
            <button className="ghost" onClick={() => setCampusMapOpen(false)}>Close</button>
          </article>
        </section>
      )}

      {beerGameOpen && (
        <section className="beer-fullscreen" aria-label="Beer pong mini game">
          <article className="beer-stage" onClick={(e) => e.stopPropagation()}>
            <div className="beer-top-hud">
              <div className="beer-title-row">
                <h3 className="beer-title">Beer Pong Showdown</h3>
                <span className="beer-match-chip">{beerMatchup === "sonic" ? "Vs Sonic" : "Vs Frat"}</span>
              </div>
              <div className="beer-hud-grid">
                <div className="beer-taunt-card">
                  {beerTaunt ? (
                    <p className="beer-taunt">
                      <strong>{beerTaunt.speaker}:</strong> {beerTaunt.text}
                    </p>
                  ) : (
                    <p className="beer-taunt beer-taunt-idle">
                      <strong>Hype:</strong> Sink shots, build pressure, and clear all 6 cups.
                    </p>
                  )}
                </div>
                <div className="beer-scoreboard" aria-label="Match score board">
                  <p className="beer-scoreboard-title">{beerMatchup === "sonic" ? "Sonic Game" : "Frat Game"}</p>
                  <div className="beer-score-metrics" aria-label="Round counter">
                    <div className={`beer-metric ${cupMetricPulse ? "beer-metric-pulse" : ""}`}>
                      <span className="beer-metric-value">{beerCupsCleared}</span>
                      <span className="beer-metric-label">Cups / 6</span>
                    </div>
                    <div className={`beer-metric ${shotMetricFlash ? "beer-metric-flash" : ""}`}>
                      <span className="beer-metric-value">{beerThrowsUsed}</span>
                      <span className="beer-metric-label">Shots / {beerThrowsTotal}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {beerCountdown > 0 && <p className="beer-countdown">Rack reset... {beerCountdown}</p>}
            <p className="beer-control-legend">
              {beerControlStep === "position"
                ? "Move Shot Positon"
                : "Adjust Toss Arch"}
              {beerPointerMode ? ` Mode: ${beerPointerMode === "launcher" ? "Repositioning launcher" : "Aiming shot"}` : ""}
            </p>
            <div className="beer-control-actions">
              {beerControlStep === "position" ? (
                <button
                  className="beer-control-btn"
                  disabled={beerInFlight || beerThrowsLeft <= 0 || beerCountdown > 0}
                  onClick={() => setBeerControlStep("aim")}
                >
                  Lock Position
                </button>
              ) : (
                <button
                  className="beer-control-btn ghost"
                  disabled={beerInFlight || beerThrowsLeft <= 0 || beerCountdown > 0}
                  onClick={() => {
                    setBeerControlStep("position");
                    setBeerPointerMode(null);
                    setDraggingAim(false);
                    setDraggingLauncher(false);
                  }}
                >
                  Move Shot Positon
                </button>
              )}
            </div>
            {showBeerLauncherTip && (
              <p className="beer-launcher-tip">Tip: Move Shot Positon, Lock Position, then Adjust Toss Arch.</p>
            )}
            <canvas
              ref={beerCanvasRef}
              className={`pong-canvas pong-canvas-wide ${isCompactViewport ? "pong-canvas-compact" : ""}`}
              width={900}
              height={560}
              onPointerDown={(e) => {
                if (beerInFlight || beerThrowsLeft <= 0) return;
                const canvas = beerCanvasRef.current;
                if (!canvas) return;
                if (beerControlStep === "position") {
                  setDraggingLauncher(true);
                  setBeerPointerMode("launcher");
                  updateLauncherFromPointer(e.clientY);
                  return;
                }
                setDraggingAim(true);
                setBeerPointerMode("aim");
                flickStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
                applyAimFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (draggingLauncher) {
                  updateLauncherFromPointer(e.clientY);
                  return;
                }
                if (!draggingAim) return;
                applyAimFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                if (draggingLauncher) {
                  setDraggingLauncher(false);
                  setBeerPointerMode(null);
                  flickStartRef.current = null;
                  return;
                }
                if (!draggingAim) return;
                setDraggingAim(false);
                setBeerPointerMode(null);
                flickToLaunch(e.clientX, e.clientY);
                flickStartRef.current = null;
              }}
              onPointerLeave={() => {
                if (draggingLauncher) {
                  setDraggingLauncher(false);
                  setBeerPointerMode(null);
                  flickStartRef.current = null;
                  return;
                }
                if (!draggingAim) return;
                setDraggingAim(false);
                setBeerPointerMode(null);
                flickStartRef.current = null;
              }}
            />
          </article>
        </section>
      )}

      {stripPokerOpen && stripPokerDeal && (
        <section
          className="modal-overlay"
          onClick={() => {
            if (stripPokerBusy) return;
            void closeStripPokerSession(false);
          }}
        >
          <article className="modal-card strip-poker-card" onClick={(e) => e.stopPropagation()}>
            <div className="strip-poker-head">
              <h3>Strip Poker - 5 Card Stud</h3>
              <span className={`strip-stakes-badge ${stripPokerLosses >= 3 ? "danger" : ""}`}>
                Stakes
              </span>
            </div>
            <p className="muted">
              Next forfeit: {stripPokerNextStake}. Remaining stakes: {stripPokerStakesRemaining}/5.
              {stripPokerLosses >= 4 ? " One more loss means expulsion." : ""}
            </p>
            <div className="strip-stake-track">
              {STRIP_POKER_CLOTHING_STAKES.map((stake, idx) => {
                const lost = idx < stripPokerLosses;
                const next = idx === stripPokerLosses;
                return (
                  <span key={`stake-${stake}`} className={`strip-stake-chip ${lost ? "lost" : ""} ${next ? "next" : ""}`}>
                    {stake}
                  </span>
                );
              })}
            </div>
            <div className="strip-poker-felt round-table">
              <div className="opponent-rail">
                {stripPokerDeal.opponentNames.map((name, idx) => (
                  <div
                    className="opponent-stack"
                    key={`opp-stack-${name}-${idx}`}
                    style={getOpponentSeatStyle(idx, stripPokerDeal.opponentNames.length)}
                  >
                    <span className="opponent-name">{name}</span>
                    <div className="stack-cards">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={`opp-face-${idx}-${i}`}
                          className={`strip-card face-down compact ${stripPokerDeal.stage === "dealing" ? "dealing" : ""}`}
                          disabled
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="player-lane">
                <p className="strip-row-label">
                  <strong>You</strong>
                  <span className="strip-hand-badge">{stripPokerDeal.playerHand}</span>
                </p>
                <div className="strip-cards">
                  {stripPokerDeal.playerCards.map((card, idx) => {
                    const selected = stripPokerDeal.selectedDiscard.includes(idx);
                    return (
                      <button
                        key={`you-${idx}-${card.code}`}
                        className={`strip-card face-up ${selected ? "selected" : ""} ${cardSuitClass(card)} ${stripPokerDeal.stage === "dealing" ? "dealing" : ""}`}
                        disabled={stripPokerDeal.stage !== "deal" || stripPokerBusy}
                        onClick={() => toggleStripDiscard(idx)}
                      >
                        {card.code}
                      </button>
                    );
                  })}
                </div>
              </div>
              {stripPokerDeal.stage === "showdown" && (
                <div className="table-win-banner">
                  <strong>{stripPokerDeal.winningOpponentName}</strong> wins with {stripPokerDeal.winningOpponentHand}
                </div>
              )}
            </div>
            <p className="muted">
              {stripPokerDeal.stage === "deal" ? `Select up to 3 cards, then draw. Strategy: ${titleCase(stripRiskMode)}.` : "Showdown locked."}
              {stripPokerDeal.stage === "showdown" && stripPokerDeal.drawnCards.length > 0
                ? ` | Drew: ${stripPokerDeal.drawnCards.map((c) => c.code).join(" ")}`
                : ""}
            </p>
            {stripPokerDeal.stage === "showdown" && (
              <p className="muted">
                {stripPokerDeal.edgeNote}
              </p>
            )}
            {stripPokerDeal.stage === "deal" && (
              <div className="beer-control-actions">
                <button className="beer-control-btn" onClick={() => autoPickStripDiscards("safe")} disabled={stripPokerBusy}>
                  Auto Safe
                </button>
                <button className="beer-control-btn" onClick={() => autoPickStripDiscards("balanced")} disabled={stripPokerBusy}>
                  Auto Balanced
                </button>
                <button className="beer-control-btn" onClick={() => autoPickStripDiscards("bluff")} disabled={stripPokerBusy}>
                  Auto Bluff
                </button>
              </div>
            )}
            <div className="button-grid strip-poker-actions">
              {stripPokerDeal.stage === "deal" ? (
                <button onClick={drawStripPokerCards} disabled={stripPokerBusy}>
                  Draw ({stripPokerDeal.selectedDiscard.length}/3) • Stake: {stripPokerNextStake}
                </button>
              ) : stripPokerDeal.stage === "dealing" ? (
                <button disabled>
                  Dealing...
                </button>
              ) : (
                <button
                  onClick={async () => {
                    setStripPokerBusy(true);
                    const roundResult = await runAction({ type: "PLAY_STRIP_POKER_ROUND" }, true);
                    if (!roundResult.ok || roundResult.gameOver) {
                      await closeStripPokerSession(false);
                      return;
                    }
                    startStripPokerRound(stripPokerDeal.opponentNpcIds, stripPokerDeal.round + 1);
                    setStripPokerBusy(false);
                  }}
                  disabled={stripPokerBusy}
                >
                  {stripPokerBusy ? "Dealing..." : "Next Hand"}
                </button>
              )}
              <button
                className="ghost"
                onClick={async () => closeStripPokerSession(true)}
                disabled={stripPokerBusy}
              >
                Leave Table
              </button>
            </div>
          </article>
        </section>
      )}

      {beerSummary && (
        <section className="modal-overlay">
          <article className="modal-card beer-result-card">
            <h3 className={beerSummary.cupsHit >= 2 ? "result-win" : "result-loss"}>
              {beerSummary.cupsHit >= 2 ? "Win" : "Loss"}
            </h3>
            <p>{beerSummary.message}</p>
            <p className="muted">{beerSummary.cupsHit}/6 cups in {beerSummary.throwsUsed} shots ({beerSummary.accuracy}% accuracy)</p>
            <button
              onClick={async () => {
                const summary = beerSummary;
                if (!summary) return;
                setBeerSummary(null);
                setBeerGameOpen(false);
                setActiveNpc(beerMatchup === "sonic" ? "sonic" : "frat_boys");
                void runAction({ type: "PLAY_BEER_PONG_SCORE", cupsHit: summary.cupsHit, matchup: beerMatchup }, true);
              }}
            >
              Continue
            </button>
          </article>
        </section>
      )}

      {topToast && !suppressTopToast && (
        <aside className={`top-toast top-toast-${topToast.kind}`} aria-live="polite">
          {topToast.text}
        </aside>
      )}

      {(notice || isResolved) && !showLandingPage && !landingClosing && !isSoggySequenceActive && (
        <section className="modal-overlay">
          <article className={`modal-card ${isResolved ? "official-notice-card" : "status-note-card"}`}>
            {isResolved ? (
              <>
                <div className="official-letterhead">
                  <p className="official-school">Console University</p>
                  <p className="official-dept">Office of Dean Cain</p>
                  <h2>{state.fail.hardFailed ? "Expulsion Notice" : "Mission Completion Record"}</h2>
                </div>
                {shouldShowExpelCard && (
                  <img
                    className="kickout-modal-image"
                    src={kickoutModalImage}
                    alt="Expulsion notice"
                  />
                )}
                <p className="official-body">{state.fail.hardFailed ? state.fail.reason : "Sonic reached Stadium under mission conditions."}</p>
                <button onClick={async () => {
                  setActiveNpc(null);
                  setActiveNpcFocusAtMs(0);
                  setPlayerInput("");
                  setNotice(null);
                  openLandingPage();
                }}>File New Run</button>
              </>
            ) : (
              <>
                <h3>{notice?.title}</h3>
                <p className="official-body">{notice?.body}</p>
                <button
                  onClick={async () => {
                    const forcedTarget = pendingForcedRelocationTargetRef.current;
                    if (forcedTarget) {
                      await runAction({ type: "FORCE_MOVE", target: forcedTarget }, true);
                      pendingForcedRelocationTargetRef.current = null;
                    }
                    setNotice(null);
                  }}
                >
                  Close
                </button>
              </>
            )}
          </article>
        </section>
      )}

      {isSoggySequenceActive && (
        <section className="modal-overlay">
          <article className="modal-card">
            <>
              <img className="kickout-modal-image" src={soggyFratImage} alt="Frat bro laughing" />
              <p><strong>Frat Boys:</strong> HAHAHAHAH Freak!</p>
            </>
          </article>
        </section>
      )}

      {locationSplash && (
        <section className="location-splash-overlay" onClick={() => setLocationSplash(null)}>
          <article className="location-splash-card">
            <p className="location-splash-kicker">{locationSplash.subtitle}</p>
            <h3>{locationSplash.title}</h3>
            <p>{locationSplash.occupants}</p>
          </article>
        </section>
      )}

      {orientationAgendaOpen && (
        <section className="modal-overlay" onClick={() => setOrientationAgendaOpen(false)}>
          <article className="modal-card orientation-agenda-card" onClick={(e) => e.stopPropagation()}>
            <div className="agenda-letterhead">
              <p className="agenda-school">Console University</p>
              <p className="agenda-dept">Office of Mission Intake & Student Operations</p>
              <h3>Orientation Agenda</h3>
              <p className="agenda-meta">Issued to: {orientationAgendaName} • Term: Fall Intake</p>
            </div>
            <p className="agenda-intro"><strong>Dean Cain:</strong> Find Sonic and escort him to Stadium with credentials intact. Keep pressure low, move fast, and avoid bans.</p>
            <div className="agenda-grid">
              <p><span className="agenda-check">✓</span><span className="agenda-item-text"><strong>Talk:</strong> Tap NPC markers for intel.</span></p>
              <p><span className="agenda-check">✓</span><span className="agenda-item-text"><strong>Ask:</strong> Some clues unlock via prompts.</span></p>
              <p><span className="agenda-check">✓</span><span className="agenda-item-text"><strong>Search:</strong> Sweep rooms for route items.</span></p>
              <p><span className="agenda-check">✓</span><span className="agenda-item-text"><strong>Decide:</strong> Every item has risk and upside.</span></p>
              <p><span className="agenda-check">✓</span><span className="agenda-item-text"><strong>Prep Sonic:</strong> Raise compliance, then escort.</span></p>
              <p><span className="agenda-check">✓</span><span className="agenda-item-text"><strong>Complete:</strong> Enter Stadium with Student ID.</span></p>
            </div>
            <button onClick={() => setOrientationAgendaOpen(false)}>Acknowledge</button>
          </article>
        </section>
      )}

      {showLandingPage && (
        <section className={`landing-overlay ${landingClosing ? "landing-overlay-closing" : "landing-overlay-open"}`}>
          <article className="landing-card">
            <div
              className="landing-background"
              style={{ backgroundImage: `url("${landingBackgroundImage}")` }}
              role="img"
              aria-label="Console University landing page"
            />
            <div className="landing-sign-wrap" aria-hidden="true">
              <img className="landing-sign-image" src={landingSignImage} alt="" />
            </div>
            <div className="landing-content">
              <div className="landing-action-row">
                <button
                  className="ghost"
                  disabled={landingClosing}
                  onClick={async () => {
                    await closeLandingPage("continue");
                  }}
                >
                  Continue
                </button>
                <button
                  className="landing-enroll-btn"
                  disabled={landingClosing}
                  onClick={async () => {
                    setActiveNpc(null);
                    setActiveNpcFocusAtMs(0);
                    setPlayerInput("");
                    setNotice(null);
                    setHintCooldownUntilMs(0);
                    await closeLandingPage("enroll");
                  }}
                >
                  Enroll
                </button>
              </div>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}

export default App;
