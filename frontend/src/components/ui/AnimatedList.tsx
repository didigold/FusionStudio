import { useRef, useState, useCallback, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';

// --- Animated Item Wrapper ---
interface AnimatedItemProps {
  children: ReactNode;
  delay?: number;
  index: number;
}

export const AnimatedItem = ({ children, delay = 0.1, index }: AnimatedItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      {children}
    </motion.div>
  );
};

// --- Animated List Container ---
interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  showGradients?: boolean;
  displayScrollbar?: boolean;
}

export const AnimatedList = ({
  children,
  className = '',
  showGradients = true,
  displayScrollbar = true,
}: AnimatedListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setTopGradientOpacity(Math.min(scrollTop / 50, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(
      scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1)
    );
  }, []);

  return (
    <div className={`animated-list-container ${className}`}>
      <div
        ref={listRef}
        className={`animated-list-scroll ${!displayScrollbar ? 'animated-list-no-scrollbar' : ''}`}
        onScroll={handleScroll}
      >
        {children}
      </div>
      {showGradients && (
        <>
          <div
            className="animated-list-gradient animated-list-gradient-top"
            style={{ opacity: topGradientOpacity }}
          />
          <div
            className="animated-list-gradient animated-list-gradient-bottom"
            style={{ opacity: bottomGradientOpacity }}
          />
        </>
      )}
    </div>
  );
};

export default AnimatedList;
