import { useEffect, useRef } from "react";

/**
 * Canvas de particules de poussière flottantes.
 * Effet visuel subtil qui donne de la vie à l'overlay.
 * 
 * Le canvas s'adapte automatiquement à la taille du parent.
 * Les particules montent lentement et oscillent horizontalement.
 */
export function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    x: number; y: number; size: number;
    speedX: number; speedY: number;
    opacity: number; fadeDir: number; life: number;
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

    // Initialiser 25 particules de poussière
    particlesRef.current = Array.from({ length: 25 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: -Math.random() * 0.4 - 0.1,
      opacity: Math.random() * 0.5 + 0.1,
      fadeDir: Math.random() > 0.5 ? 1 : -1,
      life: Math.random(),
    }));

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        // Mouvement avec oscillation
        p.x += p.speedX + Math.sin(Date.now() * 0.001 + p.life * 10) * 0.15;
        p.y += p.speedY;

        // Pulsation d'opacité
        p.opacity += p.fadeDir * 0.003;
        if (p.opacity > 0.6) p.fadeDir = -1;
        if (p.opacity < 0.05) p.fadeDir = 1;

        // Recycler les particules qui sortent
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        // Dessiner
        ctx.beginPath();
        ctx.fillStyle = `rgba(222, 198, 160, ${p.opacity})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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

  return <canvas ref={canvasRef} className="chat-particles" />;
}