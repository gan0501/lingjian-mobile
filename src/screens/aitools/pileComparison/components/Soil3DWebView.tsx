import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { usePileComparisonContext } from '../PileComparisonContext';

const LAYER_COLORS = ['#6b4a2f', '#c2b7aa', '#d7c8a3', '#7c8fb3', '#7a5a42', '#8e8a86', '#c9b38e'];

type Props = {
  title?: string;
  markerElevations?: number[];
  markerLines?: { elevation: number; mode?: 'prefab' | 'drilled' | 'both'; label?: string }[];
  showBearingMarkers?: boolean;
  comparePiles?: Partial<
    Record<'A' | 'B' | 'C' | 'D', Array<{ lengthM: number; diameterMm: number; pileTopElevation: number; pileType: string }>>
  >;
  pileWarnings?: string[];
  showLayerLabels?: boolean;
};

const Soil3DWebView: React.FC<Props> = ({ title = '3D土层预览', markerElevations, markerLines, showBearingMarkers, comparePiles, pileWarnings, showLayerLabels = true }) => {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const { soilLayers, pileParameters } = usePileComparisonContext();
  const webViewRef = useRef<WebView>(null);

  // 构建HTML内容 - 完全按照web端逻辑
  const autoMarkerLines = useMemo(() => {
    if (!soilLayers || soilLayers.length === 0) return [];
    if (!showBearingMarkers) return [];
    if (Array.isArray(markerLines) && markerLines.length > 0) return [];
    const ps = Array.isArray(pileParameters) ? pileParameters : [];
    const sls = Array.isArray(soilLayers) ? soilLayers : [];
    if (ps.length === 0 || sls.length === 0) return [];

    const normalizeLayerKey = (v: any) => {
      const circledToNum: Record<string, string> = {
        '⓪': '0',
        '①': '1',
        '②': '2',
        '③': '3',
        '④': '4',
        '⑤': '5',
        '⑥': '6',
        '⑦': '7',
        '⑧': '8',
        '⑨': '9',
        '⑩': '10',
        '⑪': '11',
        '⑫': '12',
        '⑬': '13',
        '⑭': '14',
        '⑮': '15',
        '⑯': '16',
        '⑰': '17',
        '⑱': '18',
        '⑲': '19',
        '⑳': '20',
      };

      const s0 = String(v ?? '').trim();
      const s = s0.replace(/[⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g, (m) => circledToNum[m] ?? m);
      if (!s) return '';
      const m = s.match(/[0-9]+(?:-[0-9]+)?/g);
      if (m && m[0]) return m[0];
      return s;
    };

    const circledDigits = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
    const formatLayerDisplay = (raw: any) => {
      const s = String(raw ?? '').trim();
      if (!s) return '';
      if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(s)) return s;
      const key = normalizeLayerKey(s);
      if (!key) return s;
      const parts = key.split('-');
      const n = Number(parts[0]);
      if (!Number.isFinite(n) || n <= 0 || n >= circledDigits.length) return s;
      const head = circledDigits[n];
      return parts.length > 1 ? `${head}-${parts.slice(1).join('-')}` : head;
    };

    const soilLayerByKey = new Map<string, any>();
    sls.forEach((l: any) => {
      const k1 = normalizeLayerKey(l.id);
      const k3 = normalizeLayerKey(l.layer_number);
      if (k1) soilLayerByKey.set(k1, l);
      if (k3 && k3 !== k1) soilLayerByKey.set(k3, l);
    });

    const items = ps
      .filter((p: any) => {
        const endPrefab = Number(p.end_bearing_prefab ?? NaN);
        const endDrilled = Number(p.end_bearing_drilled ?? NaN);
        const hasPrefab = Number.isFinite(endPrefab) && endPrefab > 0;
        const hasDrilled = Number.isFinite(endDrilled) && endDrilled > 0;
        return hasPrefab || hasDrilled;
      })
      .map((p: any) => {
        const key = normalizeLayerKey(p.layer);
        const soil = (key && soilLayerByKey.get(key)) || null;
        const elevation = Number(soil?.top_elevation);
        if (!Number.isFinite(elevation)) return null;

        const endPrefab = Number(p.end_bearing_prefab ?? NaN);
        const endDrilled = Number(p.end_bearing_drilled ?? NaN);
        const hasPrefab = Number.isFinite(endPrefab) && endPrefab > 0;
        const hasDrilled = Number.isFinite(endDrilled) && endDrilled > 0;
        const mode = hasPrefab && hasDrilled ? 'both' : hasPrefab ? 'prefab' : hasDrilled ? 'drilled' : null;
        if (!mode) return null;

        const label = formatLayerDisplay(p.layer);
        return { elevation, mode, label };
      })
      .filter(Boolean) as { elevation: number; mode: 'prefab' | 'drilled' | 'both'; label: string }[];

    const merged = new Map<number, { mode: 'prefab' | 'drilled' | 'both'; label: string }>();
    items.forEach((it) => {
      const prev = merged.get(it.elevation);
      if (!prev) {
        merged.set(it.elevation, { mode: it.mode, label: it.label });
        return;
      }
      if (prev.mode === 'both' || it.mode === prev.mode) return;
      merged.set(it.elevation, { mode: 'both', label: prev.label || it.label });
    });

    return Array.from(merged.entries())
      .map(([elevation, v]) => ({ elevation, mode: v.mode, label: v.label }))
      .sort((a, b) => b.elevation - a.elevation);
  }, [showBearingMarkers, markerLines, pileParameters, soilLayers]);

  const htmlContent = useMemo(() => {
    const layers = soilLayers.map((l, idx) => ({
      layerNumber: String(l.id || (l as any).layer_number || ''),
      name: l.name,
      thickness: l.thickness || 0,
      color: l.color || LAYER_COLORS[idx % LAYER_COLORS.length],
    }));

    const legacyElevations = Array.isArray(markerElevations) ? markerElevations : [];
    const derivedLines = Array.isArray(autoMarkerLines) ? autoMarkerLines : [];
    const inputLines = Array.isArray(markerLines) && markerLines.length > 0 ? markerLines : derivedLines;
    const elevations = inputLines.length > 0 ? inputLines.map((x) => x?.elevation) : legacyElevations;
    const tops = (Array.isArray(soilLayers) ? soilLayers : [])
      .map((l: any) => Number(l?.top_elevation))
      .filter((v) => Number.isFinite(v));
    const bottoms = (Array.isArray(soilLayers) ? soilLayers : [])
      .map((l: any) => Number(l?.bottom_elevation))
      .filter((v) => Number.isFinite(v));

    const maxTop = tops.length > 0 ? Math.max(...tops) : undefined;
    const minBottom = bottoms.length > 0 ? Math.min(...bottoms) : undefined;
    const elevationSpan =
      maxTop != null && minBottom != null && Number.isFinite(maxTop) && Number.isFinite(minBottom)
        ? Math.max(0.0001, maxTop - minBottom)
        : null;

    const pilesInput = comparePiles && typeof comparePiles === 'object' ? comparePiles : null;
    const facePiles = pilesInput
      ? {
          A: Array.isArray((pilesInput as any).A) ? (pilesInput as any).A : [],
          B: Array.isArray((pilesInput as any).B) ? (pilesInput as any).B : [],
          C: Array.isArray((pilesInput as any).C) ? (pilesInput as any).C : [],
          D: Array.isArray((pilesInput as any).D) ? (pilesInput as any).D : [],
        }
      : { A: [], B: [], C: [], D: [] };

    const markerItems = elevationSpan
      ? (inputLines.length > 0
          ? inputLines
          : legacyElevations.map((e) => ({ elevation: e, mode: 'both' as const }))
        )
          .map((x: any) => {
            const e = Number(x?.elevation);
            if (!Number.isFinite(e)) return null;
            const p = ((Number(maxTop) - e) / elevationSpan) * 100;
            if (!Number.isFinite(p)) return null;
            const mode = x?.mode === 'prefab' || x?.mode === 'drilled' || x?.mode === 'both' ? x.mode : 'both';
            const label = typeof x?.label === 'string' ? x.label : '';
            return { p: Math.max(0, Math.min(100, p)), mode, label };
          })
          .filter(Boolean)
      : [];

    const markerItemsSorted = [...markerItems].sort((a: any, b: any) => (a?.p ?? 0) - (b?.p ?? 0));

    const total = layers.reduce((sum, l) => sum + l.thickness, 0);

    // 构建渐变
    let acc = 0;
    const gradientStops = layers.map((l) => {
      const start = (acc / total) * 100;
      acc += l.thickness;
      const end = (acc / total) * 100;
      return `${l.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    });
    const layerGradient = `linear-gradient(180deg, ${gradientStops.join(', ')})`;

    // 构建标签
    acc = 0;
    const labels = layers.map((l) => {
      const start = acc / total;
      acc += l.thickness;
      const end = acc / total;
      const midPct = ((start + end) / 2) * 100;
      return {
        top: `${midPct.toFixed(2)}%`,
        text: `${l.layerNumber}. ${l.name}`,
      };
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .scene {
      width: 260px;
      height: 260px;
      perspective: 800px;
      /* CSS变量 - 与web端一致 */
      --yaw: 45deg;
      --pitch: 0deg;
      --roll: 0deg;
      --scale: 0.6;
      --size: 260px;
      --half: 130px;
      --offsetY: 0px;
    }
    .cube {
      width: var(--size);
      height: var(--size);
      position: relative;
      transform-style: preserve-3d;
      /* 使用CSS变量，与web端完全一致 */
      transform: rotateZ(var(--roll)) rotateY(var(--yaw)) rotateX(var(--pitch)) scale3d(var(--scale), var(--scale), var(--scale)) translateY(var(--offsetY));
      transition: transform 0.1s ease-out;
    }
    .face {
      position: absolute;
      width: var(--size);
      height: var(--size);
      backface-visibility: visible;
      top: 0;
      left: 0;
    }
    .face-letter {
      position: absolute;
      top: 10px;
      left: 10px;
      font-size: 18px;
      line-height: 20px;
      font-weight: 800;
      color: #fff;
      background: rgba(0,0,0,0.75);
      border-radius: 6px;
      padding: 2px 6px;
      pointer-events: none;
      user-select: none;
    }
    .front {
      transform: rotateY(0deg) translateZ(var(--half));
      background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 100%), ${layerGradient};
      border: 1px solid rgba(0,0,0,0.2);
    }
    .back {
      transform: rotateY(180deg) translateZ(var(--half));
      background: linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.32) 100%), ${layerGradient};
      border: 1px solid rgba(0,0,0,0.2);
    }
    .left {
      transform: rotateY(-90deg) translateZ(var(--half));
      background: linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.4) 100%), ${layerGradient};
      border: 1px solid rgba(0,0,0,0.2);
    }
    .right {
      transform: rotateY(90deg) translateZ(var(--half));
      background: linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.35) 100%), ${layerGradient};
      border: 1px solid rgba(0,0,0,0.2);
    }
    .top {
      transform: rotateX(90deg) translateZ(var(--half));
      background: #5a4a3a;
      border: 1px solid rgba(0,0,0,0.3);
    }
    .bottom {
      transform: rotateX(-90deg) translateZ(var(--half));
      background: #3a2a1a;
      border: 1px solid rgba(0,0,0,0.3);
    }
    /* 标签面 - 与右侧面相邻，朝向用户倾斜 */
    .label-face {
      position: absolute;
      width: var(--size);
      height: var(--size);
      backface-visibility: visible;
      top: 0;
      left: 0;
      transform: rotateY(45deg) translateZ(var(--half));
      background: transparent;
      pointer-events: none;
    }
    .layer-label {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      white-space: nowrap;
      background: rgba(0,0,0,0.4);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .hud {
      position: absolute;
      left: 10px;
      bottom: 10px;
      display: flex;
      gap: 8px;
    }
    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(0,0,0,0.6);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
    }
    .icon-btn:hover {
      background: rgba(0,0,0,0.8);
    }
    .icon-btn svg {
      width: 18px;
      height: 18px;
      stroke: #fff;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .scale-bar {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .scale-text {
      font-size: 10px;
      color: rgba(0,0,0,0.7);
      margin-bottom: 4px;
    }
    .scale-line {
      width: 2px;
      height: 60px;
      background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 100%);
      position: relative;
    }
    .scale-line::before,
    .scale-line::after {
      content: '';
      position: absolute;
      left: -3px;
      width: 8px;
      height: 2px;
      background: rgba(0,0,0,0.8);
    }
    .scale-line::before { top: 0; }
    .scale-line::after { bottom: 0; }
    .marker-label-bar {
      position: absolute;
      right: 10px;
      top: 0;
      bottom: 0;
      width: 34px;
      pointer-events: none;
      display: block;
    }
    .marker-label {
      position: absolute;
      right: 0;
      transform: translateY(-50%);
      font-size: 8px;
      line-height: 10px;
      color: rgba(0,0,0,1);
      white-space: nowrap;
    }
    .warnings-panel {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 100;
    }
    .warning-toggle {
      width: 28px;
      height: 28px;
      border-radius: 14px;
      background: rgba(254, 243, 199, 0.95);
      border: 1px solid rgba(217, 119, 6, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .warning-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      background: #DC2626;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }
    .warning-list {
      margin-top: 6px;
      max-width: 200px;
      max-height: 150px;
      overflow-y: auto;
      pointer-events: auto;
      background: rgba(254, 243, 199, 0.95);
      border: 1px solid rgba(217, 119, 6, 0.3);
      border-radius: 8px;
      padding: 8px;
    }
    .warning-item {
      padding: 4px 0;
      font-size: 10px;
      line-height: 14px;
      color: #92400e;
      border-bottom: 1px solid rgba(217, 119, 6, 0.2);
    }
    .warning-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    ${pileWarnings && pileWarnings.length > 0 ? `
    <div class="warnings-panel" id="warningsPanel">
      <div class="warning-toggle" id="warningToggle">
        ⚠️
        <span class="warning-badge">${pileWarnings.length}</span>
      </div>
      <div class="warning-list" id="warningList" style="display: none;">
        ${pileWarnings.map(w => `<div class="warning-item">${w}</div>`).join('')}
      </div>
    </div>
    ` : ''}

    <div class="scale-bar">
      <div class="scale-text">0m</div>
      <div class="scale-line"></div>
      <div class="scale-text">${Math.round(total)}m</div>
    </div>

    <div class="marker-label-bar" id="markerLabelBar"></div>
    
    <div class="hud">
      <button class="icon-btn" id="rotateBtn" title="自动旋转">
        <svg viewBox="0 0 24 24">
          <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
          <path d="M21 3v6h-6"/>
        </svg>
      </button>
    </div>
    
    <div class="scene" id="scene">
      <div class="cube" id="cube">
        <div class="face top"></div>
        <div class="face front"><div class="face-letter">A</div></div>
        <div class="face right"><div class="face-letter">B</div></div>
        <div class="face back"><div class="face-letter">C</div></div>
        <div class="face left"><div class="face-letter">D</div></div>
        <div class="face bottom"></div>
        <!-- 标签单独一个面，与右侧面相邻 -->
        <div class="label-face">
          ${showLayerLabels ? labels.map(l => `<div class="layer-label" style="top: ${l.top}">${l.text}</div>`).join('') : ''}
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const MARKERS = ${JSON.stringify(markerItemsSorted)};
    const FACE_PILES = ${JSON.stringify(facePiles)};
    const MAX_TOP = ${maxTop != null && Number.isFinite(maxTop) ? Number(maxTop) : 'null'};
    const MIN_BOTTOM = ${minBottom != null && Number.isFinite(minBottom) ? Number(minBottom) : 'null'};
    let yaw = 45;
    let scale = 0.6;
    let autoRotate = false; // 默认关闭自动旋转（便于归正校验）
    let rafId = null;
    let lastTime = null;
    let isDragging = false;
    let lastX = 0;
    
    const scene = document.getElementById('scene');
    const cube = document.getElementById('cube');
    const rotateBtn = document.getElementById('rotateBtn');

    function buildWavePath(size, y, amplitude, period) {
      const amp = amplitude;
      const per = Math.max(4, period);
      const seg = per / 2;
      let d = 'M 0 ' + y.toFixed(2);
      for (let x = 0; x < size; x += seg) {
        const cx = x + seg / 2;
        const nx = Math.min(x + seg, size);
        const cy = y + (Math.floor(x / seg) % 2 === 0 ? -amp : amp);
        d += ' Q ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ' ' + nx.toFixed(2) + ' ' + y.toFixed(2);
      }
      return d;
    }

    function ensureMarkerOverlay(faceEl) {
      if (!faceEl) return null;
      let overlay = faceEl.querySelector(':scope > svg.marker-overlay');
      if (overlay) return overlay;
      const size = 260;
      overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      overlay.classList.add('marker-overlay');
      overlay.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
      overlay.setAttribute('width', String(size));
      overlay.setAttribute('height', String(size));
      overlay.style.position = 'absolute';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.overflow = 'visible';
      faceEl.appendChild(overlay);
      return overlay;
    }

    function ensurePileOverlay(faceEl) {
      if (!faceEl) return null;
      let overlay = faceEl.querySelector(':scope > svg.pile-overlay');
      if (overlay) return overlay;
      const size = 260;
      overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      overlay.classList.add('pile-overlay');
      overlay.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
      overlay.setAttribute('width', String(size));
      overlay.setAttribute('height', String(size));
      overlay.style.position = 'absolute';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.overflow = 'visible';
      faceEl.appendChild(overlay);
      return overlay;
    }

    function renderComparePiles() {
      if (!FACE_PILES || !MAX_TOP || !MIN_BOTTOM) return;
      const span = Math.max(0.0001, MAX_TOP - MIN_BOTTOM);
      const size = 260;
      const faceMap = {
        A: cube.querySelector('.front'),
        B: cube.querySelector('.right'),
        C: cube.querySelector('.back'),
        D: cube.querySelector('.left'),
      };

      Object.keys(faceMap).forEach((faceKey) => {
        const faceEl = faceMap[faceKey];
        if (!faceEl) return;
        const overlay = ensurePileOverlay(faceEl);
        if (!overlay) return;
        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

        const piles = Array.isArray(FACE_PILES[faceKey]) ? FACE_PILES[faceKey] : [];
        const valid = piles
          .map((p) => {
            const lengthM = Number(p && p.lengthM);
            const diameterMm = Number(p && p.diameterMm);
            const pileTopElevation = Number(p && p.pileTopElevation);
            const pileType = (p && typeof p.pileType === 'string' ? p.pileType : '').trim();
            if (!isFinite(lengthM) || lengthM <= 0) return null;
            if (!isFinite(diameterMm) || diameterMm <= 0) return null;
            if (!isFinite(pileTopElevation)) return null;
            if (!pileType) return null;
            return { lengthM, diameterMm, pileTopElevation, pileType };
          })
          .filter(Boolean);

        if (!valid || valid.length === 0) return;

        const n = valid.length;
        const xs = new Array(n).fill(0).map((_, i) => ((i + 1) / (n + 1)) * size);
        const maxWidth = size * 0.28;
        const minWidth = 4;

        const palette = [
          '#2F80ED',
          '#27AE60',
          '#F2994A',
          '#9B51E0',
          '#EB5757',
          '#56CCF2',
          '#219653',
          '#BB6BD9',
          '#F2C94C',
          '#6FCF97',
        ];

        function hashString(str) {
          let h = 0;
          for (let i = 0; i < str.length; i++) {
            h = (h * 31 + str.charCodeAt(i)) | 0;
          }
          return Math.abs(h);
        }

        function colorForPileType(pileType) {
          const idx = hashString(String(pileType || '')) % palette.length;
          return palette[idx];
        }

        valid.forEach((p, i) => {
          const startDepthM = Math.max(0, MAX_TOP - p.pileTopElevation);
          const y = (startDepthM / span) * size;
          const h = (p.lengthM / span) * size;
          const widthM = p.diameterMm / 1000;
          const w = Math.max(minWidth, Math.min(maxWidth, (widthM / span) * size));
          const x = xs[i] - w / 2;
          const y0 = Math.max(0, Math.min(size, y));
          const h0 = Math.max(0, Math.min(size - y0, h));
          const fillColor = colorForPileType(p.pileType);

          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', x.toFixed(2));
          rect.setAttribute('y', y0.toFixed(2));
          rect.setAttribute('width', w.toFixed(2));
          rect.setAttribute('height', h0.toFixed(2));
          rect.setAttribute('fill', fillColor);
          rect.setAttribute('fill-opacity', '0.55');
          rect.setAttribute('stroke', fillColor);
          rect.setAttribute('stroke-width', '1');
          overlay.appendChild(rect);
        });
      });
    }

    function renderMarkers() {
      if (!Array.isArray(MARKERS) || MARKERS.length === 0) return;

      const size = 260;
      const green = '#006636';
      const red = '#B20000';
      const strokeWidth = 1.5;
      const amplitude = 4;
      const period = 24;
      const dash = 10;

      const faces = [
        cube.querySelector('.front'),
        cube.querySelector('.back'),
        cube.querySelector('.left'),
        cube.querySelector('.right'),
      ].filter(Boolean);

      // 右侧编号标签
      const labelBar = document.getElementById('markerLabelBar');
      if (labelBar) {
        while (labelBar.firstChild) labelBar.removeChild(labelBar.firstChild);
      }

      faces.forEach((faceEl) => {
        const overlay = ensureMarkerOverlay(faceEl);
        if (!overlay) return;
        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

        MARKERS.forEach((m) => {
          const p = m && typeof m.p === 'number' ? m.p : null;
          if (p == null) return;
          const mode = m && (m.mode === 'prefab' || m.mode === 'drilled' || m.mode === 'both') ? m.mode : 'both';

          const y = (p / 100) * size;
          const d = buildWavePath(size, y, amplitude, period);

          if (mode === 'prefab' || mode === 'both') {
            const pathG = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathG.setAttribute('d', d);
            pathG.setAttribute('fill', 'none');
            pathG.setAttribute('stroke', green);
            pathG.setAttribute('stroke-width', String(strokeWidth));
            pathG.setAttribute('stroke-linecap', 'round');
            if (mode === 'both') {
              pathG.setAttribute('stroke-dasharray', String(dash) + ' ' + String(dash));
              pathG.setAttribute('stroke-dashoffset', '0');
            }
            overlay.appendChild(pathG);
          }

          if (mode === 'drilled' || mode === 'both') {
            const pathR = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathR.setAttribute('d', d);
            pathR.setAttribute('fill', 'none');
            pathR.setAttribute('stroke', red);
            pathR.setAttribute('stroke-width', String(strokeWidth));
            pathR.setAttribute('stroke-linecap', 'round');
            if (mode === 'both') {
              pathR.setAttribute('stroke-dasharray', String(dash) + ' ' + String(dash));
              pathR.setAttribute('stroke-dashoffset', String(dash));
            }
            overlay.appendChild(pathR);
          }
        });
      });

      // 标签只渲染一次（避免四个面重复追加）
      if (labelBar) {
        MARKERS.forEach((m) => {
          const p = m && typeof m.p === 'number' ? m.p : null;
          if (p == null) return;
          const label = m && typeof m.label === 'string' ? m.label : '';
          if (!label) return;
          const div = document.createElement('div');
          div.className = 'marker-label';
          div.style.top = p.toFixed(2) + '%';
          div.textContent = label;
          labelBar.appendChild(div);
        });
      }
    }
    
    function updateTransform() {
      scene.style.setProperty('--yaw', yaw + 'deg');
      scene.style.setProperty('--scale', scale);
    }
    
    // 自动旋转
    function toggleAutoRotate() {
      autoRotate = !autoRotate;
      rotateBtn.style.background = autoRotate ? 'rgba(178, 0, 26, 0.8)' : 'rgba(0,0,0,0.6)';
    }
    
    rotateBtn.addEventListener('click', toggleAutoRotate);
    
    // 警告面板展开/收起
    const warningToggle = document.getElementById('warningToggle');
    const warningList = document.getElementById('warningList');
    if (warningToggle && warningList) {
      warningToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = warningList.style.display === 'none';
        warningList.style.display = isHidden ? 'block' : 'none';
      });
    }
    
    // 页面加载后：启动一个常驻 RAF 循环，通过 autoRotate 开关控制是否旋转
    window.addEventListener('load', () => {
      rotateBtn.style.background = 'rgba(0,0,0,0.6)';
      renderMarkers();
      renderComparePiles();
      lastTime = performance.now();

      function tick(time) {
        const dt = Math.min(0.05, (time - lastTime) / 1000);
        lastTime = time;
        if (autoRotate && !isDragging) {
          yaw += dt * 30;
          updateTransform();
        }
        rafId = requestAnimationFrame(tick);
      }

      updateTransform();
      rafId = requestAnimationFrame(tick);
    });
    
    // 拖拽旋转
    const container = document.querySelector('.container');
    
    container.addEventListener('touchstart', (e) => {
      isDragging = true;
      lastX = e.touches[0].clientX;
      if (autoRotate) toggleAutoRotate();
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - lastX;
      lastX = e.touches[0].clientX;
      yaw += dx * 0.5;
      updateTransform();
    }, { passive: true });
    
    container.addEventListener('touchend', () => {
      isDragging = false;
    });
    
    // 鼠标拖拽
    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      if (autoRotate) toggleAutoRotate();
    });
    
    container.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      yaw += dx * 0.5;
      updateTransform();
    });
    
    container.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    container.addEventListener('mouseleave', () => {
      isDragging = false;
    });
    
    // 滚轮缩放
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      scale = Math.max(0.4, Math.min(1.2, scale + delta));
      updateTransform();
    }, { passive: false });
  </script>
</body>
</html>
    `;
  }, [soilLayers, markerElevations, markerLines, autoMarkerLines, comparePiles, showLayerLabels, pileWarnings]);

  const webSource = useMemo(() => ({ html: htmlContent }), [htmlContent]);

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
  }, [expanded, htmlContent]);

  if (!soilLayers || soilLayers.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity style={styles.toggleBtn} onPress={() => setExpanded(v => !v)}>
          <Text style={styles.toggleText}>{expanded ? '收起' : '展开'}</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.webviewContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#B20000" />
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={webSource}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            scrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            originWhitelist={['*']}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  toggleBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  toggleText: { color: '#fff', fontSize: 12 },
  webviewContainer: {
    height: 260,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 1,
  },
});

export default Soil3DWebView;
