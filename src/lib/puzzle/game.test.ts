import { describe, expect, it } from "vitest";
import { advanceRound, bestScores, formatTime, isSolved, moveTile, neighbors, readScores, shufflePuzzle, SOLVED, type Score } from "./game";

describe("sliding puzzle", () => {
  it("does not wrap a tile across a row or allow diagonal/empty moves", () => {
    expect(neighbors(2).sort()).toEqual([1, 5]);
    const tiles = [1, 2, 0, 4, 5, 3, 7, 8, 6];
    for (const illegal of [-1, 2, 3, 4, 9]) expect(moveTile(tiles, illegal)).toBe(tiles);
    expect(moveTile(tiles, 5)).toEqual([1, 2, 3, 4, 5, 0, 7, 8, 6]);
    expect(tiles).toEqual([1, 2, 0, 4, 5, 3, 7, 8, 6]);
  });

  it("generates valid, unsolved, solvable boards over 1000 seeded shuffles", () => {
    let seed = 123456;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let attempt = 0; attempt < 1000; attempt++) {
      const tiles = shufflePuzzle(random);
      expect([...tiles].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      expect(isSolved(tiles)).toBe(false);
      // Independent invariant: an odd-width puzzle is solvable iff inversions are even.
      const pieces = tiles.filter(Boolean);
      let inversions = 0;
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) if (pieces[i] > pieces[j]) inversions++;
      }
      expect(inversions % 2).toBe(0);
    }
  });

  it("counts legal moves and freezes the exact final timestamp once solved", () => {
    const round = { tiles: [1, 2, 3, 4, 5, 6, 7, 0, 8], moves: 20, startedAt: 1000, finishedAt: null };
    expect(advanceRound(round, 0, 2000)).toBe(round);
    const complete = advanceRound(round, 8, 65321);
    expect(complete).toEqual({ tiles: SOLVED, moves: 21, startedAt: 1000, finishedAt: 65321 });
    expect(advanceRound(complete, 7, 70000)).toBe(complete);
    const notStarted = { ...round, startedAt: null };
    expect(advanceRound(notStarted, 8, 2000)).toBe(notStarted);
  });
});

describe("personal scoreboard", () => {
  const score = (id: string, elapsedMs: number, moves = 30): Score => ({ id, elapsedMs, moves, completedAt: "2026-09-06T12:00:00.000Z" });

  it("keeps the fastest ten, breaks tied times by moves, and removes duplicate saves", () => {
    const scores = Array.from({ length: 12 }, (_, i) => score(String(i), (12 - i) * 1000));
    const result = bestScores([...scores, score("fast", 1000, 20), scores[0]]);
    expect(result).toHaveLength(10);
    expect(result.slice(0, 3).map((s) => s.id)).toEqual(["fast", "11", "10"]);
    expect(result.at(-1)?.elapsedMs).toBe(9000);
    expect(readScores(JSON.stringify(result))).toEqual(result);
  });

  it("recovers from malformed storage and rejects invalid score fields", () => {
    expect(readScores("not json")).toEqual([]);
    expect(readScores('{"id":"bad"}')).toEqual([]);
    expect(readScores(null)).toEqual([]);
    expect(bestScores([null, {}, score("negative", -1), score("nan", NaN), score("infinity", Infinity), score("no-moves", 100, 0), { ...score("date", 100), completedAt: "bad" }, score("ok", 1000)])).toEqual([score("ok", 1000)]);
  });

  it("formats hundredths, minute boundaries, and long rounds without wrapping", () => {
    expect(formatTime(0)).toBe("00:00.00");
    expect(formatTime(59999)).toBe("00:59.99");
    expect(formatTime(60000)).toBe("01:00.00");
    expect(formatTime(3600123)).toBe("60:00.12");
  });
});
