import { useEffect, useRef } from "react";

/**
 * Particules pour les crédits : mix poussière dorée + braises.
 * Plus "cinématique" que le chat.
 */
export function CreditsParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    x: number; y: number; size: number;
    speedX: number; speedY: number;
    opacity: number; fadeDir: number;
    life: number; isEmber: boolean;
  }>>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // 30 particules : 70% poussière, 30% braises
    particlesRef.current = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.2,
      speedY: -Math.random() * 0.5 - 0.1,
      opacity: Math.random() * 0.4 + 0.1,
      fadeDir: Math.random() > 0.5 ? 1 : -1,
      life: Math.random(),
      isEmber: Math.random() > 0.7,
    }));

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.x += p.speedX + Math.sin(Date.now() * 0.0008 + p.life * 10) * 0.2;
        p.y += p.speedY;
        p.opacity += p.fadeDir * 0.002;
        if (p.opacity > 0.5) p.fadeDir = -1;
        if (p.opacity < 0.05) p.fadeDir = 1;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }

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
  }, []);

  return <canvas ref={canvasRef} className="credits-particles" />;
}