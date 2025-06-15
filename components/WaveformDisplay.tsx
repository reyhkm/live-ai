import React from 'react';

interface WaveformDisplayProps {
  data: number[]; // Normalized amplitude values (0 to 1)
  barColor?: string;
  width?: number;
  height?: number;
  barWidth?: number;
  gapWidth?: number;
}

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  data,
  barColor = '#60a5fa', // Tailwind's sky-400
  width = 200,
  height = 50,
  barWidth = 3,
  gapWidth = 1,
}) => {
  if (!data || data.length === 0) {
    return <div style={{width, height}} className="bg-opacity-50 bg-gray-600 rounded-md animate-pulse"></div>; // Placeholder for no data
  }

  const numBars = data.length;
  const totalBarAndGapWidth = barWidth + gapWidth;
  const effectiveWidth = numBars * totalBarAndGapWidth - gapWidth; // Total width occupied by bars and gaps

  // Adjust width if calculated effectiveWidth is different, or scale bars to fit
  const scaleX = width / Math.max(effectiveWidth,1) ;


  return (
    <svg width={width} height={height} className="rounded-md overflow-hidden">
      {data.map((amplitude, index) => {
        const barHeight = Math.max(1, amplitude * height); // Ensure minimum height of 1px for visibility
        const x = index * (barWidth + gapWidth) * scaleX;
        const y = (height - barHeight) / 2; // Center the waveform vertically

        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth * scaleX}
            height={barHeight}
            fill={barColor}
            rx={barWidth * scaleX / 2} // Rounded bars
            ry={barWidth * scaleX / 2}
          />
        );
      })}
    </svg>
  );
};

export default WaveformDisplay;