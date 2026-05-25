import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import backgroundImageUrl from "../Images/background.png";
import scopeImageUrl from "../Images/scope.png";
import shellImageUrl from "../Images/shell.png";
import sideImageUrl from "../Images/Side.png";
import gunLoadSoundUrl from "../SFX/gun-load.mp3";
import hitSoundUrl from "../SFX/hit.mp3";
import m4a1SoundUrl from "../SFX/m4a1.mp3";
import rifleLoadSoundUrl from "../SFX/rifle-load.mp3";
import shellsFallSoundUrl from "../SFX/shells_falls.mp3";
import "./styles.css";

const DOT_SIZE = 14;
const RING_MULTIPLIER = 5;
const RESIZE_TIME_MS = 3000;
const SCOPED_SIZE_MULTIPLIER = 3;
const NORMAL_SCORE_BASE = 100;
const SCOPED_SCORE_BASE = 50;
const CANVAS_RADIUS_VIEWPORT_HEIGHT = 0.3;
const TARGETS_PER_ROUND = 10;
const MAX_MISSES = 10;
const ROUND_DOT_FACTOR = 0.8;
const ROUND_TIME_FACTOR = 0.8;
const ROUND_SCORE_FACTOR = 1.5;
const ROUND_DELAY_MS = 2000;

const SIDE_IMAGE = sideImageUrl;
const SCOPE_IMAGE = scopeImageUrl;
const SHELL_IMAGE = shellImageUrl;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function makeTarget(width, height, dotRadius, ringMultiplier) {
  const startRadius = dotRadius * ringMultiplier;
  const center = { x: width / 2, y: height / 2 };
  const playRadius = Math.max(1, Math.min(width, height) / 2 - startRadius);
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * playRadius;

  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
    startedAt: performance.now(),
    startRadius,
  };
}

