import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import './ElasticSlider.css';

const MAX_OVERFLOW = 50;

export interface ElasticSliderProps {
  value?: number;
  defaultValue?: number;
  startingValue?: number;
  maxValue?: number;
  className?: string;
  isStepped?: boolean;
  stepSize?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  trackOverlay?: React.ReactNode;
  onChange?: (value: number) => void;
  disabled?: boolean;
}

export default function ElasticSlider({
  value,
  defaultValue = 50,
  startingValue = 0,
  maxValue = 100,
  className = '',
  isStepped = false,
  stepSize = 1,
  leftIcon = null,
  rightIcon = null,
  trackOverlay = null,
  onChange,
  disabled = false
}: ElasticSliderProps) {
  return (
    <div className={`slider-container ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <Slider
        value={value}
        defaultValue={defaultValue}
        startingValue={startingValue}
        maxValue={maxValue}
        isStepped={isStepped}
        stepSize={stepSize}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        trackOverlay={trackOverlay}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

function Slider({ value: externalValue, defaultValue, startingValue, maxValue, isStepped, stepSize, leftIcon, rightIcon, trackOverlay, onChange, disabled }: ElasticSliderProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || 0);
  
  const value = externalValue !== undefined ? externalValue : internalValue;
  
  const sliderRef = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState('middle');
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);

  useMotionValueEvent(clientX, 'change', latest => {
    if (sliderRef.current) {
      const { left, right } = sliderRef.current.getBoundingClientRect();
      let newValue;

      if (latest < left) {
        setRegion('left');
        newValue = left - latest;
      } else if (latest > right) {
        setRegion('right');
        newValue = latest - right;
      } else {
        setRegion('middle');
        newValue = 0;
      }

      overflow.jump(decay(newValue, MAX_OVERFLOW));
    }
  });

  const handlePointerMove = (e: React.PointerEvent) => {
    if (disabled) return;
    if (e.buttons > 0 && sliderRef.current) {
      const { left, width } = sliderRef.current.getBoundingClientRect();
      let newValue = startingValue! + ((e.clientX - left) / width) * (maxValue! - startingValue!);

      if (isStepped) {
        newValue = Math.round(newValue / stepSize!) * stepSize!;
      }

      newValue = Math.min(Math.max(newValue, startingValue!), maxValue!);
      
      if (externalValue === undefined) {
        setInternalValue(newValue);
      }
      
      if (onChange) {
        onChange(newValue);
      }
      
      clientX.jump(e.clientX);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    handlePointerMove(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = () => {
    if (disabled) return;
    animate(overflow, 0, { type: 'spring', bounce: 0.5 });
  };

  const getRangePercentage = () => {
    const totalRange = maxValue! - startingValue!;
    if (totalRange === 0) return 0;

    return ((value - startingValue!) / totalRange) * 100;
  };

  return (
    <>
      <motion.div
        onHoverStart={() => !disabled && animate(scale, 1.05)}
        onHoverEnd={() => !disabled && animate(scale, 1)}
        onTouchStart={() => !disabled && animate(scale, 1.05)}
        onTouchEnd={() => !disabled && animate(scale, 1)}
        style={{
          scale,
          opacity: useTransform(scale, [1, 1.05], [0.7, 1])
        }}
        className="slider-wrapper"
      >
        {leftIcon && (
          <motion.div
            style={{
              scale: useTransform(scale, v => 1 / v),
              x: useTransform(() => (region === 'left' ? -overflow.get() / scale.get() : 0))
            }}
          >
            {leftIcon}
          </motion.div>
        )}

        <div
          ref={sliderRef}
          className="slider-root"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >
          <motion.div
            style={{
              scaleX: useTransform(() => {
                if (sliderRef.current) {
                  const { width } = sliderRef.current.getBoundingClientRect();
                  return 1 + overflow.get() / width;
                }
              }),
              scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]),
              transformOrigin: useTransform(() => {
                if (sliderRef.current) {
                  const { left, width } = sliderRef.current.getBoundingClientRect();
                  return clientX.get() < left + width / 2 ? 'right' : 'left';
                }
              }),
              height: useTransform(scale, [1, 1.05], [4, 8])
            }}
            className="slider-track-wrapper"
          >
            <div className="slider-track">
              <div className="slider-range" style={{ width: `${getRangePercentage()}%` }} />
            </div>
          </motion.div>
          {trackOverlay}
        </div>

        {rightIcon && (
          <motion.div
            style={{
              scale: useTransform(scale, v => 1 / v),
              x: useTransform(() => (region === 'right' ? overflow.get() / scale.get() : 0))
            }}
          >
            {rightIcon}
          </motion.div>
        )}
      </motion.div>
    </>
  );
}

function decay(value: number, max: number) {
  if (max === 0) {
    return 0;
  }

  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);

  return sigmoid * max;
}
