import React, { useState, useEffect, useCallback } from 'react';

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction: 'left' | 'right';
  className?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, direction, className = '' }) => {
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing) return;

    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = (e as MouseEvent).clientX;
    }

    // This logic depends on the parent's fixed positioning or flex layout
    // For simplicity, we just pass the delta to the callback
    // But since onResize needs a delta, we need to track previous X
  }, [isResizing]);

  // Actually, a simpler approach for the callback is to pass the absolute X or the delta
  // Let's refine the ResizeHandle to be more robust.

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      onResize(e.movementX);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  return (
    <div
      onMouseDown={startResizing}
      className={`resize-handle ${direction} ${isResizing ? 'resizing' : ''} ${className}`}
      style={{
        cursor: 'col-resize',
        width: '4px',
        height: '100%',
        position: 'absolute',
        [direction === 'left' ? 'left' : 'right']: '-2px',
        top: 0,
        zIndex: 50,
        transition: 'background-color 0.2s',
      }}
    />
  );
};
