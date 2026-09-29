import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import { CatmullRomCurve3, DoubleSide, Quaternion, Vector3 } from 'three';
import type { Mesh } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { Layers2, RotateCcw, Move, ZoomIn, ZoomOut, ScanLine } from 'lucide-react';
import { organState, organs } from '../domain';
import type { HealthRecord, OrganId } from '../domain';

type Point = [number, number, number];
type Props = {
  selected: OrganId;
  onSelect: (id: OrganId) => void;
  records: HealthRecord[];
  history: HealthRecord[];
  date: string;
};
const points: Record<Exclude<OrganId, 'body'>, Point> = {
  brain: [0, 2.7, 0.1],
  thyroid: [0, 1.92, 0.26],
  lungs: [-0.4, 1.16, 0.04],
  heart: [0.18, 1.08, 0.29],
  liver: [-0.3, 0.45, 0.23],
  stomach: [0.35, 0.2, 0.22],
  kidneys: [0.42, -0.13, -0.07],
};
const labels: Partial<Record<OrganId, Point>> = {
  thyroid: [1.24, 2.02, 0],
  lungs: [-1.45, 1.36, 0],
  heart: [1.45, 1.05, 0],
  liver: [-1.42, 0.42, 0],
  kidneys: [1.42, -0.24, 0],
};
const tint = (id: OrganId, p: Props) => {
  const s = organState(
    p.records.filter((r) => r.organ === id),
    p.history.filter((r) => r.organ === id),
    p.date,
  );
  return s.outside ? '#c79955' : s.followUp ? '#aa9674' : s.missing ? '#aebdb6' : '#759d8b';
};
function Ellipsoid({
  position,
  scale,
  color = '#c7d9d0',
  opacity = 1,
  rotation = [0, 0, 0],
}: {
  position: Point;
  scale: Point;
  color?: string;
  opacity?: number;
  rotation?: Point;
}) {
  return (
    <mesh position={position} scale={scale} rotation={rotation}>
      <sphereGeometry args={[1, 40, 32]} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.48}
        metalness={0.05}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
        side={DoubleSide}
      />
    </mesh>
  );
}
function Limb({
  start,
  end,
  r1,
  r2,
  opacity,
}: {
  start: Point;
  end: Point;
  r1: number;
  r2: number;
  opacity: number;
}) {
  const { mid, length, quaternion } = useMemo(() => {
    const a = new Vector3(...start),
      b = new Vector3(...end);
    return {
      mid: a.clone().add(b).multiplyScalar(0.5),
      length: a.distanceTo(b),
      quaternion: new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        a.clone().sub(b).normalize(),
      ),
    };
  }, [start, end]);
  return (
    <mesh position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[r1, r2, length, 32]} />
      <meshPhysicalMaterial
        color="#bad0c5"
        roughness={0.5}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}
