import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { cn } from "@/lib/utils";

interface UPlotChartProps {
  options: uPlot.Options;
  data: uPlot.AlignedData;
  className?: string;
  onReady?: (u: uPlot) => void;
}

export const UPlotChart: React.FC<UPlotChartProps> = ({ options, data, className, onReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const initialWidth = rect.width || 600;
      const initialHeight = rect.height || 200;
      
      const u = new uPlot({ ...options, width: initialWidth, height: initialHeight }, data, containerRef.current);
      chartRef.current = u;
      if (onReady) onReady(u);
      
      const observer = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
           const r = containerRef.current.getBoundingClientRect();
           if (r.width > 0 && r.height > 0) {
              chartRef.current.setSize({ width: r.width, height: r.height });
           }
        }
      });
      observer.observe(containerRef.current);

      const timeout = setTimeout(() => {
        if (containerRef.current && chartRef.current) {
          const r = containerRef.current.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) chartRef.current.setSize({ width: r.width, height: r.height });
        }
      }, 200);
      
      return () => {
        u.destroy();
        observer.disconnect();
        clearTimeout(timeout);
        chartRef.current = null;
      };
    }
  }, [options]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setData(data);
    }
  }, [data]);

  return <div ref={containerRef} className={cn("w-full h-full min-h-[100px] overflow-hidden", className)} />;
};
