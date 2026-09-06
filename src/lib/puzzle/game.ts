export const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 0];
export const SCORE_KEY = "peripheral:puzzle-best:v1";

export function neighbors(index: number): number[] {
  return [index - 3, index + 3, index - 1, index + 1].filter(
    (other) => other >= 0 && other < 9 &&
      Math.abs(Math.floor(other / 3) - Math.floor(index / 3)) +
      Math.abs(other % 3 - index % 3) === 1,
  );
}

export function isSolved(tiles: number[]) {
  return tiles.length === 9 && tiles.every((tile, i) => tile === SOLVED[i]);
}

export function moveTile(tiles: number[], index: number): number[] {
  const gap = tiles.indexOf(0);
  if (!neighbors(gap).includes(index)) return tiles;
  const next = [...tiles];
  [next[gap], next[index]] = [next[index], next[gap]];
  return next;
}

/** Legal moves from the goal preserve solvability; avoid immediate reversals. */
export function shufflePuzzle(random = Math.random): number[] {
  let tiles = [...SOLVED];
  let previousGap = -1;
  for (let step = 0; step < 120; step++) {
    const gap = tiles.indexOf(0);
    const choices = neighbors(gap).filter((index) => index !== previousGap);
    tiles = moveTile(tiles, choices[Math.floor(random() * choices.length)]);
    previousGap = gap;
  }
  return isSolved(tiles) ? moveTile(tiles, 7) : tiles;
}

export type Round = {
  tiles: number[];
  moves: number;
  startedAt: number | null;
  finishedAt: number | null;
};

export function advanceRound(round: Round, index: number, now: number): Round {
  if (round.startedAt === null || round.finishedAt !== null) return round;
  const tiles = moveTile(round.tiles, index);
  if (tiles === round.tiles) return round;
  return { ...round, tiles, moves: round.moves + 1, finishedAt: isSolved(tiles) ? now : null };
}

export type Score = { id: string; elapsedMs: number; moves: number; completedAt: string };

export function bestScores(value: unknown): Score[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is Score => {
    if (!item || typeof item !== "object") return false;
    const score = item as Partial<Score>;
    if (typeof score.id !== "string" || !score.id || seen.has(score.id) ||
      typeof score.elapsedMs !== "number" || !Number.isFinite(score.elapsedMs) || score.elapsedMs < 0 ||
      typeof score.moves !== "number" || !Number.isSafeInteger(score.moves) || score.moves < 1 ||
      typeof score.completedAt !== "string" || !Number.isFinite(Date.parse(score.completedAt))) return false;
    seen.add(score.id);
    return true;
  }).sort((a, b) => a.elapsedMs - b.elapsedMs || a.moves - b.moves || a.completedAt.localeCompare(b.completedAt)).slice(0, 10);
}

export function readScores(raw: string | null): Score[] {
  try { return bestScores(JSON.parse(raw ?? "[]")); } catch { return []; }
}

export function formatTime(ms: number): string {
  const hundredths = Math.floor(Math.max(0, ms) / 10);
  const minutes = Math.floor(hundredths / 6000).toString().padStart(2, "0");
  const seconds = (Math.floor(hundredths / 100) % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}.${(hundredths % 100).toString().padStart(2, "0")}`;
}
