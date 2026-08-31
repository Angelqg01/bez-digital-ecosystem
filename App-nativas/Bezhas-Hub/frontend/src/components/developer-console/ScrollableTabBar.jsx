/**
 * ScrollableTabBar — barra de pestañas desplazable: scrollbar visible, arrastre
 * con el ratón (drag-to-scroll) y flechas izquierda/derecha. Pensada para cuando
 * hay más pestañas de las que caben (Developer Console). El arrastre no dispara
 * la selección (se ignora el click si hubo movimiento).
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ScrollableTabBar({ tabs, active, onSelect, className = '' }) {
  const scrollerRef = useRef(null);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, tabs.length]);

  const scrollBy = (dx) => scrollerRef.current?.scrollBy({ left: dx, behavior: 'smooth' });

  // Drag-to-scroll
  const onMouseDown = (e) => {
    const el = scrollerRef.current;
    if (!el) return;
    drag.current = { down: true, startX: e.pageX, startScroll: el.scrollLeft, moved: false };
  };
  const onMouseMove = (e) => {
    if (!drag.current.down) return;
    const el = scrollerRef.current;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };
  const endDrag = () => { drag.current.down = false; };

  // Auto-centrar la pestaña activa al cambiarla.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const node = el.querySelector('[data-active="true"]');
    if (node) node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  return (
    <div className={`relative flex items-center gap-1 mb-8 ${className}`}>
      <button
        type="button"
        aria-label="Desplazar a la izquierda"
        onClick={() => scrollBy(-240)}
        className={`shrink-0 grid place-items-center w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-opacity ${canLeft ? 'opacity-100 hover:bg-gray-50 dark:hover:bg-gray-700' : 'opacity-30 cursor-default'}`}
      >
        <ChevronLeft size={18} />
      </button>

      <div
        ref={scrollerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-400/70 dark:scrollbar-thumb-purple-500/50 scrollbar-track-transparent cursor-grab active:cursor-grabbing select-none flex-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-active={active === tab.id}
            onClick={() => { if (!drag.current.moved) onSelect(tab.id); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${active === tab.id
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {tab.icon && <tab.icon size={18} />}
            {tab.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label="Desplazar a la derecha"
        onClick={() => scrollBy(240)}
        className={`shrink-0 grid place-items-center w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-opacity ${canRight ? 'opacity-100 hover:bg-gray-50 dark:hover:bg-gray-700' : 'opacity-30 cursor-default'}`}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