function App() {
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const targetRef = useRef(null);
  const scopedRef = useRef(false);
  const gameRef = useRef(null);
  const soundsRef = useRef({});
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 640 });
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [round, setRound] = useState(1);
  const [targetsThisRound, setTargetsThisRound] = useState(0);
  const [sessionOver, setSessionOver] = useState(false);
  const [isScoped, setIsScoped] = useState(false);

  const variables = useMemo(
    () => ({
      dotSize: DOT_SIZE,
      ringMultiplier: RING_MULTIPLIER,
      resizeTimeMs: RESIZE_TIME_MS,
      scopedSizeMultiplier: SCOPED_SIZE_MULTIPLIER,
      normalScoreBase: NORMAL_SCORE_BASE,
      scopedScoreBase: SCOPED_SCORE_BASE,
      canvasRadiusViewportHeight: CANVAS_RADIUS_VIEWPORT_HEIGHT,
      targetsPerRound: TARGETS_PER_ROUND,
      maxMisses: MAX_MISSES,
      roundDelayMs: ROUND_DELAY_MS,
    }),
    []
  );

  useEffect(() => {
    soundsRef.current = {
      gunshot: new Audio(m4a1SoundUrl),
      shellFall: new Audio(shellsFallSoundUrl),
      roundLoad: new Audio(gunLoadSoundUrl),
      gameLost: new Audio(rifleLoadSoundUrl),
      hit: new Audio(hitSoundUrl),
    };
  }, []);

  const playSound = (name) => {
    const sound = soundsRef.current[name];
    if (!sound) {
      return;
    }

    sound.currentTime = 0;
    sound.play().catch(() => {});
  };

  const resetGame = () => {
    const nextGame = {
      dotSize: DOT_SIZE,
      resizeTimeMs: RESIZE_TIME_MS,
      normalScoreBase: NORMAL_SCORE_BASE,
      scopedScoreBase: SCOPED_SCORE_BASE,
      round: 1,
      targetsThisRound: 0,
      misses: 0,
      sessionOver: false,
      nextTargetAt: 0,
    };

    gameRef.current = nextGame;
    targetRef.current = makeTarget(
      canvasSize.width,
      canvasSize.height,
      nextGame.dotSize / 2,
      RING_MULTIPLIER
    );
    setScore(0);
    setHits(0);
    setMisses(0);
    setRound(1);
    setTargetsThisRound(0);
    setSessionOver(false);
  };

  const advanceTarget = ({ missed }) => {
    const game = gameRef.current;
    if (!game || game.sessionOver) {
      return;
    }

    if (missed) {
      game.misses += 1;
      setMisses(game.misses);
      playSound("shellFall");
    }

    if (game.misses >= MAX_MISSES) {
      game.sessionOver = true;
      targetRef.current = null;
      setSessionOver(true);
      playSound("gameLost");
      return;
    }

    game.targetsThisRound += 1;

    if (game.targetsThisRound >= TARGETS_PER_ROUND) {
      game.targetsThisRound = 0;
      game.round += 1;
      game.dotSize *= ROUND_DOT_FACTOR;
      game.resizeTimeMs *= ROUND_TIME_FACTOR;
      game.normalScoreBase *= ROUND_SCORE_FACTOR;
      game.scopedScoreBase *= ROUND_SCORE_FACTOR;
      game.nextTargetAt = performance.now() + ROUND_DELAY_MS;
      setRound(game.round);
      playSound("roundLoad");
    }

    setTargetsThisRound(game.targetsThisRound);
    if (game.nextTargetAt > performance.now()) {
      targetRef.current = null;
      return;
    }

    targetRef.current = makeTarget(
      canvasSize.width,
      canvasSize.height,
      game.dotSize / 2,
      RING_MULTIPLIER
    );
  };

  useEffect(() => {
    const updateSize = () => {
      setCanvasSize({
        width: Math.floor(window.innerHeight * CANVAS_RADIUS_VIEWPORT_HEIGHT * 2),
        height: Math.floor(window.innerHeight * CANVAS_RADIUS_VIEWPORT_HEIGHT * 2),
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const game =
      gameRef.current ??
      {
        dotSize: DOT_SIZE,
        resizeTimeMs: RESIZE_TIME_MS,
        normalScoreBase: NORMAL_SCORE_BASE,
        scopedScoreBase: SCOPED_SCORE_BASE,
        round: 1,
        targetsThisRound: 0,
        misses: 0,
        sessionOver: false,
        nextTargetAt: 0,
      };

    gameRef.current = game;
    if (game.nextTargetAt > performance.now()) {
      targetRef.current = null;
      return;
    }

    targetRef.current = makeTarget(
      canvasSize.width,
      canvasSize.height,
      game.dotSize / 2,
      RING_MULTIPLIER
    );
  }, [canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = (now) => {
      context.clearRect(0, 0, canvasSize.width, canvasSize.height);
      const game = gameRef.current;
      let target = targetRef.current;
      if (!game?.sessionOver && !target && now >= (game?.nextTargetAt ?? 0)) {
        if (game) {
          game.nextTargetAt = 0;
        }

        target = makeTarget(
          canvasSize.width,
          canvasSize.height,
          (game?.dotSize ?? DOT_SIZE) / 2,
          RING_MULTIPLIER
        );
        targetRef.current = target;
      }

      if (target && !game?.sessionOver) {
        const elapsed = now - target.startedAt;
        const resizeTimeMs = game?.resizeTimeMs ?? RESIZE_TIME_MS;
        const progress = clamp(elapsed / resizeTimeMs, 0, 1);

        if (progress >= 1) {
          advanceTarget({ missed: true });
        } else {
          const scopedScale = scopedRef.current ? SCOPED_SIZE_MULTIPLIER : 1;
          const dotRadius = ((game?.dotSize ?? DOT_SIZE) / 2) * scopedScale;
          const startRadius = target.startRadius * scopedScale;
          const ringRadius = startRadius - (startRadius - dotRadius) * progress;

          context.beginPath();
          context.arc(target.x, target.y, ringRadius, 0, Math.PI * 2);
          context.strokeStyle = "#ff2d2d";
          context.lineWidth = 4;
          context.shadowColor = "rgba(255, 35, 35, 0.6)";
          context.shadowBlur = 12;
          context.stroke();

          context.shadowBlur = 0;
          context.beginPath();
          context.arc(target.x, target.y, dotRadius, 0, Math.PI * 2);
          context.fillStyle = "#e60012";
          context.fill();
        }
      }

      const centerX = canvasSize.width / 2;
      const centerY = canvasSize.height / 2;
      context.strokeStyle = "rgba(255, 255, 255, 0.85)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(centerX - 14, centerY);
      context.lineTo(centerX + 14, centerY);
      context.moveTo(centerX, centerY - 14);
      context.lineTo(centerX, centerY + 14);
      context.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationRef.current);
  }, [canvasSize]);

  const handleShot = (event) => {
    const game = gameRef.current;
    if (event.button !== 0 || !targetRef.current || game?.sessionOver) {
      return;
    }

    playSound("gunshot");

    const rect = canvasRef.current.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const target = targetRef.current;
    const scopedScale = scopedRef.current ? SCOPED_SIZE_MULTIPLIER : 1;
    const dotRadius = ((game?.dotSize ?? DOT_SIZE) / 2) * scopedScale;
    const originalRingRadius = target.startRadius * scopedScale;
    const shotDistance = distance(point, target);

    if (shotDistance <= originalRingRadius) {
      const elapsed = performance.now() - target.startedAt;
      const scoreBase = scopedRef.current
        ? game?.scopedScoreBase ?? SCOPED_SCORE_BASE
        : game?.normalScoreBase ?? NORMAL_SCORE_BASE;
      const resizeTimeMs = game?.resizeTimeMs ?? RESIZE_TIME_MS;
      const distanceScore = scoreBase * (dotRadius / Math.max(1, shotDistance));
      const timeScore = scoreBase * (resizeTimeMs / Math.max(1, elapsed));

      setScore((value) => value + Math.round(distanceScore + timeScore));
      setHits((value) => value + 1);
      playSound("hit");
      advanceTarget({ missed: false });
    } else {
      advanceTarget({ missed: true });
    }
  };

  const setScopedMode = (value) => {
    scopedRef.current = value;
    setIsScoped(value);
  };

  return (
    <main
      className={`app ${isScoped ? "is-scoped" : ""}`}
      style={{ "--background-image": `url(${backgroundImageUrl})` }}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (event.button === 2) {
          setScopedMode(true);
        }
      }}
      onMouseUp={(event) => {
        if (event.button === 2) {
          setScopedMode(false);
        }
      }}
      onMouseLeave={() => setScopedMode(false)}
    >
      <section
        className="target-area"
        aria-label="Target practice canvas"
        style={{ width: canvasSize.width, height: canvasSize.height }}
      >
        <canvas ref={canvasRef} onMouseDown={handleShot} />
      </section>

      <aside className="side-panel" aria-label="Reference image">
        <img src={isScoped ? SCOPE_IMAGE : SIDE_IMAGE} alt="" />
      </aside>

      <div className="hud" aria-live="polite">
        <div className="hud-stats">
          <span>Score {score}</span>
          <span>Hits {hits}</span>
          <span>Misses {misses}</span>
          <span>Round {round}</span>
          <span>
            Target {targetsThisRound + 1}/{variables.targetsPerRound}
          </span>
        </div>
        <div className="shells" aria-label={`${variables.maxMisses - misses} shells remaining`}>
          {[0, 1].map((group) => (
            <div className="shell-stack" key={group}>
              {Array.from({ length: variables.maxMisses / 2 }, (_, stackIndex) => {
                const index = group * 5 + stackIndex;

                return (
                  <img
                    key={index}
                    className={index < misses ? "is-dropped" : ""}
                    style={{ "--shell-offset": stackIndex, "--shell-layer": stackIndex + 1 }}
                    src={SHELL_IMAGE}
                    alt=""
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="settings">
        <span>Dot {variables.dotSize}px</span>
        <span>Ring x{variables.ringMultiplier}</span>
        <span>{variables.resizeTimeMs / 1000}s</span>
        <span>Radius {variables.canvasRadiusViewportHeight * 100}vh</span>
        <span>{isScoped ? `Scope x${variables.scopedSizeMultiplier}` : "Normal"}</span>
      </div>

      {sessionOver && (
        <div className="session-over" role="dialog" aria-modal="true" aria-labelledby="final-score">
          <div className="session-over-panel">
            <h1 id="final-score">Score {score}</h1>
            <p>Session finished at {variables.maxMisses} misses.</p>
            <button type="button" onClick={resetGame}>
              Restart
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