function Human({ transparent, ...props }: Props & { transparent: boolean }) {
  const { nodes } = useGLTF('/models/body-shell.glb');
  const shell = (nodes.BodyShell as Mesh).geometry;
  const skinOpacity = transparent ? 0.26 : 0.84;
  return (
    <group position={[0, 0.1, 0]}>
      <mesh geometry={shell}>
        <meshPhysicalMaterial
          color="#b4cebf"
          roughness={0.42}
          metalness={0.04}
          transparent
          opacity={skinOpacity}
          depthWrite={false}
        />
      </mesh>
      {transparent && (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <Ellipsoid
              key={i}
              position={[0, 1.57 - i * 0.27, -0.29]}
              scale={[0.08, 0.075, 0.06]}
              opacity={0.6}
              color="#c4cdbd"
            />
          ))}
          {Array.from({ length: 7 }, (_, i) =>
            [-1, 1].map((side) => {
              const y = 1.55 - i * 0.155,
                width = 0.46 + Math.sin((i / 7) * Math.PI) * 0.23;
              const curve = new CatmullRomCurve3([
                new Vector3(side * 0.08, y + 0.04, -0.25),
                new Vector3(side * width, y - 0.05, -0.06),
                new Vector3(side * width * 0.8, y - 0.18, 0.36),
                new Vector3(side * 0.1, y - 0.19, 0.37),
              ]);
              return (
                <Line
                  key={`${i}-${side}`}
                  points={curve.getPoints(24)}
                  lineWidth={1.8}
                  color="#c4cfbf"
                  transparent
                  opacity={0.3}
                />
              );
            }),
          )}
        </>
      )}
      {organs
        .filter((o) => o.id !== 'body')
        .map((o) => {
          const id = o.id as Exclude<OrganId, 'body'>,
            color = tint(id, props),
            selected = props.selected === id;
          const click = (e: { stopPropagation(): void }) => {
            e.stopPropagation();
            props.onSelect(id);
          };
          return (
            <group
              key={id}
              onClick={click}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = '';
              }}
            >
              {id === 'brain' && (
                <Ellipsoid
                  position={[0, 2.82, 0.015]}
                  scale={[0.255, 0.19, 0.23]}
                  color={color}
                  opacity={selected ? 0.7 : 0.15}
                />
              )}
              {id === 'thyroid' && (
                <>
                  <Ellipsoid
                    position={[-0.1, 1.95, 0.18]}
                    scale={[0.085, 0.115, 0.07]}
                    color={color}
                  />
                  <Ellipsoid
                    position={[0.1, 1.95, 0.18]}
                    scale={[0.085, 0.115, 0.07]}
                    color={color}
                  />
                  <Ellipsoid position={[0, 1.93, 0.2]} scale={[0.1, 0.035, 0.04]} color={color} />
                </>
              )}
              {id === 'lungs' &&
                [-1, 1].map((side) => (
                  <group key={side}>
                    <Ellipsoid
                      position={[side * 0.41, 1.16, 0.015]}
                      scale={[0.26, 0.51, 0.255]}
                      rotation={[0, 0, side * 0.15]}
                      color={color}
                      opacity={0.91}
                    />
                    <Line
                      points={[
                        [side * 0.42, 1.5, 0.26],
                        [side * 0.33, 1.05, 0.27],
                        [side * 0.51, 0.85, 0.23],
                      ]}
                      color="#d4ddd0"
                      lineWidth={1}
                      transparent
                      opacity={0.6}
                    />
                    {props.records.some(
                      (r) =>
                        r.organ === 'lungs' &&
                        r.kind === 'lesion' &&
                        r.laterality === (side === -1 ? '右侧' : '左侧'),
                    ) && (
                      <Ellipsoid
                        position={[side * 0.48, side === -1 ? 1.4 : 0.85, 0.255]}
                        scale={[0.035, 0.035, 0.035]}
                        color="#c68341"
                      />
                    )}
                  </group>
                ))}
              {id === 'heart' && (
                <group position={[0.12, 1.04, 0.26]} rotation={[0.15, 0, -0.4]}>
                  <Ellipsoid position={[0, 0, 0]} scale={[0.175, 0.26, 0.14]} color={color} />
                  <Ellipsoid position={[-0.07, 0.14, 0]} scale={[0.13, 0.12, 0.13]} color={color} />
                  <Limb
                    start={[-0.04, 0.15, 0]}
                    end={[0.01, 0.35, -0.02]}
                    r1={0.045}
                    r2={0.045}
                    opacity={0.85}
                  />
                </group>
              )}
              {id === 'liver' && (
                <group rotation={[0, 0, -0.2]} position={[-0.23, 0.45, 0.16]}>
                  <Ellipsoid position={[-0.09, 0, 0]} scale={[0.37, 0.23, 0.24]} color={color} />
                  <Ellipsoid
                    position={[0.22, 0.045, 0.02]}
                    scale={[0.29, 0.14, 0.16]}
                    color={color}
                  />
                </group>
              )}
              {id === 'stomach' && (
                <group position={[0.3, 0.14, 0.15]} rotation={[0, 0, -0.28]}>
                  <Ellipsoid position={[0, 0, 0]} scale={[0.18, 0.26, 0.14]} color={color} />
                  <Ellipsoid position={[-0.06, -0.15, 0]} scale={[0.19, 0.1, 0.12]} color={color} />
                </group>
              )}
              {id === 'kidneys' &&
                [-1, 1].map((side) => (
                  <Ellipsoid
                    key={side}
                    position={[side * 0.37, -0.15, -0.12]}
                    scale={[0.115, 0.21, 0.105]}
                    rotation={[0, 0, side * -0.22]}
                    color={color}
                  />
                ))}
              {selected && (
                <mesh position={points[id]} rotation={[0, 0, 0]}>
                  <ringGeometry
                    args={[
                      id === 'liver' || id === 'lungs' ? 0.41 : 0.28,
                      id === 'liver' || id === 'lungs' ? 0.42 : 0.29,
                      64,
                    ]}
                  />
                  <meshBasicMaterial color="#658c73" transparent opacity={0.5} depthTest={false} />
                </mesh>
              )}
              {labels[id] && (
                <>
                  <Line
                    points={[points[id], [labels[id]![0] * 0.8, labels[id]![1], 0.05], labels[id]!]}
                    color={selected ? '#47785e' : '#b9c7be'}
                    lineWidth={1}
                    transparent
                    opacity={0.8}
                  />
                  <Html position={labels[id]!} center zIndexRange={[5, 0]}>
                    <button
                      className={`model-label ${selected ? 'selected' : ''}`}
                      aria-label={`模型 ${o.name}`}
                      onClick={() => props.onSelect(id)}
                    >
                      <i style={{ background: color }} />
                      {o.name}
                      {selected && <span>↗</span>}
                    </button>
                  </Html>
                </>
              )}
            </group>
          );
        })}
      <mesh position={[0, -3.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.86, 100]} />
        <meshBasicMaterial color="#b9c9ba" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, -3.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.85, 64]} />
        <meshBasicMaterial color="#b1c7b7" transparent opacity={0.09} />
      </mesh>
    </group>
  );
}
function Camera({ back, zoom, revision }: { back: boolean; zoom: number; revision: number }) {
  const controls = useRef<OrbitControlsType>(null),
    { camera, invalidate, size } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.15, back ? -10 : 10);
    camera.zoom = (Math.min(size.height / 6.8, size.width / 3.6) * zoom) / 77;
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
  }, [back, zoom, revision, camera, invalidate, size.height, size.width]);
  return (
    <OrbitControls
      ref={controls}
      // Direct manipulation avoids residual orbit inertia overriding a preset view.
      enableDamping={false}
      enablePan={false}
      enableZoom={false}
      minPolarAngle={Math.PI / 3}
      maxPolarAngle={Math.PI / 1.6}
    />
  );
}
class ModelBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function Fallback(p: Props) {
  return (
    <div className="body-fallback" data-testid="body-fallback">
      <svg viewBox="0 0 320 520" aria-label="二维人体示意图" role="img">
        <defs>
          <linearGradient id="body-fill" x2="1" y2="1">
            <stop stopColor="#d5e0d3" />
            <stop offset="1" stopColor="#edf1e9" />
          </linearGradient>
        </defs>
        <path
          d="M160 20c-45 0-40 68-17 78v18c-55 4-58 24-66 60L46 285c-7 27 11 34 20 8l37-108-6 110 23 187c2 20 24 20 24 0l16-157 16 157c0 20 22 20 24 0l23-187-6-110 37 108c9 26 27 19 20-8l-31-109c-8-36-11-56-66-60V98c23-10 28-78-17-78Z"
          fill="url(#body-fill)"
          stroke="#9bb29f"
          strokeWidth="1.5"
        />
        {organs
          .filter((o) => o.id !== 'body')
          .map((o) => {
            const position = points[o.id as Exclude<OrganId, 'body'>];
            return (
              <g key={o.id} onClick={() => p.onSelect(o.id)}>
                <ellipse
                  cx={160 + position[0] * 55}
                  cy={255 - position[1] * 73}
                  rx={o.id === 'lungs' ? 30 : o.id === 'liver' ? 24 : 11}
                  ry={o.id === 'lungs' ? 32 : 12}
                  fill={tint(o.id, p)}
                  stroke={p.selected === o.id ? '#245e48' : 'none'}
                  strokeWidth="3"
                />
              </g>
            );
          })}
      </svg>
      <span className="fallback-caption">二维示意视图 · 请通过器官导航选择部位</span>
    </div>
  );
}
export default function BodyModel(props: Props) {
  const [transparent, setTransparent] = useState(true),
    [back, setBack] = useState(false),
    [zoom, setZoom] = useState(77);
  const [flat, setFlat] = useState(() => new URLSearchParams(location.search).get('view') === '2d');
  const [revision, setRevision] = useState(0);
  const setView = (value: boolean) => {
    setBack(value);
    setRevision((v) => v + 1);
  };
  const fallback = <Fallback {...props} />;
  return (
    <section className="body-panel" aria-label="身体空间视图">
      <div className="body-topline">
        <span>
          <span className="live-dot" /> 身体空间视图
        </span>
        <span className="micro">ANATOMY / {flat ? '02' : '03'}D</span>
      </div>
      <div className="view-switch">
        <button className={!back ? 'active' : ''} onClick={() => setView(false)}>
          正面
        </button>
        <button className={back ? 'active' : ''} onClick={() => setView(true)} disabled={flat}>
          背面
        </button>
      </div>
      <div className="anatomy-watermark">
        HUMAN
        <br />
        <span>ATLAS</span>
      </div>
      <div className="model-stage">
        {flat ? (
          fallback
        ) : (
          <ModelBoundary fallback={fallback}>
            <Suspense fallback={<div className="model-loading">正在构建身体视图…</div>}>
              <Canvas
                orthographic
                camera={{ position: [0, 0.15, 10], zoom: 77 }}
                dpr={[1, 2]}
                frameloop="demand"
                fallback={fallback}
                gl={{ antialias: true, alpha: true }}
                onCreated={({ gl }) => {
                  gl.domElement.addEventListener('webglcontextlost', () => setFlat(true));
                }}
              >
                <ambientLight intensity={1.45} />
                <directionalLight position={[3, 6, 7]} intensity={2.5} color="#fffaeb" />
                <directionalLight position={[-4, 2, -4]} intensity={1.7} color="#c4dfd2" />
                <Human {...props} transparent={transparent} />
                <Camera back={back} zoom={zoom} revision={revision} />
              </Canvas>
            </Suspense>
          </ModelBoundary>
        )}
      </div>
      <div className="model-tools">
        <button
          className={transparent ? 'active' : ''}
          title="切换透明层"
          aria-label="切换透明层"
          onClick={() => setTransparent((v) => !v)}
          disabled={flat}
        >
          <Layers2 size={17} />
        </button>
        <span />
        <button
          aria-label="放大人体"
          onClick={() => setZoom((v) => Math.min(110, v + 8))}
          disabled={flat}
        >
          <ZoomIn size={17} />
        </button>
        <button
          aria-label="缩小人体"
          onClick={() => setZoom((v) => Math.max(55, v - 8))}
          disabled={flat}
        >
          <ZoomOut size={17} />
        </button>
        <button
          aria-label="重置视角"
          onClick={() => {
            setView(false);
            setZoom(77);
          }}
          disabled={flat}
        >
          <RotateCcw size={16} />
        </button>
        <span />
        <button
          aria-label="切换二维视图"
          className={flat ? 'active' : ''}
          onClick={() => setFlat((v) => !v)}
        >
          <ScanLine size={17} />
        </button>
      </div>
      <div className="body-bottom">
        <span>
          <Move size={12} /> 拖动旋转 · 点击器官
        </span>
        <span>三维解剖示意 / 非医学重建</span>
      </div>
    </section>
  );
}
