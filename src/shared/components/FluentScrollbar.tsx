import React, { useEffect, useRef, useState, useCallback } from 'react';

interface FluentScrollbarProps {
  scrollContainer: HTMLElement | null;
}

/**
 * FluentScrollbar — Windows 11 / Fluent Design 2 vertical scrollbar overlay.
 *
 * Rest:  Track is transparent. Thumb is a 2px pill hugging the right edge.
 * Hover: Thumb expands left to 6px. Track background fades in. Arrow buttons appear.
 */
const FluentScrollbar: React.FC<FluentScrollbarProps> = ({ scrollContainer }) => {
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const ARROW_H = 20;

  const update = useCallback(() => {
    const el = scrollContainer;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const trackH = clientHeight - ARROW_H * 2;
    const ratio = clientHeight / scrollHeight;
    const th = Math.max(30, trackH * ratio);
    const maxTop = trackH - th;
    const scrollRatio = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
    const tp = scrollRatio * maxTop;
    setThumbHeight(th);
    setThumbTop(tp);
  }, [scrollContainer]);

  useEffect(() => {
    const el = scrollContainer;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
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
      const trackH = el.clientHeight - ARROW_H * 2;
      const th = Math.max(30, trackH * (el.clientHeight / el.scrollHeight));
      const maxTop = trackH - th;
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
  }, [scrollContainer]);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current || !scrollContainer) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const trackH = scrollContainer.clientHeight - ARROW_H * 2;
    const clickY = e.clientY - trackRect.top;
    const ratio = trackH > 0 ? clickY / trackH : 0;
    scrollContainer.scrollTop = ratio * (scrollContainer.scrollHeight - scrollContainer.clientHeight);
  }, [scrollContainer]);

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
      className={`fluent-scrollbar${isActive ? ' fluent-scrollbar--active' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Track fills all vertical space; arrows sit inside it */}
      <div
        ref={trackRef}
        className="fluent-scrollbar__track"
        onClick={handleTrackClick}
      >
        {/* Up arrow — absolutely positioned at top of track */}
        <button
          className="fluent-scrollbar__arrow fluent-scrollbar__arrow--up"
          onClick={(e) => { e.stopPropagation(); handleArrowUp(); }}
          aria-label="Scroll up"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Solid filled upward triangle */}
          <svg width="6" height="4" viewBox="0 0 6 4" aria-hidden="true">
            <polygon points="3,0 6,4 0,4" fill="currentColor" />
          </svg>
        </button>

        {/* Thumb */}
        <div
          className="fluent-scrollbar__thumb"
          style={{ top: thumbTop + ARROW_H, height: thumbHeight }}
          onMouseDown={handleThumbMouseDown}
        />

        {/* Down arrow — absolutely positioned at bottom of track */}
        <button
          className="fluent-scrollbar__arrow fluent-scrollbar__arrow--down"
          onClick={(e) => { e.stopPropagation(); handleArrowDown(); }}
          aria-label="Scroll down"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Solid filled downward triangle */}
          <svg width="6" height="4" viewBox="0 0 6 4" aria-hidden="true">
            <polygon points="3,4 0,0 6,0" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FluentScrollbar;
