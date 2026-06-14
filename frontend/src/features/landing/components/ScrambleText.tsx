'use client';

import { useEffect, useRef, useState } from 'react';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#________';

/** Brutalist scramble-in text. Resolves char-by-char from random glyphs. */
export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const total = 28; // frames to fully resolve
    frame.current = 0;
    function tick() {
      const progress = frame.current / total;
      const resolved = Math.floor(progress * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        if (i < resolved || text[i] === ' ') out += text[i];
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setDisplay(out);
      frame.current += 1;
      if (frame.current <= total) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    }
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [text]);

  return (
    <span className={className} aria-label={text}>
      {display}
    </span>
  );
}
