"use client";

import { useCallback, useMemo, useRef, useState, useEffect, type KeyboardEvent, type PointerEvent } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { formatINR } from "@/lib/format";

type Asset = { type: string; label: string; valueMinor: number; share: number };

const assetColors: Record<string, string> = { checking: "#235a45", savings: "#425d68", investment: "#b58b43" };

function AssetBox({ asset, size, position, onHover, onLeave }: {
  asset: Asset;
  size: number;
  position: [number, number, number];
  onHover: () => void;
  onLeave: () => void;
}) {
  return <mesh position={position} onPointerOver={(event) => { event.stopPropagation(); onHover(); }} onPointerOut={onLeave}>
    <boxGeometry args={[size, size, size]} />
    <meshStandardMaterial color={assetColors[asset.type] ?? "#425d68"} roughness={0.42} metalness={0.08} />
  </mesh>;
}

function InvalidateBridge({ register }: { register: (invalidate: () => void) => void }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => register(invalidate), [invalidate, register]);
  return null;
}

export function PortfolioScene({ assets }: { assets: Asset[] }) {
  const group = useRef<Group>(null);
  const invalidate = useRef<() => void>(() => undefined);
  const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [hovered, setHovered] = useState<Asset | null>(null);
  const registerInvalidate = useCallback((callback: () => void) => { invalidate.current = callback; }, []);
  const boxes = useMemo(() => {
    const maximum = Math.max(...assets.map((asset) => asset.valueMinor));
    const widths = assets.map((asset) => Math.max(0.58, Math.cbrt(asset.valueMinor / maximum) * 1.65));
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(assets.length - 1, 0) * 0.24;
    const offsets = widths.map((_, index) => widths.slice(0, index).reduce((sum, width) => sum + width + 0.24, 0));
    return assets.map((asset, index) => {
      const size = widths[index];
      const center = -totalWidth / 2 + offsets[index] + size / 2;
      return { asset, size, position: [center, (size - 1.1) / 2, 0] as [number, number, number] };
    });
  }, [assets]);

  function rotateWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!group.current) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      group.current.rotation.y += event.key === "ArrowLeft" ? 0.2 : -0.2;
      invalidate.current();
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      group.current.rotation.x += event.key === "ArrowUp" ? -0.12 : 0.12;
      invalidate.current();
    }
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId || !group.current) return;
    const deltaX = event.clientX - drag.current.x;
    const deltaY = event.clientY - drag.current.y;
    drag.current = { ...drag.current, x: event.clientX, y: event.clientY };
    group.current.rotation.y += deltaX * 0.008;
    group.current.rotation.x = Math.max(-0.65, Math.min(0.65, group.current.rotation.x + deltaY * 0.008));
    invalidate.current();
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div className="portfolio-scene" role="group" aria-roledescription="interactive 3D portfolio view" aria-label="Portfolio allocation boxes. Drag or use the arrow keys to rotate. Account values are listed below." tabIndex={0} onKeyDown={rotateWithKeyboard} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
    <Canvas dpr={[1, 1.25]} frameloop="demand" camera={{ position: [0, 2.9, 6.2], fov: 42 }} gl={{ antialias: false, alpha: true }} onCreated={({ gl }) => { gl.domElement.style.touchAction = "none"; }}>
      <InvalidateBridge register={registerInvalidate} />
      <ambientLight intensity={1.55} />
      <directionalLight position={[3, 5, 4]} intensity={2.1} />
      <directionalLight position={[-4, 1, -2]} intensity={0.55} color="#efe2c6" />
      <group ref={group} rotation={[0.06, -0.16, 0]}>
        {boxes.map(({ asset, size, position }) => <AssetBox key={asset.type} asset={asset} size={size} position={position} onHover={() => setHovered(asset)} onLeave={() => setHovered(null)} />)}
      </group>
    </Canvas>
    <div className="portfolio-hover-label" aria-live="polite" aria-atomic="true">{hovered ? <><strong>{hovered.label}</strong><span>{formatINR(hovered.valueMinor)}</span></> : <span>Asset balances</span>}</div>
    <span className="portfolio-rotate-hint" aria-hidden="true">DRAG OR USE ARROW KEYS TO ROTATE</span>
  </div>;
}
