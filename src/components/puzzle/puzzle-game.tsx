"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Check, FlipHorizontal2, ImageIcon, Lock, Minus, Plus, Puzzle, RotateCcw, Shuffle, Timer, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { CAMERA_ZOOM_STEP, MAX_CAMERA_ZOOM, MIN_CAMERA_ZOOM, cameraCrop, clampCameraZoom, isPhoneCamera } from "@/lib/puzzle/camera";
import { advanceRound, bestScores, formatTime, neighbors, readScores, SCORE_KEY, shufflePuzzle, SOLVED, type Round, type Score } from "@/lib/puzzle/game";
import styles from "./puzzle-game.module.css";

const emptyRound = (): Round => ({ tiles: [...SOLVED], moves: 0, startedAt: null, finishedAt: null });

export function PuzzleGame() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const requestRef = React.useRef(0);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const roundRef = React.useRef<Round>(emptyRound());
  const savedRef = React.useRef(false);
  const [camera, setCamera] = React.useState<"off" | "opening" | "live">("off");
  const [facing, setFacing] = React.useState<"environment" | "user">("environment");
  const [cameraReady, setCameraReady] = React.useState(false);
  const [phoneCamera, setPhoneCamera] = React.useState(false);
  const [zoom, setZoom] = React.useState(MIN_CAMERA_ZOOM);
  const [error, setError] = React.useState("");
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [round, setRound] = React.useState<Round>(emptyRound);
  const [elapsed, setElapsed] = React.useState(0);
  const [numbers, setNumbers] = React.useState(true);
  const [scores, setScores] = React.useState<Score[]>([]);
  const [scoreNotice, setScoreNotice] = React.useState("");
  const [latestId, setLatestId] = React.useState<string | null>(null);
  const playing = round.startedAt !== null && round.finishedAt === null;
  const solved = round.finishedAt !== null;

  const releaseCamera = React.useCallback(() => {
    requestRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = React.useCallback(() => {
    releaseCamera();
    setCamera("off");
    setCameraReady(false);
    setZoom(MIN_CAMERA_ZOOM);
  }, [releaseCamera, setZoom]);

  React.useEffect(() => {
    // A hidden page should not keep a live camera running. The game clock keeps going.
    const onHidden = () => { if (document.hidden) stopCamera(); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", stopCamera);
    return () => {
      releaseCamera();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", stopCamera);
    };
  }, [releaseCamera, stopCamera]);

  React.useEffect(() => {
    const load = () => {
      try { setScores(readScores(localStorage.getItem(SCORE_KEY))); }
      catch { setScoreNotice("Browser storage is unavailable. Scores will last for this visit only."); }
    };
    load();
    const sync = (event: StorageEvent) => { if (event.key === SCORE_KEY || event.key === null) load(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  React.useEffect(() => {
    if (!playing || round.startedAt === null) return;
    const start = round.startedAt;
    const tick = () => setElapsed(Math.max(0, Date.now() - start));
    const interval = window.setInterval(tick, 31);
    return () => window.clearInterval(interval);
  }, [playing, round.startedAt]);

  async function openCamera(nextFacing = facing) {
    releaseCamera();
    const request = requestRef.current;
    setError("");
    setCameraReady(false);
    setZoom(MIN_CAMERA_ZOOM);
    const device = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    setPhoneCamera(isPhoneCamera(device.userAgent, device.userAgentData?.mobile));
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamera("off");
      setError("Live capture needs HTTPS and a browser with camera support. Open this page in Safari, Chrome, or Edge.");
      return;
    }
    setCamera("opening");
    setFacing(nextFacing);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      if (request !== requestRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      if (request !== requestRef.current) return;
      setCamera("live");
      setCameraReady(video.readyState >= 2 && video.videoWidth > 0);
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => {
        if (request !== requestRef.current) return;
        stopCamera();
        setError("The camera disconnected. Reconnect it and open the camera again.");
      }, { once: true }));
    } catch (cause) {
      if (request !== requestRef.current) return;
      stopCamera();
      const name = cause instanceof Error ? cause.name : "";
      setError(name === "NotAllowedError" ? "Camera access was denied. Allow camera access in your browser’s site settings, then try again."
        : name === "NotFoundError" ? "No camera was found. Connect a camera and try again."
        : name === "NotReadableError" ? "Your camera is busy. Close other apps using it and try again."
        : "Could not start the camera. Check camera permissions and try again.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 900;
    const context = canvas.getContext("2d");
    if (!context) { setError("Could not capture this scene. Please try again."); return; }
    const crop = cameraCrop(video.videoWidth, video.videoHeight, zoom);
    context.drawImage(video, crop.x, crop.y, crop.side, crop.side, 0, 0, 900, 900);
    setPhoto(canvas.toDataURL("image/jpeg", 0.9));
    stopCamera();
    setError("");
  }

  function startRound() {
    if (!photo) return;
    const next = { tiles: shufflePuzzle(), moves: 0, startedAt: Date.now(), finishedAt: null };
    roundRef.current = next;
    savedRef.current = false;
    setRound(next);
    setElapsed(0);
    setLatestId(null);
    boardRef.current?.focus();
  }

  function move(index: number) {
    const previous = roundRef.current;
    const next = advanceRound(previous, index, Date.now());
    if (next === previous) return;
    roundRef.current = next;
    setRound(next);
    if (next.finishedAt !== null && next.startedAt !== null && !savedRef.current) {
      savedRef.current = true;
      const elapsedMs = Math.max(0, next.finishedAt - next.startedAt);
      setElapsed(elapsedMs);
      const score: Score = { id: crypto.randomUUID(), elapsedMs, moves: next.moves, completedAt: new Date(next.finishedAt).toISOString() };
      let merged = bestScores([...scores, score]);
      try {
        merged = bestScores([...readScores(localStorage.getItem(SCORE_KEY)), ...scores, score]);
        localStorage.setItem(SCORE_KEY, JSON.stringify(merged));
        setScoreNotice("");
      } catch { setScoreNotice("Your time is shown here, but browser storage is unavailable. It won’t be saved after you leave."); }
      setScores(merged);
      setLatestId(score.id);
    }
    boardRef.current?.focus();
  }

  function newScene() {
    stopCamera();
    roundRef.current = emptyRound();
    setRound(roundRef.current);
    setPhoto(null);
    setElapsed(0);
    setError("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!playing) return;
    const offset = { ArrowUp: 3, ArrowDown: -3, ArrowLeft: 1, ArrowRight: -1 }[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    move(roundRef.current.tiles.indexOf(0) + offset);
  }

  const movable = neighbors(round.tiles.indexOf(0));
  const correct = round.tiles.filter((tile, index) => tile !== 0 && tile === SOLVED[index]).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}><ArrowLeft size={16} /> Peripheral</Link>
        <span className={styles.privacy}><Lock size={13} /> Photos stay on your device</span>
      </header>
      <div className={styles.intro}>
        <span className={styles.eyebrow}><Puzzle size={14} /> A LITTLE FOCUS BREAK</span>
        <h1>Your world.<br /><span>Piece it together.</span></h1>
        <p>Capture a scene. Slide eight pieces into place.<br className={styles.desktopBreak} /> Find your flow, and beat your best time.</p>
      </div>

      <div className={styles.layout}>
        <section className={styles.playArea} aria-label="Scene puzzle">
          <div className={styles.sectionHeading}>
            <h2><span className={styles.dot} /> {solved ? "Picture perfect" : playing ? "Find the full picture" : photo ? "Your scene is ready" : "Make it your scene"}</h2>
            <span className={styles.pill}>3 × 3 · 8 TILES</span>
          </div>

          {!photo ? (
            <div className={styles.captureFrame}>
              <video ref={videoRef} muted playsInline autoPlay className={styles.video} style={{ transform: `scale(${zoom})` }} onLoadedData={() => setCameraReady(true)} aria-label="Live camera preview" />
              {camera !== "live" && <div className={styles.cameraPlaceholder}>
                <div className={styles.cameraIcon}><Camera size={34} strokeWidth={1.4} /></div>
                <h3>{camera === "opening" ? "Opening your camera…" : "Every scene is a new puzzle"}</h3>
                <p>{camera === "opening" ? "Allow camera access when your browser asks." : "Point your camera at something with plenty of detail."}</p>
                {camera === "off" && <Button variant="signal" size="lg" onClick={() => void openCamera()}><Camera /> Open camera</Button>}
              </div>}
              {camera === "live" && <div className={styles.viewfinder} aria-hidden="true" />}
              {camera !== "off" && <Button className={styles.closeCamera} variant="outline" size="icon" aria-label="Close camera" onClick={stopCamera}><X /></Button>}
            </div>
          ) : (
            <div ref={boardRef} className={`${styles.board} ${solved ? styles.solved : ""}`} tabIndex={0} onKeyDown={onKeyDown} role="group" aria-label="Sliding photo puzzle" aria-describedby="puzzle-instructions">
              {round.tiles.map((tile, index) => {
                if (tile === 0 && !solved && round.startedAt !== null) return <div key={0} className={styles.gap} style={{ left: `${index % 3 * 100 / 3}%`, top: `${Math.floor(index / 3) * 100 / 3}%` }} aria-label="Empty space"><span>+<small>THE GAP</small></span></div>;
                const piece = tile === 0 ? 9 : tile;
                return <button key={tile} type="button" className={`${styles.tile} ${playing && movable.includes(index) ? styles.movable : ""}`} onClick={() => move(index)} tabIndex={-1} disabled={!playing || !movable.includes(index)} aria-label={`Tile ${piece}, row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}${playing && movable.includes(index) ? ", slide into gap" : ""}`} style={{ left: `${index % 3 * 100 / 3}%`, top: `${Math.floor(index / 3) * 100 / 3}%`, backgroundImage: `url("${photo}")`, backgroundSize: "300% 300%", backgroundPosition: `${(piece - 1) % 3 * 50}% ${Math.floor((piece - 1) / 3) * 50}%` }}>
                  {numbers && !solved && <span className={styles.tileNumber}>{piece}</span>}
                </button>;
              })}
            </div>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}
          {!photo && camera === "live" && phoneCamera && (
            <div className={styles.zoomControls} role="group" aria-label="Camera zoom">
              <div className={styles.zoomHeading}>
                <span>Digital zoom</span>
                <Button variant="ghost" size="sm" aria-label="Reset camera zoom to 1×" onClick={() => setZoom(MIN_CAMERA_ZOOM)}>{zoom.toFixed(1)}× · Reset</Button>
              </div>
              <div className={styles.zoomSlider}>
                <Button className={styles.zoomButton} variant="outline" size="icon" aria-label="Zoom out" disabled={zoom <= MIN_CAMERA_ZOOM} onClick={() => setZoom((value) => clampCameraZoom(value - CAMERA_ZOOM_STEP))}><Minus /></Button>
                <Slider aria-label="Camera zoom multiplier" min={MIN_CAMERA_ZOOM} max={MAX_CAMERA_ZOOM} step={CAMERA_ZOOM_STEP} value={[zoom]} onValueChange={([value]) => setZoom(clampCameraZoom(value ?? MIN_CAMERA_ZOOM))} />
                <Button className={styles.zoomButton} variant="outline" size="icon" aria-label="Zoom in" disabled={zoom >= MAX_CAMERA_ZOOM} onClick={() => setZoom((value) => clampCameraZoom(value + CAMERA_ZOOM_STEP))}><Plus /></Button>
              </div>
              <p>1×–3× · Your photo matches this preview.</p>
            </div>
          )}
          <div className={styles.actions}>
            {!photo && camera === "live" && <><Button variant="signal" size="lg" disabled={!cameraReady} onClick={capture}><Camera /> Capture scene</Button><Button aria-label="Switch front and back camera" onClick={() => void openCamera(facing === "user" ? "environment" : "user")}><FlipHorizontal2 /> Flip</Button></>}
            {photo && !playing && <Button variant="signal" size="lg" onClick={startRound}>{solved ? <RotateCcw /> : <Shuffle />}{solved ? "Play again" : "Shuffle & start"}</Button>}
            {photo && <Button variant="ghost" onClick={newScene}><Camera />{playing ? "New scene (ends round)" : "Retake scene"}</Button>}
          </div>

          <div className={styles.timerBoard} aria-label="Timer board">
            <div><span className={styles.statLabel}><Timer size={14} /> {solved ? "FINAL TIME" : "YOUR TIME"}</span><output className={styles.time} aria-live="off">{formatTime(elapsed)}</output></div>
            <div><span className={styles.statLabel}>MOVES</span><span className={styles.statValue}>{round.moves.toString().padStart(2, "0")}</span></div>
            <div><span className={styles.statLabel}>IN PLACE</span><span className={styles.statValue}>{round.startedAt === null ? "—" : `${correct}/8`}</span></div>
          </div>
          <p role="status" className={`${styles.status} ${solved ? styles.success : ""}`}>
            {solved ? <><Check size={18} /> Solved in {formatTime(elapsed)} with {round.moves} moves. {scores.some((score) => score.id === latestId) ? "You made your top 10!" : "Try again to beat your top 10."}</> : playing ? "The clock is running. You’ve got this." : "The timer starts when you choose Shuffle & start."}
          </p>
          <p id="puzzle-instructions" className={styles.instructions}>Tap a tile next to the gap to slide it. With the board focused, use the arrow keys to move a tile in that direction. Rebuild the picture with the gap at the bottom right. The timer keeps running if you switch tabs.</p>
        </section>

        <aside className={styles.sidebar}>
          <section className={styles.reference} aria-label="Original scene">
            <div className={styles.sectionHeading}><h2><ImageIcon size={16} /> The full picture</h2></div>
            {photo ? <div className={styles.referencePhoto} role="img" aria-label="Original captured scene to match" style={{ backgroundImage: `url("${photo}")` }} /> : <div className={styles.referenceEmpty}><ImageIcon size={25} /><p>Your captured scene<br />will appear here.</p></div>}
            <div className={styles.numberSetting}><label htmlFor="tile-numbers">Tile numbers</label><Switch id="tile-numbers" checked={numbers} onCheckedChange={setNumbers} /></div>
          </section>

          <section className={styles.scores} aria-labelledby="best-times">
            <div className={styles.sectionHeading}><h2 id="best-times"><Trophy size={18} className={styles.trophy} /> Your best 10</h2><span className={styles.pill}>FASTEST FIRST</span></div>
            <p className={styles.scoreSubtitle}>Personal records on this browser.</p>
            <ol className={styles.scoreList}>
              {Array.from({ length: 10 }, (_, index) => {
                const score = scores[index];
                return <li key={index} className={`${styles.scoreRow} ${score?.id === latestId ? styles.latest : ""}`}>
                  <span className={`${styles.rank} ${index < 3 ? styles[`rank${index}`] : ""}`} aria-label={`Rank ${index + 1}`}>{index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1}</span>
                  <span className={styles.scoreDetails}><strong>{score ? formatTime(score.elapsedMs) : "— — : — —"}</strong><small>{score ? `${score.moves} moves · ${new Date(score.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : index === 0 ? "Your first finish starts here" : "Waiting for your next win"}</small></span>
                  {score?.id === latestId && <span className={styles.newBadge}>NEW</span>}
                </li>;
              })}
            </ol>
            {scoreNotice && <p role="status" className={styles.storageNotice}>{scoreNotice}</p>}
          </section>
        </aside>
      </div>
      <footer className={styles.footer}><Lock size={12} /> No uploads. Just your scene, your focus, and your next personal best.</footer>
    </main>
  );
}
