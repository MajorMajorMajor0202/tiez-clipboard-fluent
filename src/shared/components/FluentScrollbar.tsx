import React, { useEffect, useRef, useState, useCallback } from 'react';

interface FluentScrollbarProps {
  scrollContainer: HTMLElement | null;
  arrowsOutside?: boolean;
}

/**
 * FluentScrollbar — Windows 11 / Fluent Design 2 vertical scrollbar overlay.
 *
 * Rest:  Track is transparent. Thumb is a 2px pill hugging the right edge.
 * Hover: Thumb expands left to 6px. Track background fades in. Arrow buttons appear.
 */
const FluentScrollbar: React.FC<FluentScrollbarProps> = ({ scrollContainer, arrowsOutside = false }) => {
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const ARROW_H = 12;

  const update = useCallback(() => {
    const el = scrollContainer;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const trackElement = trackRef.current;
    const trackH = trackElement ? trackElement.clientHeight : (clientHeight - (arrowsOutside ? 16 : 0));
    const visibleTrackH = arrowsOutside ? trackH : (trackH - ARROW_H * 2);
    const ratio = clientHeight / scrollHeight;
    const th = Math.max(30, visibleTrackH * ratio);
    const maxTop = visibleTrackH - th;
    const scrollRatio = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
    const tp = scrollRatio * maxTop;
    setThumbHeight(th);
    setThumbTop(tp);
  }, [scrollContainer, arrowsOutside]);

  useEffect(() => {
    const el = scrollContainer;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    
    const ro = new ResizeObserver(update);
    ro.observe(el);
    
    const observeChildren = () => {
      Array.from(el.children).forEach(child => {
        ro.observe(child);
      });
    };
    observeChildren();

    const mo = new MutationObserver(() => {
      update();
      observeChildren();
    });
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scrollContainer, update]);

  const handleMouseEnter = useCallback(() => setHovered(true), []);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) setHovered(false);
  }, [isDragging]);

  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!scrollContainer) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = scrollContainer.scrollTop;

    const onMove = (me: MouseEvent) => {
      const el = scrollContainer;
      if (!el) return;
      const trackElement = trackRef.current;
      const trackH = trackElement ? trackElement.clientHeight : (el.clientHeight - (arrowsOutside ? 16 : 0));
      const visibleTrackH = arrowsOutside ? trackH : (trackH - ARROW_H * 2);
      const th = Math.max(30, visibleTrackH * (el.clientHeight / el.scrollHeight));
      const maxTop = visibleTrackH - th;
      const dy = me.clientY - dragStartY.current;
      const scrollRatio = maxTop > 0 ? dy / maxTop : 0;
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = Math.max(0, Math.min(maxScroll, dragStartScrollTop.current + scrollRatio * maxScroll));
    };

    const onUp = () => {
      setIsDragging(false);
      setHovered(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [scrollContainer, arrowsOutside]);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current || !scrollContainer) return;
    const trackElement = trackRef.current;
    const trackH = trackElement.clientHeight;
    const clickY = e.clientY - trackElement.getBoundingClientRect().top - (arrowsOutside ? 0 : ARROW_H);
    const useTrackH = arrowsOutside ? trackH : (trackH - ARROW_H * 2);
    const ratio = useTrackH > 0 ? clickY / useTrackH : 0;
    scrollContainer.scrollTop = ratio * (scrollContainer.scrollHeight - scrollContainer.clientHeight);
  }, [scrollContainer, arrowsOutside]);

  const handleArrowUp = useCallback(() => {
    scrollContainer?.scrollBy({ top: -60, behavior: 'smooth' });
  }, [scrollContainer]);

  const handleArrowDown = useCallback(() => {
    scrollContainer?.scrollBy({ top: 60, behavior: 'smooth' });
  }, [scrollContainer]);

  if (!visible) return null;

  const isActive = hovered || isDragging;

  return (
    <div
      className={`fluent-scrollbar${isActive ? ' fluent-scrollbar--active' : ''}${arrowsOutside ? ' fluent-scrollbar--arrows-outside' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={trackRef}
        className="fluent-scrollbar__track"
        onClick={handleTrackClick}
      >
        <button
          className="fluent-scrollbar__arrow fluent-scrollbar__arrow--up"
          onClick={(e) => { e.stopPropagation(); handleArrowUp(); }}
          aria-label="Scroll up"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden="true">
            <polygon
              points="4,0.8 7.2,5.5 0.8,5.5"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div
          className="fluent-scrollbar__thumb"
          style={{ top: thumbTop + (arrowsOutside ? 0 : ARROW_H), height: thumbHeight }}
          onMouseDown={handleThumbMouseDown}
        />

        {/* Down arrow — 4px inset from track bottom rounded corner */}
        <button
          className="fluent-scrollbar__arrow fluent-scrollbar__arrow--down"
          onClick={(e) => { e.stopPropagation(); handleArrowDown(); }}
          aria-label="Scroll down"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Solid filled triangle with rounded corners via stroke linejoin */}
          <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden="true">
            <polygon
              points="4,5.2 0.8,0.5 7.2,0.5"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FluentScrollbar;
