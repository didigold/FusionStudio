import React, { useState, useCallback } from 'react';

export interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function useRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const addRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 550);
  }, []);

  const renderRipples = useCallback((colorClass = "bg-primary/25") => (
    <>
      {ripples.map((r) => (
        <span
          key={r.id}
          className={`absolute ${colorClass} rounded-full animate-ping pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0`}
          style={{
            left: r.x,
            top: r.y,
            width: '110px',
            height: '110px',
            animationDuration: '550ms',
          }}
        />
      ))}
    </>
  ), [ripples]);

  return { addRipple, renderRipples };
}

interface RippleContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  colorClass?: string;
}

export const RippleContainer: React.FC<RippleContainerProps> = ({
  children,
  className = "",
  colorClass = "bg-primary/25",
  onClick,
  ...props
}) => {
  const { addRipple, renderRipples } = useRipple();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    addRipple(e);
    if (onClick) onClick(e);
  };

  return (
    <div
      onClick={handleClick}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {renderRipples(colorClass)}
      <div className="relative z-10 flex items-center w-full">{children}</div>
    </div>
  );
};
