
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { GameState, ASTEROID_RADIUS, SURFACE_LEVEL, UnitType, BuildingType, PILE_ANGLE, MINE_ANGLE } from '../types';
import { RotateCw, RotateCcw, Settings, BatteryWarning, AlertTriangle } from 'lucide-react';
import { BUILDING_COSTS } from '../constants';

interface AsteroidCanvasProps {
  gameState: GameState;
  setRotation: (val: number | ((prev: number) => number)) => void;
  onSelectSlot: (slotId: number) => void;
}

const DEG_TO_RAD = Math.PI / 180;

const AsteroidCanvas: React.FC<AsteroidCanvasProps> = ({ gameState, setRotation, onSelectSlot }) => {
  const { rotation, units, buildings, surfaceOre, mineDepth, looseOreInMine, taxDue } = gameState;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);
  const rotationRef = useRef(rotation);
  
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  // --- MEMOIZED VISUALS ---
  const stars = useMemo(() => {
      const arr = [];
      for(let i=0; i<150; i++) {
          arr.push({
              x: Math.random() * 100,
              y: Math.random() * 100,
              size: Math.random() * 2 + 1,
              opacity: Math.random() * 0.8 + 0.2,
              blink: Math.random() > 0.8
          });
      }
      return arr;
  }, []);

  const craters = useMemo(() => {
      const arr = [];
      for(let i=0; i<12; i++) {
          const size = 20 + Math.random() * 40;
          const r = Math.random() * (ASTEROID_RADIUS - 50);
          const theta = Math.random() * Math.PI * 2;
          arr.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r, size });
      }
      return arr;
  }, []);

  // Root-like Mine Path Generator
  const minePath = useMemo(() => {
      const segments = Math.max(2, Math.min(50, Math.ceil(mineDepth / 5)));
      let d = `M 0 0 `;
      const depthPx = Math.min(300, 20 + mineDepth * 1.5);
      const segmentHeight = depthPx / segments;
      
      for(let i=1; i<=segments; i++) {
          const xOffset = Math.sin(i * 0.5) * 5;
          d += `L ${xOffset} ${i * segmentHeight} `;
      }
      // Widen at bottom
      const lastX = Math.sin(segments * 0.5) * 5;
      d += `L ${lastX - 10} ${depthPx} L ${lastX + 10} ${depthPx} L ${lastX} ${depthPx} `; 
      
      // Trace back up
      for(let i=segments; i>=1; i--) {
         const xOffset = Math.sin(i * 0.5) * 5;
         d += `L ${xOffset + 8} ${i * segmentHeight} `;
      }
      d += `Z`;
      
      return d;
  }, [mineDepth]);

  // --- HELPER ---
  const normalizeAngle = (angle: number) => {
    let a = angle % 360;
    while (a > 180) a -= 360;
    while (a <= -180) a += 360;
    return a;
  };

  const getPosition = (angleDeg: number, radius: number) => {
    const totalAngle = (angleDeg + rotation - 90) * DEG_TO_RAD; 
    return {
      x: Math.cos(totalAngle) * radius,
      y: Math.sin(totalAngle) * radius,
      rot: angleDeg + rotation
    };
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
  
  // Units (Z-Index 40)
  const renderedUnits = units.map((unit) => {
    const pos = getPosition(unit.position.angle, unit.position.radius);
    const visible = isVisible(pos.rot);
    
    const energyRatio = unit.energy / unit.maxEnergy;
    const saturation = Math.max(0, energyRatio * 100);
    const brightness = 50 + (energyRatio * 50);

    const filterStyle = { filter: `grayscale(${100 - saturation}%) brightness(${brightness}%)` };
    
    let size = 'w-3 h-3';
    let Shape = <div className="w-full h-full rounded-full bg-white" />;
    let zIndex = 40;

    if (unit.type === UnitType.MINER_BASIC) {
        Shape = <div className="w-full h-full bg-yellow-400 border border-yellow-600 rounded-sm relative">
            {unit.carryingId && (
                 <div className="absolute -top-3 -left-1 w-5 h-3 bg-transparent" />
            )}
        </div>;
    }
    if (unit.type === UnitType.MINER_DRILL) {
        // Upside down triangle
        size = 'w-5 h-6';
        zIndex = unit.carriedBy ? 41 : 35; 
        
        let transformY = '-translate-y-1/2';
        // If being carried, lift up
        if (unit.carriedBy) transformY = '-translate-y-4';
        // If Operating, appear BELOW carrier
        if (unit.state === 'OPERATING_DRILL') {
            zIndex = 39;
            transformY = 'translate-y-2'; // Push down
        }

        Shape = (
            <div className={`w-full h-full relative drop-shadow-lg ${unit.state === 'OPERATING_DRILL' ? 'animate-vibrate' : ''}`}>
               {/* Body */}
               <div 
                 className="w-full h-full bg-orange-700 border-2 border-orange-900"
                 style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
               ></div>
               {/* Details */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-gray-400"></div>
               {/* Spinning bit if operating */}
               {unit.state === 'OPERATING_DRILL' && (
                   <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-1 h-3 bg-white blur-[1px] animate-ping"></div>
               )}
            </div>
        );
    }
    if (unit.type === UnitType.CARRIER_DRONE) {
        size = 'w-4 h-4';
        Shape = <div className="w-full h-full bg-cyan-400 rounded-full border border-cyan-200 shadow-[0_0_10px_cyan]" />;
    }
    if (unit.type === UnitType.CARRIER_ROVER) {
        size = 'w-4 h-3';
        Shape = <div className="w-full h-full bg-blue-400 rounded-sm border border-blue-600" />;
    }

    let interactionAnim = "";
    if (unit.state === 'BUILDING' || unit.state === 'WORKING_IN_BUILDING') interactionAnim = "animate-bounce"; 
    
    let renderTransform = `translate(-50%, -50%) rotate(${pos.rot}deg)`;
    if (unit.type === UnitType.MINER_DRILL) {
        if (unit.carriedBy) renderTransform = `translate(-50%, -150%) rotate(${pos.rot}deg)`;
        if (unit.state === 'OPERATING_DRILL') renderTransform = `translate(-50%, 30%) rotate(${pos.rot}deg)`;
    }

    return (
      <div
        key={unit.id}
        className={`absolute ${size} pointer-events-none will-change-transform transition-opacity duration-300 ${interactionAnim}`}
        style={{
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: renderTransform,
          zIndex,
          opacity: visible ? 1 : 0,
          ...filterStyle
        }}
      >
        {Shape}
        {unit.inventory > 0 && (
           <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-200 rounded-full shadow-sm animate-pulse" />
        )}
        {unit.state === 'CHARGING' && (
           <>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-green-400">
                  <BatteryWarning size={10} />
              </div>
              <div className="absolute -top-6 left-full text-[8px] text-white animate-ping font-serif">Zzz</div>
           </>
        )}
      </div>
    );
  });

  // Buildings
  const renderedBuildings = buildings.map((slot) => {
    const pos = getPosition(slot.angle, SURFACE_LEVEL); 
    const visible = isVisible(pos.rot);
    const isHovered = hoveredSlotId === slot.id;
    let info = null;
    if (slot.type) info = BUILDING_COSTS[slot.type];

    let Visual = null;
    let Label = null;

    if (!slot.type) {
        Visual = (
            <div className="relative group flex flex-col items-center justify-end pb-1">
                <div className="mb-2 w-8 h-8 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 group-hover:text-white group-hover:border-white group-hover:bg-white/10 transition-all">
                    <span className="text-xl font-bold -mt-1">+</span>
                </div>
                <div className="w-12 h-1 bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.2)]"></div>
            </div>
        );
    } else if (slot.status === 'PENDING' || slot.status === 'UNDER_CONSTRUCTION') {
        const progress = slot.constructionProgress;
        Visual = (
            <div className="flex flex-col items-center relative -mb-1">
                 <div className="w-12 h-12 relative flex items-end justify-center">
                     <div 
                        className="absolute bottom-0 w-full bg-slate-700/80 grayscale opacity-80 overflow-hidden transition-all duration-300 origin-bottom"
                        style={{ height: '100%', transform: `scaleY(${0.1 + progress * 0.9})` }}
                     >
                         <div className="w-full h-full border-x-4 border-slate-500"></div>
                     </div>
                     <div className="absolute bottom-0 w-16 h-2 bg-yellow-400" 
                          style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, transparent)', backgroundSize: '10px 10px' }} 
                     />
                 </div>
                 <div className="w-14 h-2 bg-slate-800 mt-[-2px]"></div>
            </div>
        );
        Label = <div className="bg-yellow-900/80 text-[9px] px-1.5 py-0.5 rounded text-yellow-200 border border-yellow-700 mt-1 shadow animate-pulse whitespace-nowrap">
            {slot.status === 'PENDING' ? 'PLANNED' : `${Math.floor(slot.constructionProgress * 100)}%`}
        </div>;
    }
    else if (slot.type === BuildingType.DORMITORY) {
        const pop = slot.occupants.length;
        const upgraded = slot.level > 1;
        const scaleH = upgraded ? 'h-14' : 'h-10'; // Taller if upgraded
        const scaleW = upgraded ? 'w-14' : 'w-12'; // Wider if upgraded
        
        Visual = (
            <div className="flex flex-col items-center relative -mb-1 animate-[fadeIn_0.5s_ease-out]">
                 <div className={`${scaleW} ${scaleH} bg-blue-600 rounded-t-full border-4 border-blue-800 relative overflow-hidden shadow-lg transition-all`}>
                     <div className="absolute top-2 left-3 w-3 h-3 bg-cyan-300 rounded-full blur-[1px] animate-pulse"></div>
                     <div className="absolute bottom-0 w-full h-2 bg-blue-900 flex justify-center gap-1 px-1">
                        {Array.from({length: 5}).map((_, i) => (
                             <div key={i} className={`w-1 h-1 rounded-full ${i < pop ? 'bg-green-400' : 'bg-black/50'}`}></div>
                        ))}
                     </div>
                     {upgraded && (
                         <div className="absolute top-0 right-0 w-4 h-4 bg-yellow-400 transform rotate-45 translate-x-2 -translate-y-2 border border-yellow-600"></div>
                     )}
                 </div>
                 <div className="w-14 h-2 bg-slate-700 rounded-sm mt-[-2px]"></div>
            </div>
        );
        Label = <div className="bg-blue-900/80 text-[9px] px-1.5 py-0.5 rounded text-blue-200 border border-blue-700 mt-1 shadow whitespace-nowrap">HABITAT</div>;
    }
    else if (slot.type === BuildingType.WORKSHOP) {
        Visual = (
            <div className="flex flex-col items-center relative -mb-1 animate-[fadeIn_0.5s_ease-out]">
                <div className="w-12 h-10 bg-slate-700 border-2 border-slate-500 relative shadow-lg">
                    <div className="absolute -top-4 left-0 w-0 h-0 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent border-b-[16px] border-b-slate-700"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-6 bg-slate-900 border-t-2 border-x-2 border-slate-600"></div>
                </div>
                 <div className="w-14 h-1 bg-slate-800 mt-[-1px]"></div>
            </div>
        );
        Label = <div className="bg-purple-900/80 text-[9px] px-1.5 py-0.5 rounded text-purple-200 border border-purple-700 mt-1 shadow whitespace-nowrap">TECH LAB</div>;
    }
    else if (slot.type === BuildingType.REACTOR) {
        Visual = (
            <div className="flex flex-col items-center relative -mb-1 animate-[fadeIn_0.5s_ease-out]">
                <div className="w-10 h-12 bg-yellow-900 border-2 border-yellow-700 rounded-t-lg relative overflow-hidden shadow-lg flex items-center justify-center">
                    <div className="w-4 h-full bg-green-400/20 animate-pulse absolute"></div>
                </div>
                <div className="w-14 h-2 bg-slate-800 mt-[-2px]"></div>
            </div>
        );
        Label = <div className="bg-yellow-900/80 text-[9px] px-1.5 py-0.5 rounded text-yellow-200 border border-yellow-700 mt-1 shadow whitespace-nowrap">REACTOR</div>;
    }
    else if (slot.type === BuildingType.CRUSHER) {
        // Distinguish Main vs Aux
        if (slot.id === 0) {
            // Main Crusher (Grey/Gear)
            Visual = (
                <div className="flex flex-col items-center relative -mb-1 animate-[fadeIn_0.5s_ease-out]">
                     <div className="relative group mb-[2px]">
                         <div className="w-16 h-12 bg-slate-700 border-2 border-slate-500 rounded-lg flex items-center justify-center shadow-lg relative z-10">
                            <Settings className="text-slate-400 animate-spin-slow" size={24} />
                         </div>
                         {surfaceOre > 0 && <div className="absolute -top-4 left-1/2 w-2 h-2 bg-gray-400 rounded-full animate-ping opacity-50" />}
                     </div>
                     <div className="w-14 h-2 bg-slate-800 mt-[-1px]"></div>
                </div>
            );
            Label = <div className="bg-slate-800 text-[9px] px-2 py-0.5 rounded text-slate-300 border border-slate-600 mt-[2px] shadow whitespace-nowrap">ORE CRUSHER</div>;
        } else {
            // Aux Crusher (Red)
            Visual = (
                 <div className="flex flex-col items-center relative -mb-1 animate-[fadeIn_0.5s_ease-out]">
                    <div className="w-12 h-8 bg-red-900 border-2 border-red-700 rounded-sm flex items-center justify-center shadow-lg relative">
                        <div className="w-8 h-4 bg-black/50 animate-pulse"></div>
                        <div className="absolute -top-2 w-10 h-2 bg-red-800"></div>
                    </div>
                    <div className="w-14 h-2 bg-slate-800 mt-[-1px]"></div>
                </div>
            );
            Label = <div className="bg-red-900/80 text-[9px] px-1.5 py-0.5 rounded text-red-200 border border-red-700 mt-1 shadow whitespace-nowrap">AUX CRUSHER</div>;
        }
    }

    return (
      <div
        key={slot.id}
        onPointerEnter={() => setHoveredSlotId(slot.id)}
        onPointerLeave={() => setHoveredSlotId(null)}
        onClick={(e) => { e.stopPropagation(); onSelectSlot(slot.id); }}
        className="absolute flex flex-col items-center justify-end cursor-pointer hover:scale-105 transition-opacity duration-300"
        style={{
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: `translate(-50%, -50%) rotate(${pos.rot}deg)`, 
          zIndex: 30, 
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        <div className="mb-[2px] origin-bottom">{Visual}</div>
        {Label && <div className="mt-[2px]">{Label}</div>}
        {isHovered && info && visible && (
            <div 
                className="absolute bottom-full mb-12 w-48 bg-gray-900/95 border border-gray-600 rounded-lg p-3 shadow-2xl text-center pointer-events-none z-50"
                style={{ transform: `rotate(${-pos.rot}deg)`, transformOrigin: 'center bottom' }}
            >
                <div className="font-bold text-white">{info.label}</div>
                <div className="text-xs text-yellow-500 font-mono mb-1">
                    {slot.status === 'COMPLETED' ? `Level ${slot.level}` : 'Under Construction'}
                </div>
                <div className="text-[10px] text-gray-300 leading-tight">{info.desc}</div>
                {slot.type === BuildingType.DORMITORY && (
                    <div className="mt-2 text-[10px] text-green-400">Occupants: {slot.occupants.length}/5</div>
                )}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-600" />
            </div>
        )}
      </div>
    );
  });

  const minePos = getPosition(MINE_ANGLE, SURFACE_LEVEL);
  const mineVisible = isVisible(minePos.rot);
  const pilePos = getPosition(PILE_ANGLE, SURFACE_LEVEL);
  const pileVisible = isVisible(pilePos.rot);
  
  const pileScale = Math.min(2, 0.5 + Math.sqrt(surfaceOre) * 0.1);
  const toughnessColor = `hsl(${Math.max(0, 40 - mineDepth)}, 70%, 30%)`;

  return (
    <div 
        className="relative w-full h-full overflow-hidden bg-gray-950 select-none cursor-move"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
    >
      {/* Stars */}
      {stars.map((star, i) => (
          <div 
            key={i} className="absolute rounded-full bg-white"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: `${star.size}px`, height: `${star.size}px`, opacity: star.opacity }}
          />
      ))}
      
      {/* TAX ALERT */}
      {taxDue && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 animate-bounce">
              <div className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg shadow-xl border-2 border-red-400 flex items-center gap-2">
                  <AlertTriangle size={20} />
                  <span>TAX DUE! PAYING...</span>
              </div>
          </div>
      )}
      
      <div className="absolute bottom-0 left-1/2 w-0 h-0">
        <div 
          className="absolute rounded-full bg-stone-800 shadow-[0_0_150px_rgba(0,0,0,1)_inset] will-change-transform"
          style={{
            width: `${ASTEROID_RADIUS * 2}px`,
            height: `${ASTEROID_RADIUS * 2}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            border: '8px solid #292524'
          }}
        >
          {craters.map((c, i) => (
              <div 
                key={i} className="absolute rounded-full bg-stone-900/40 shadow-[inset_2px_2px_10px_rgba(0,0,0,0.6)]"
                style={{ left: `calc(50% + ${c.x}px)`, top: `calc(50% + ${c.y}px)`, width: c.size, height: c.size, transform: 'translate(-50%, -50%)' }}
              />
          ))}
          
          {/* THE MINE SHAFT - Root Style */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 overflow-visible" style={{ height: '300px', width: '20px' }}>
              <svg width="40" height="350" viewBox="0 0 40 350" className="absolute top-0 left-1/2 -translate-x-1/2">
                  <path 
                    d={minePath} 
                    fill={`url(#mineGradient)`} 
                    stroke="none"
                  />
                  <defs>
                      <linearGradient id="mineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#292524" stopOpacity="0"/>
                          <stop offset="10%" stopColor={toughnessColor} stopOpacity="0.8"/>
                          <stop offset="100%" stopColor="#000" stopOpacity="0.95"/>
                      </linearGradient>
                  </defs>
              </svg>
             
             {/* Loose Ore at bottom of rendered shaft */}
             {looseOreInMine > 0 && (
                 <div 
                    className="absolute left-1/2 -translate-x-1/2 w-full flex justify-center flex-wrap px-2"
                    style={{ top: `${Math.min(300, 20 + mineDepth * 1.5) - 10}px` }}
                 >
                     {Array.from({length: Math.min(15, Math.ceil(looseOreInMine / 5))}).map((_, i) => (
                         <div key={i} className="w-1.5 h-1.5 bg-yellow-200 rounded-full m-[1px] shadow-sm"></div>
                     ))}
                 </div>
             )}
          </div>
        </div>

        {renderedBuildings}
        {renderedUnits}

        <div 
            className="absolute flex flex-col items-center pointer-events-none will-change-transform transition-opacity duration-300"
            style={{
                left: `calc(50% + ${minePos.x}px)`, top: `calc(50% + ${minePos.y}px)`,
                transform: `translate(-50%, -50%) rotate(${minePos.rot}deg)`, zIndex: 25, opacity: mineVisible ? 1 : 0
            }}
        >
             <div className="flex flex-col items-center transform -translate-y-6">
                 <div className="bg-amber-900 border-2 border-amber-950 text-[10px] text-amber-100 px-2 py-0.5 rounded-sm font-serif shadow-lg whitespace-nowrap">MINE</div>
                 <div className="w-0.5 h-4 bg-amber-950"></div>
             </div>
        </div>

        <div 
            className="absolute flex flex-col items-center pointer-events-none will-change-transform transition-opacity duration-300"
            style={{
                left: `calc(50% + ${pilePos.x}px)`, top: `calc(50% + ${pilePos.y}px)`,
                transform: `translate(-50%, -50%) rotate(${pilePos.rot}deg)`, zIndex: 25, opacity: pileVisible ? 1 : 0
            }}
        >
            <div 
                className="bg-orange-600 transition-all duration-100 shadow-md"
                style={{ 
                    width: `${24 * pileScale}px`, 
                    height: `${16 * pileScale}px`, 
                    borderRadius: '50% 50% 5px 5px',
                    transform: `translateY(-${8 * pileScale}px)`, // Sit ON surface
                    clipPath: 'polygon(0% 100%, 10% 40%, 40% 0%, 60% 0%, 90% 40%, 100% 100%)'
                }}
            />
        </div>
      </div>

      <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 flex gap-8 z-40 pointer-events-auto opacity-50 hover:opacity-100 transition-opacity">
        <button 
          onMouseDown={() => { const interval = setInterval(() => setRotation(p => p+2), 20); const stop = () => clearInterval(interval); window.addEventListener('mouseup', stop, { once: true }); }}
          className="p-3 rounded-full bg-slate-800 text-white border border-slate-600"
        ><RotateCcw size={20} /></button>
        <button 
          onMouseDown={() => { const interval = setInterval(() => setRotation(p => p-2), 20); const stop = () => clearInterval(interval); window.addEventListener('mouseup', stop, { once: true }); }}
          className="p-3 rounded-full bg-slate-800 text-white border border-slate-600"
        ><RotateCw size={20} /></button>
      </div>
    </div>
  );
};

export default AsteroidCanvas;
