import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import "echarts-wordcloud";
import { interpolateOrRd, interpolateYlGn } from "d3-scale-chromatic";

type CloudItem = { text: string; value: number };

type Props = {
  items: CloudItem[];
  polarity: "pos" | "neg";
  height?: number;
};

const MAX_WORDS = 60;

export default function EchartsWordCloud({
  items = [],
  polarity,
  height = 320,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const sorted = [...items]
      .filter((i) => i.text && i.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_WORDS);

    const max = Math.max(1, ...sorted.map((i) => i.value));
    return sorted.map((i) => ({
      name: i.text,
      value: i.value,
      weight: i.value / max,
    }));
  }, [items]);

  useEffect(() => {
    if (!elRef.current || data.length === 0) return;

    const chart = echarts.init(elRef.current);

    const paint =
      polarity === "neg"
        ? (t: number) => interpolateOrRd(0.25 + 0.65 * t)
        : (t: number) => interpolateYlGn(0.35 + 0.55 * t);

    chart.setOption({
      tooltip: { show: false },
      series: [
        {
          type: "wordCloud",
          shape: "circle",
          gridSize: 6,
          sizeRange: [18, Math.max(18, Math.min(84, (height ?? 300) * 0.28))],
          rotationRange: [-15, 15],
          drawOutOfBound: false,
          textStyle: {
            color: (params: any) => {
              const idx = typeof params?.dataIndex === "number" ? params.dataIndex : -1;
              const w = data[idx];
              const t = w?.weight ?? 0.4;
              return paint(t);
            },
            fontFamily: "Inter, system-ui, sans-serif",
          },
          emphasis: { focus: "none" },
          data: data.map((d) => ({ name: d.name, value: d.value })),
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data, polarity, height]);

  if (!items || items.length === 0) return null;

  return <div ref={elRef} style={{ width: "100%", height }} />;
}
