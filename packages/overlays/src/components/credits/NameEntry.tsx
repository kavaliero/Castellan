import { useEffect, useRef, useState } from "react";

interface NameEntryProps {
  name: string;
  detail?: string;
  delay?: number;
}

/**
 * Un nom dans les crédits avec animation fade-in
 * quand il entre dans le viewport.
 */
export function NameEntry({ name, detail, delay = 0 }: NameEntryProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`credits-name-entry ${visible ? "credits-name-entry--visible" : ""}`}
      style={{ transitionDelay: `${delay * 0.1}s` }}
    >
      <span className="credits-name">{name}</span>
      {detail && <span className="credits-name-detail">{detail}</span>}
    </div>
  );
}
