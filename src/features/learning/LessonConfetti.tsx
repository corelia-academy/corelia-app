import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CONFETTI_TOKEN_NAMES = [
  "--confetti-yellow",
  "--confetti-green",
  "--confetti-sky",
  "--confetti-teal",
  "--confetti-coral",
  "--confetti-purple",
] as const;

/** Matches the 150 confetti pieces in Figma's Confetti 3 instance on a single GPU canvas layer. */
const PARTICLE_COUNT = 150;

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  tiltAngle: number;
  tiltSpeed: number;
  opacity: number;
}

export interface LessonConfettiProps {
  /** Increments each time a fresh celebration burst should play. */
  burstKey: number;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function LessonConfetti({ burstKey, className }: LessonConfettiProps) {
  const [dismissedKey, setDismissedKey] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = burstKey > 0 && burstKey !== dismissedKey && !prefersReducedMotion();

  useEffect(() => {
    if (!burstKey || prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const styles = window.getComputedStyle(canvas);
    const palette = CONFETTI_TOKEN_NAMES.map(token => styles.getPropertyValue(token).trim()).filter(Boolean);
    if (!palette.length) return;

    const host = canvas.closest("main") ?? canvas.parentElement ?? canvas;
    const rect = host.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 800;
    const height = rect.height > 0 ? rect.height : 600;
    if (rect.width > 0 && rect.height > 0) {
      canvas.style.top = `${rect.top}px`;
      canvas.style.left = `${rect.left}px`;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
    const dpr = typeof window.devicePixelRatio === "number" ? Math.min(window.devicePixelRatio, 2) : 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles: ConfettiParticle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const isWide = i % 2 === 0;
      // Launch from the bottom across a wide base, fanning out upward like a firework burst.
      const originX = (0.18 + ((i * 29) % 64) / 100) * width;
      const spreadAngle = (((i * 41) % 29) - 14) * (Math.PI / 42);
      const launchSpeed = 16 + ((i * 19) % 14) * 1.15;

      return {
        x: originX,
        y: height + (i % 12) * 8,
        vx: Math.sin(spreadAngle) * (launchSpeed * 0.75),
        vy: -Math.cos(spreadAngle) * launchSpeed,
        width: isWide ? 9 : 8,
        height: isWide ? 11 : 15,
        color: palette[i % palette.length],
        rotation: ((i * 53) % 360) * (Math.PI / 180),
        rotationSpeed: ((i % 2 === 0 ? 1 : -1) * (2.2 + (i % 5) * 0.8)) * (Math.PI / 180),
        tiltAngle: (i * 0.4) % Math.PI,
        tiltSpeed: 0.08 + (i % 5) * 0.025,
        opacity: 1,
      };
    });

    let frameId = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      let activeCount = 0;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.vy < 0) {
          // Phase 1 (Shooting upward): decelerate under gravity and air drag until reaching the apex.
          p.vx *= 0.985;
          p.vy = p.vy * 0.98 + 0.45;
        } else {
          // Phase 2 (Fluttering downward): gentle terminal velocity and fade out on the way down.
          p.vx *= 0.992;
          p.vy = Math.min(p.vy + 0.14, 4.8);
          if (p.y > height * 0.55) {
            p.opacity = Math.max(0, p.opacity - 0.025);
          }
        }

        p.rotation += p.rotationSpeed;
        p.tiltAngle += p.tiltSpeed;

        if ((p.vy < 0 || p.y < height + 40) && p.opacity > 0.01) {
          activeCount++;
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.scale(1, Math.cos(p.tiltAngle));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          ctx.restore();
        }
      }

      if (activeCount > 0) {
        frameId = window.requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
        setDismissedKey(burstKey);
      }
    };

    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      ctx.clearRect(0, 0, width, height);
    };
  }, [burstKey]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="lesson-confetti"
      className={cn("pointer-events-none fixed inset-0 z-20", className)}
    />
  );
}
