import { useEffect, useRef } from "react";
import "./shared.css";

/**
 * Canvas de particules flottantes médiévales.
 *
 * Variants :
 * - "dust"   (défaut) : poussière dorée subtile, 25 particules
 * - "embers" : mix poussière + braises orangées, 30 particules (plus cinématique)
 */

interface MedievalParticlesProps {
  variant?: "dust" | "embers";
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  fadeDir: number;
  life: number;
  isEmber: boolean;
}

const PRESETS = {
  dust:   { count: 25, embers: false, oscillation: 0.001,  swing: 0.15, maxOpacity: 0.6, fadeSpeed: 0.003 },
  embers: { count: 30, embers: true,  oscillation: 0.0008, swing: 0.20, maxOpacity: 0.5, fadeSpeed: 0.002 },
} as const;

export function MedievalParticles({ variant = "dust", className }: MedievalParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const preset = PRESETS[variant];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    particlesRef.current = Array.from({ length: preset.count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: -Math.random() * 0.4 - 0.1,
      opacity: Math.random() * 0.4 + 0.1,
      fadeDir: Math.random() > 0.5 ? 1 : -1,
      life: Math.random(),
      isEmber: preset.embers && Math.random() > 0.7,
    }));

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.x += p.speedX + Math.sin(Date.now() * preset.oscillation + p.life * 10) * preset.swing;
        p.y += p.speedY;
        p.opacity += p.fadeDir * preset.fadeSpeed;
        if (p.opacity > preset.maxOpacity) p.fadeDir = -1;
        if (p.opacity < 0.05) p.fadeDir = 1;

        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.beginPath();
        if (p.isEmber) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
          g.addColorStop(0, `rgba(255, 160, 40, ${p.opacity})`);
          g.addColorStop(0.5, `rgba(255, 100, 20, ${p.opacity * 0.4})`);
          g.addColorStop(1, `rgba(255, 60, 10, 0)`);
          ctx.fillStyle = g;
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        } else {
          ctx.fillStyle = `rgba(222, 198, 160, ${p.opacity})`;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [variant]);

  return <canvas ref={canvasRef} className={`medieval-particles ${className ?? ""}`} />;
}
