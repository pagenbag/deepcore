
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { GameEngine } from '../game/GameEngine';
import { ASTEROID_RADIUS, SURFACE_LEVEL, MINE_ANGLE, PILE_ANGLE, BUILDING_CONFIG } from '../config';
import { BuildingType, UnitType } from '../types';
import { BatteryWarning, Settings, AlertTriangle } from 'lucide-react';

interface AsteroidCanvasProps {
  engine: GameEngine;
  tickVersion: number; // Force re-render
  setRotation: (val: number | ((prev: number) => number)) => void;
  rotation: number;
  onSelectSlot: (slotId: number) => void;
}

const DEG_TO_RAD = Math.PI / 180;

const AsteroidCanvas: React.FC<AsteroidCanvasProps> = ({ engine, rotation, setRotation, onSelectSlot }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);

  // --- MEMOIZED VISUALS ---
  const stars = useMemo(() => {
      const arr = [];
      for(let i=0; i<150; i++) {
          arr.push({ x: Math.random()*100, y: Math.random()*100, size: Math.random()*2+1, opacity: Math.random()*0.8+0.2 });
      }
      return arr;
  }, []);

  const craters = useMemo(() => {
      const arr = [];
      for(let i=0; i<12; i++) {
          arr.push({ x: Math.cos(Math.random()*6.28)*(ASTEROID_RADIUS-50), y: Math.sin(Math.random()*6.28)*(ASTEROID_RADIUS-50), size: 20+Math.random()*40 });
      }
      return arr;
  }, []);

  const minePath = useMemo(() => {
      const currentDepthPx = Math.min(300, 20 + engine.mineDepth * 1.5);
      const topWidth = 26;
      const bottomWidth = 34; 
      let d = `M -${topWidth/2} 0 L -${bottomWidth/2} ${currentDepthPx} L ${bottomWidth/2} ${currentDepthPx} L ${topWidth/2} 0 Z `;
      
      engine.tunnels.forEach(tun => {
          if (currentDepthPx > tun.depthPx + 10) {
              const y = tun.depthPx;
              const h = 20; 
              const w = tun.currentLength;
              if (tun.direction > 0) {
                  const startX = (topWidth/2) + ((bottomWidth-topWidth)/2) * (y/300);
                  d += `M ${startX} ${y} L ${startX + w} ${y} L ${startX + w} ${y+h} L ${startX} ${y+h} Z `;
              } else {
                  const startX = -((topWidth/2) + ((bottomWidth-topWidth)/2) * (y/300));
                  d += `M ${startX} ${y} L ${startX - w} ${y} L ${startX - w} ${y+h} L ${startX} ${y+h} Z `;
              }
          }
      });
      return d;
  }, [engine.mineDepth, engine.tunnels, engine.totalMined]); // Re-calc on mine change

  // --- HELPER ---
  const normalizeAngle = (angle: number) => {
    let a = angle % 360;
    while (a > 180) a -= 360;
    while (a <= -180) a += 360;
    return a;
  };

  const getPosition = (angleDeg: number, radius: number) => {
    const totalAngle = (angleDeg + rotation - 90) * DEG_TO_RAD; 
    return { x: Math.cos(totalAngle) * radius, y: Math.sin(totalAngle) * radius, rot: angleDeg + rotation };
  };

  const isVisible = (rot: number) => {
      const norm = normalizeAngle(rot);
      return norm > -100 && norm < 100;
  };

  // --- DRAG LOGIC ---
  const handlePointerDown = (e: React.PointerEvent) => {
     if (e.target !== containerRef.current && (e.target as HTMLElement).tagName === "BUTTON") return; 
     setIsDragging(true);
     (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setRotation(prev => prev + e.movementX * 0.5);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if(e.target instanceof Element) (e.target as Element).releasePointerCapture(e.pointerId);
  };

  // --- RENDER ---
  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-950 select-none cursor-move"
        ref={containerRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      
      {stars.map((star, i) => (<div key={i} className="absolute rounded-full bg-white" style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size, opacity: star.opacity }} />))}
      
      {engine.taxDue && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 animate-bounce pointer-events-none">
              <div className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg shadow-xl border-2 border-red-400 flex items-center gap-2">
                  <AlertTriangle size={20} /><span>TAX DUE!</span>
              </div>
          </div>
      )}

      <div className="absolute bottom-0 left-1/2 w-0 h-0">
        <div className="absolute rounded-full bg-stone-800 shadow-[0_0_150px_rgba(0,0,0,1)_inset]"
          style={{ width: `${ASTEROID_RADIUS * 2}px`, height: `${ASTEROID_RADIUS * 2}px`, transform: `translate(-50%, -50%) rotate(${rotation}deg)`, border: '8px solid #292524' }}>
          
          {craters.map((c, i) => (<div key={i} className="absolute rounded-full bg-stone-900/40" style={{ left: `calc(50% + ${c.x}px)`, top: `calc(50% + ${c.y}px)`, width: c.size, height: c.size, transform: 'translate(-50%, -50%)' }} />))}

          {/* Mine Shaft */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 overflow-visible" style={{ height: '300px', width: '100px' }}>
              <svg width="200" height="400" viewBox="-100 0 200 400" className="absolute top-0 left-1/2 -translate-x-1/2 overflow-visible">
                  <path d={minePath} fill="url(#mineGradient)" stroke="none" />
                  <defs><linearGradient id="mineGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#292524" stopOpacity="0"/><stop offset="100%" stopColor="#000" stopOpacity="0.95"/></linearGradient></defs>
              </svg>
             {engine.looseOreInMine > 0 && (
                 <div className="absolute left-1/2 -translate-x-1/2 w-full h-8" style={{ top: `${Math.min(300, 20 + engine.mineDepth * 1.5) - 6}px` }}>
                     {Array.from({length: Math.min(20, Math.ceil(engine.looseOreInMine / 5))}).map((_, i) => (
                         <div key={i} className="absolute w-1.5 h-1.5 bg-yellow-200 rounded-full" style={{ left: `${50+(Math.sin(i*123)*15)}%`, top: `${Math.abs(Math.cos(i*321)*5)}px` }} />
                     ))}
                 </div>
             )}
          </div>
        </div>

        {/* Buildings */}
        {engine.buildings.map(b => {
             const pos = getPosition(b.angle, SURFACE_LEVEL);
             const visible = isVisible(pos.rot);
             let Visual = null, Label = null;

             if (!b.type) {
                 Visual = <div className="mb-2 w-8 h-8 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 group-hover:text-white">+</div>;
             } else if (b.status !== 'COMPLETED') {
                 Visual = <div className="w-12 h-12 bg-yellow-400/20 border-x-4 border-slate-500 relative"><div className="absolute bottom-0 w-full bg-slate-700/80" style={{height: `${b.constructionProgress*100}%`}}></div></div>;
                 Label = <div className="bg-yellow-900/80 text-[9px] px-1 rounded text-yellow-200 mt-1">{Math.floor(b.constructionProgress*100)}%</div>;
             } else {
                 if(b.type === BuildingType.DORMITORY) {
                     Visual = <div className={`w-12 h-10 bg-blue-600 rounded-t-full border-4 border-blue-800 relative ${b.level>1?'scale-125':''}`}><div className="absolute bottom-0 w-full h-2 bg-blue-900 flex justify-center gap-1 px-1">{Array.from({length:5}).map((_,i)=><div key={i} className={`w-1 h-1 rounded-full ${i<b.occupants.length?'bg-green-400':'bg-black/50'}`} />)}</div></div>;
                     Label = <div className="bg-blue-900/80 text-[9px] px-1 rounded text-blue-200 mt-1">HABITAT</div>;
                 } else if (b.type === BuildingType.CRUSHER) {
                    Visual = <div className="w-12 h-10 bg-slate-700 border-2 border-slate-500 rounded flex items-center justify-center"><Settings className="text-slate-400 animate-spin-slow" size={20} /></div>;
                    Label = <div className="bg-slate-800 text-[9px] px-2 rounded text-slate-300 mt-1">CRUSHER</div>;
                 } else if (b.type === BuildingType.WORKSHOP) {
                    Visual = <div className="w-12 h-10 bg-slate-700 relative"><div className="absolute -top-4 w-0 h-0 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent border-b-[16px] border-b-slate-700"></div></div>;
                    Label = <div className="bg-purple-900/80 text-[9px] px-1 rounded text-purple-200 mt-1">LAB</div>;
                 } else if (b.type === BuildingType.LAUNCHPAD) {
                    Visual = <div className="w-16 h-20 bg-gray-200 relative"><div className="w-full h-full bg-red-600 clip-path-polygon-[50%_0,100%_100%,0_100%]"></div></div>;
                    Label = <div className="bg-red-600 text-[9px] px-1 rounded text-white mt-1 font-bold">LAUNCHPAD</div>;
                 } else {
                     Visual = <div className="w-12 h-10 bg-gray-700"></div>;
                     Label = <div className="bg-gray-800 text-[9px] px-1 rounded text-white mt-1">{b.type}</div>;
                 }
             }

             return (
                 <div key={b.id} onClick={(e)=>{e.stopPropagation(); onSelectSlot(b.id)}} onPointerEnter={()=>setHoveredSlotId(b.id)} onPointerLeave={()=>setHoveredSlotId(null)}
                      className="absolute flex flex-col items-center justify-end cursor-pointer hover:scale-105 transition-transform"
                      style={{ left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)`, transform: `translate(-50%, -50%) rotate(${pos.rot}deg)`, zIndex: 30, opacity: visible?1:0, pointerEvents: visible?'auto':'none' }}>
                     <div className="origin-bottom">{Visual}</div>
                     {Label}
                     {hoveredSlotId === b.id && b.type && (
                         <div className="absolute bottom-full mb-12 w-32 bg-gray-900/90 border border-gray-600 p-2 text-xs text-white rounded pointer-events-none z-50 text-center" style={{transform:`rotate(${-pos.rot}deg)`}}>
                             {BUILDING_CONFIG[b.type].label} <div className="text-yellow-500">Lvl {b.level}</div>
                         </div>
                     )}
                 </div>
             );
        })}

        {/* Units */}
        {engine.units.map(u => {
            const pos = getPosition(u.position.angle, u.position.radius);
            const visible = isVisible(pos.rot);
            const energyRatio = u.energy / u.maxEnergy;
            const filter = `grayscale(${100 - (energyRatio*100)}%) brightness(${50 + energyRatio*50}%)`;
            
            let Shape = <div className="w-3 h-3 bg-yellow-400 border border-yellow-600 rounded-sm relative" />;
            if (u.type === UnitType.MINER_DRILL) {
                Shape = <div className="w-5 h-6 bg-orange-700 clip-path-polygon-[0_0,100%_0,50%_100%] relative" />;
            }
            if (u.carriedBy) return null; // Don't render if picked up (carrier renders it)

            return (
                <div key={u.id} className="absolute pointer-events-none transition-opacity"
                     style={{ left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)`, transform: `translate(-50%, -50%) rotate(${pos.rot}deg)`, zIndex: 40, opacity: visible?1:0, filter }}>
                    {Shape}
                    {u.carryingId && <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-orange-700 clip-path-polygon-[0_0,100%_0,50%_100%]" />}
                    {u.state === 'CHARGING' && <BatteryWarning className="absolute -top-5 text-green-400" size={12} />}
                </div>
            )
        })}
        
        {/* Mine/Pile Labels */}
        <div className="absolute pointer-events-none" style={{...getStyles(MINE_ANGLE), zIndex:25}}>
             <div className="bg-amber-900 text-[10px] text-amber-100 px-2 py-0.5 -translate-y-6">MINE</div>
        </div>
        <div className="absolute pointer-events-none" style={{...getStyles(PILE_ANGLE), zIndex:25}}>
             <div className="bg-orange-600 w-6 h-4 rounded-t-lg -translate-y-2" style={{transform: `scale(${0.5 + Math.sqrt(engine.surfaceOre)*0.1})`}} />
        </div>

      </div>
    </div>
  );

  function getStyles(angle: number) {
      const p = getPosition(angle, SURFACE_LEVEL);
      return { left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)`, transform: `translate(-50%, -50%) rotate(${p.rot}deg)`, opacity: isVisible(p.rot)?1:0 };
  }
};

export default AsteroidCanvas;
