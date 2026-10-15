import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants';

export interface ElevationPoint {
  distance: number; // meters
  elevation: number; // meters
}

interface ElevationProfileProps {
  data: ElevationPoint[];
  width?: number;
  height?: number;
}

const PADDING = { top: 20, right: 16, bottom: 30, left: 48 };

export function ElevationProfile({
  data,
  width = 340,
  height = 180,
}: ElevationProfileProps) {
  const chart = useMemo(() => {
    if (!data || data.length < 2) return null;

    const chartW = width - PADDING.left - PADDING.right;
    const chartH = height - PADDING.top - PADDING.bottom;

    const elevations = data.map((d) => d.elevation);
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    const elevRange = maxElev - minElev || 1;

    const maxDist = data[data.length - 1].distance;

    const scaleX = (d: number) => PADDING.left + (d / maxDist) * chartW;
    const scaleY = (e: number) =>
      PADDING.top + chartH - ((e - minElev) / elevRange) * chartH;

    // Build line path
    let linePath = `M ${scaleX(data[0].distance)} ${scaleY(data[0].elevation)}`;
    for (let i = 1; i < data.length; i++) {
      linePath += ` L ${scaleX(data[i].distance)} ${scaleY(data[i].elevation)}`;
    }

    // Build filled area path
    const fillPath =
      linePath +
      ` L ${scaleX(data[data.length - 1].distance)} ${PADDING.top + chartH}` +
      ` L ${scaleX(data[0].distance)} ${PADDING.top + chartH} Z`;

    // Horizontal grid lines (4 lines)
    const gridLines: { y: number; label: string }[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const elev = minElev + (elevRange * i) / steps;
      gridLines.push({ y: scaleY(elev), label: `${Math.round(elev)}` });
    }

    // Distance labels
    const distStart = '0';
    const distEnd =
      maxDist >= 1000
        ? `${(maxDist / 1000).toFixed(1)} km`
        : `${Math.round(maxDist)} m`;

    return {
      linePath,
      fillPath,
      gridLines,
      distStart,
      distEnd,
      minElev: Math.round(minElev),
      maxElev: Math.round(maxElev),
      chartW,
      chartH,
      scaleX,
    };
  }, [data, width, height]);

  if (!chart) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.empty}>Keine Höhendaten verfügbar</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {chart.gridLines.map((line, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PADDING.left}
              y1={line.y}
              x2={width - PADDING.right}
              y2={line.y}
              stroke={Colors.borderLight}
              strokeWidth={1}
            />
            <SvgText
              x={PADDING.left - 6}
              y={line.y + 4}
              textAnchor="end"
              fontSize={10}
              fill={Colors.textSecondary}
            >
              {line.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Filled area */}
        <Path d={chart.fillPath} fill={Colors.primaryLight} opacity={0.25} />

        {/* Line */}
        <Path
          d={chart.linePath}
          fill="none"
          stroke={Colors.primary}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Distance labels */}
        <SvgText
          x={PADDING.left}
          y={height - 6}
          textAnchor="start"
          fontSize={10}
          fill={Colors.textSecondary}
        >
          {chart.distStart}
        </SvgText>
        <SvgText
          x={width - PADDING.right}
          y={height - 6}
          textAnchor="end"
          fontSize={10}
          fill={Colors.textSecondary}
        >
          {chart.distEnd}
        </SvgText>

        {/* "m ü.M." unit label */}
        <SvgText
          x={PADDING.left - 6}
          y={PADDING.top - 6}
          textAnchor="end"
          fontSize={9}
          fill={Colors.textLight}
        >
          m
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
