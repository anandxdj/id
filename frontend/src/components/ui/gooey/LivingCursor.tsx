'use client';

import React, { useEffect, useRef, useState } from 'react';

interface LivingCursorProps {
  /** Number of fluid trailing metaball dots (default: 18) */
  amount?: number;
  /** Base width in pixels (default: 28) */
  width?: number;
  /** Inactivity delay before harmonic idle wobble starts in ms (default: 160) */
  idleTimeout?: number;
  /** Additional CSS class names */
  className?: string;
}

class Dot {
  index: number;
  anglespeed: number;
  x: number;
  y: number;
  scale: number;
  range: number;
  element: HTMLSpanElement;
  lockX: number;
  lockY: number;
  angleX: number;
  angleY: number;

  constructor(index: number, width: number, container: HTMLElement) {
    this.index = index;
    this.anglespeed = 0.05;
    this.x = 0;
    this.y = 0;
    this.lockX = 0;
    this.lockY = 0;
    this.angleX = 0;
    this.angleY = 0;
    // Scale smoothly from 1.0 down to 0.32 so all dots remain visible under the SVG filter
    this.scale = Math.max(0.32, 1 - 0.038 * index);
    this.range = (width / 2) * (1 - this.scale) + 3.0;
    this.element = document.createElement('span');
    this.element.style.transform = `translate3d(0px, 0px, 0) scale(${this.scale})`;
    container.appendChild(this.element);
  }

  lock() {
    this.lockX = this.x;
    this.lockY = this.y;
    this.angleX = Math.PI * 2 * Math.random();
    this.angleY = Math.PI * 2 * Math.random();
  }

  draw(idle: boolean, sineDots: number, hoverScale: number) {
    const currentScale = this.scale * hoverScale;
    if (!idle || this.index <= sineDots) {
      this.element.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${currentScale})`;
    } else {
      this.angleX += this.anglespeed;
      this.angleY += this.anglespeed;
      this.x = this.lockX + Math.sin(this.angleX) * this.range;
      this.y = this.lockY + Math.sin(this.angleY) * this.range;
      this.element.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${currentScale})`;
    }
  }

  destroy() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export function LivingCursor({
  amount = 18,
  width = 28,
  idleTimeout = 160,
  className = '',
}: LivingCursorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    if (!container) return;

    // Check pointer capability
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (!hasFinePointer) {
      container.style.display = 'none';
      return;
    }

    const sineDots = Math.floor(amount * 0.3);
    let mousePosition = {
      x: window.innerWidth / 2 - width / 2,
      y: window.innerHeight / 2 - width / 2,
    };
    let dots: Dot[] = [];
    let timeoutID: ReturnType<typeof setTimeout> | null = null;
    let idle = false;
    let animFrameId: number;
    let isHoveringInteractive = false;
    let hoverScale = 1.0;
    let targetHoverScale = 1.0;
    let hasMoved = false;

    // Initialize dots
    container.innerHTML = '';
    for (let i = 0; i < amount; i++) {
      const dot = new Dot(i, width, container);
      dot.x = mousePosition.x;
      dot.y = mousePosition.y;
      dots.push(dot);
    }

    function goInactive() {
      idle = true;
      for (const dot of dots) {
        dot.lock();
      }
    }

    function startIdleTimer() {
      if (timeoutID) clearTimeout(timeoutID);
      timeoutID = setTimeout(goInactive, idleTimeout);
      idle = false;
    }

    function resetIdleTimer() {
      if (timeoutID) clearTimeout(timeoutID);
      startIdleTimer();
    }

    const onMouseMove = (e: MouseEvent | PointerEvent) => {
      const targetX = e.clientX - width / 2;
      const targetY = e.clientY - width / 2;

      if (!hasMoved) {
        hasMoved = true;
        container.style.opacity = '1';
        for (const dot of dots) {
          dot.x = targetX;
          dot.y = targetY;
        }
      }

      mousePosition.x = targetX;
      mousePosition.y = targetY;

      // Check interactive hover state
      const target = e.target as HTMLElement | null;
      const isInteractive = Boolean(
        target &&
          target.closest('a, button, input, textarea, select, [role="button"], [data-cursor-interactive]')
      );

      if (isInteractive !== isHoveringInteractive) {
        isHoveringInteractive = isInteractive;
        targetHoverScale = isInteractive ? 1.4 : 1.0;
      }

      resetIdleTimer();
    };

    const onMouseDown = () => {
      targetHoverScale = 0.75;
    };

    const onMouseUp = () => {
      targetHoverScale = isHoveringInteractive ? 1.4 : 1.0;
    };

    const onMouseLeave = () => {
      container.style.opacity = '0';
    };

    const onMouseEnter = (e: MouseEvent | PointerEvent) => {
      mousePosition.x = e.clientX - width / 2;
      mousePosition.y = e.clientY - width / 2;
      container.style.opacity = '1';
      resetIdleTimer();
    };

    const render = () => {
      hoverScale += (targetHoverScale - hoverScale) * 0.18;

      let x = mousePosition.x;
      let y = mousePosition.y;

      for (let index = 0; index < dots.length; index++) {
        const dot = dots[index];
        const nextDot = dots[index + 1] || dots[0];
        dot.x = x;
        dot.y = y;
        dot.draw(idle, sineDots, hoverScale);

        if (!idle || index <= sineDots) {
          const dx = (nextDot.x - dot.x) * 0.35;
          const dy = (nextDot.y - dot.y) * 0.35;
          x += dx;
          y += dy;
        }
      }

      animFrameId = requestAnimationFrame(render);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('pointermove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    document.documentElement.addEventListener('mouseenter', onMouseEnter);

    container.style.opacity = '1';
    startIdleTimer();
    animFrameId = requestAnimationFrame(render);

    return () => {
      if (timeoutID) clearTimeout(timeoutID);
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      document.documentElement.removeEventListener('mouseenter', onMouseEnter);
      dots.forEach((d) => d.destroy());
      dots = [];
    };
  }, [mounted, amount, width, idleTimeout]);

  return (
    <>
      {/* High-Performance Morgana Gooey Filter */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
        className="pointer-events-none absolute size-0 opacity-0"
        style={{ width: 0, height: 0, position: 'absolute' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="goo" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -7.5"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Multi-Dot Cursor Container */}
      <div
        ref={containerRef}
        id="cursor"
        className={`Cursor pointer-events-none fixed top-0 left-0 z-[9999999] opacity-100 transition-opacity duration-150 ${className}`}
        aria-hidden="true"
      />
    </>
  );
}
