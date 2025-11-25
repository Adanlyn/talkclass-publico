import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

const normalizeSafe = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();


type Polarity = 'neg' | 'pos';
type Item =
  | { text: string; count: number; score?: number }
  | { keyword: string; total: number; score?: number; avgScore?: number };

const RAW_STOP = [
  'de','da','do','das','dos','e','a','o','os','as','um','uma','que','com','pra',
  'pro','na','no','em','por','para','se','ser','foi','era','é','são'
];

// Stopwords normalizadas sem acento
const STOP = new Set(RAW_STOP.map(normalizeSafe));  

// Junta por palavra somando contagem e média
function mergeItems(items: Item[]) {
  const map = new Map<string, { count: number; scoreSum: number; scoreAbsMax: number; nScore: number }>();
  for (const it of items) {
   const rawText  = (it as any).text ?? (it as any).keyword;
   const rawCount = (it as any).count ?? (it as any).total ?? 0;
   const rawScore = (it as any).score ?? (it as any).avgScore;

   const key = normalizeSafe(rawText);
    if (!key || key.length < 3 || STOP.has(key)) continue;

    const prev = map.get(key) ?? { count: 0, scoreSum: 0, scoreAbsMax: 0, nScore: 0 };
    const hasScore = Number.isFinite(rawScore as number);
  const score = hasScore ? Number(rawScore) : 0;

    map.set(key, {
      count: prev.count + (Number(rawCount) || 0),
      scoreSum: prev.scoreSum + (hasScore ? score : 0),
      scoreAbsMax: hasScore ? Math.max(prev.scoreAbsMax, Math.abs(score)) : prev.scoreAbsMax,
      nScore: prev.nScore + (hasScore ? 1 : 0),
    });
  }
  return [...map.entries()].map(([text, v]) => ({
    text,
    count: v.count,
    avgScore: v.nScore ? v.scoreSum / v.nScore : Number.NaN, 
    maxAbsScore: v.scoreAbsMax
  }));
}


export default function WordHeatmap({
  items = [],
  polarity,
  width = 720,
  height = 360,
  maxWords = 40,
  gap = 0.05,      
  minFreq = 1     
}: {
  items: Item[];
  polarity: Polarity;
  width?: number;
  height?: number;
  maxWords?: number;
  gap?: number;
  minFreq?: number;
}) {
  if (!items || items.length === 0) return null;

  const hostRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(width);
  const h = height;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);


const words = useMemo(() => {
  const minCut = Math.max(1, minFreq || 1);
  const agg = mergeItems(items).filter(x => x.count >= minCut);

  if (agg.length === 0) return [];

  const maxCnt = Math.max(1, Math.max(...agg.map(s => s.count)));
  const maxAbs = Math.max(0.2, Math.max(...agg.map(s => Math.abs((s as any).avgScore ?? 0))));

  const weight = (a: typeof agg[number]) =>
    0.8 * (a.count / maxCnt) + 0.2 * (Math.abs((a as any).avgScore ?? 0) / maxAbs);

  const minCount = Math.max(1, Math.min(...agg.map(s => s.count)));
  const size = d3.scaleSqrt()
    .domain([minCount, maxCnt])
    .range([24, Math.min(72, h * 0.32)]);

  return agg
    .sort((a, b) => b.count - a.count)
    .slice(0, maxWords)
    .map(s => ({
      text: s.text,
      value: s.count,
      avgScore: (s as any).avgScore ?? 0, 
      heat: weight(s),
      size: Math.max(12, size(s.count)),
    }));
}, [items, maxWords, h, gap, minFreq, polarity]);

  if (words.length === 0) return null;

  const singleWord = words.length === 1 ? words[0] : null;

  const placed = useMemo(() => {
    const maxHeat = Math.max(0.0001, ...words.map((w) => w.heat ?? 0));
    const colorScale = (t: number) => {
      const tt = Math.max(0, Math.min(1, t));
      return polarity === 'neg'
        ? d3.interpolateOrRd(0.2 + 0.6 * tt)
        : d3.interpolateYlGn(0.3 + 0.6 * tt);
    };

    return [...words]
      .sort((a, b) => (b.value ?? b.count ?? 0) - (a.value ?? a.count ?? 0))
      .slice(0, maxWords)
      .map((word) => {
        const sz = Math.round(word.size ?? 16);
        const normHeat = Math.min(1, Math.max(0, (word.heat ?? 0) / maxHeat));
        return {
          text: word.text,
          size: sz,
          color: colorScale(normHeat),
          alpha: 0.18 + 0.32 * normHeat, // quanto mais frequente, mais opaco
          weight: normHeat,
        };
      });
  }, [words, polarity, maxWords]);

  const blobs = useMemo(() => {
    const golden = Math.PI * (3 - Math.sqrt(5));
    return placed.map((p, i) => {
      const angle = i * golden;
      const radius = 28 + (i * 22) % 48;
      const x = 50 + Math.cos(angle) * radius * 0.7;
      const y = 50 + Math.sin(angle) * radius * 0.7;
      return {
        x: Math.max(6, Math.min(94, x)),
        y: Math.max(6, Math.min(94, y)),
        size: 50 + 150 * p.weight,
        color: p.color,
        alpha: p.alpha,
      };
    });
  }, [placed]);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        height: h,
        position: 'relative',
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(0,0,0,0.006), rgba(0,0,0,0.015) 48%, rgba(0,0,0,0.006))',
    }}
  >
      {singleWord ? (
        <div
          style={{
            width: '100%',
            height: h,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0f172a',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: Math.max(18, Math.min(52, h * 0.3)),
          }}
        >
          {singleWord.text}
        </div>
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              filter: 'blur(20px)',
              pointerEvents: 'none',
            }}
          >
            {blobs.map((b, i) => (
              <div
                key={`blob-${i}`}
                style={{
                  position: 'absolute',
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: b.size,
                  height: b.size,
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle, ${b.color}${Math.round(b.alpha * 255).toString(16).padStart(2, '0')} 0%, ${b.color}00 68%)`,
                  opacity: 0.9,
                }}
              />
            ))}
          </div>

          <div
            style={{
              position: 'absolute',
              inset: '14px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              gap: '12px 16px',
              pointerEvents: 'none',
            }}
          >
            {placed.map((p, i) => (
              <div
                key={`${p.text}-${i}`}
                style={{
                  textAlign: 'center',
                  color: '#0f172a',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: `${p.size}px`,
                  lineHeight: 1.05,
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                  textShadow: '0 0 6px rgba(255,255,255,0.72)',
                }}
              >
                {p.text}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
