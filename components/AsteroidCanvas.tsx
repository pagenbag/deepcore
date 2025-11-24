import React, { useMemo, useRef, useState, useEffect } from 'react';
import { GameState, ASTEROID_RADIUS, SURFACE_LEVEL, UnitType, BuildingType, PILE_ANGLE, CRUSHER_ANGLE, MINE_ANGLE } from '../types';
import { RotateCw, RotateCcw, Settings } from 'lucide-react';
import { BUILDING_COSTS } from '../constants';

interface AsteroidCanvasProps {
  gameState: GameState;
  setRotation: (val: number | ((prev: number) => number)) => void;
  onSelectSlot: (slotId: number) => void;
}

const DEG_TO_RAD = Math.PI / 180;

const AsteroidCanvas: React.FC<AsteroidCanvasProps> = ({ gameState, setRotation, onSelectSlot }) => {
  const { rotation, units, buildings, surfaceOre, mineDepth } = gameState;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);
  const [hoveredCrusher, setHoveredCrusher] = useState(false);
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
      // Generate some random craters on the surface
      for(let i=0; i<12; i++) {
          const size = 20 + Math.random() * 40;
          // Position relative to center of asteroid (0,0)
          const r = Math.random() * (ASTEROID_RADIUS - 50);
          const theta = Math.random() * Math.PI * 2;
          arr.push({ 
              x: Math.cos(theta) * r, 
              y: Math.sin(theta) * r, 
              size 
          });
      }
      return arr;
  }, []);

  // --- HELPER ---
  const getPosition = (angleDeg: number, radius: number) => {
    const totalAngle = (angleDeg + rotation - 90) * DEG_TO_RAD; 
    return {
      x: Math.cos(totalAngle) * radius,
      y: Math.sin(totalAngle) * radius,
      rot: angleDeg + rotation
    };
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
  
  // Units
  const renderedUnits = units.map((unit) => {
    const pos = getPosition(unit.position.angle, unit.position.radius);
    
    let color = 'bg-white';
    let size = 'w-3 h-3';
    let Shape = <div className="w-full h-full rounded-full bg-white" />;
    
    if (unit.type === UnitType.MINER_BASIC) {
        color = 'bg-yellow-400';
        Shape = <div className="w-full h-full bg-yellow-400 border border-yellow-600 rounded-sm" />;
    }
    if (unit.type === UnitType.MINER_DRILL) {
        size = 'w-5 h-5';
        Shape = <div className="w-full h-full bg-orange-600 border-2 border-orange-800 rounded-sm" />;
    }
    if (unit.type === UnitType.CARRIER_DRONE) {
        size = 'w-4 h-4';
        Shape = <div className="w-full h-full bg-cyan-400 rounded-full border border-cyan-200 shadow-[0_0_10px_cyan]" />;
    }

    return (
      <div
        key={unit.id}
        className={`absolute ${size} pointer-events-none will-change-transform`}
        style={{
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: `translate(-50%, -50%) rotate(${pos.rot}deg)`,
          zIndex: 20
        }}
      >
        {Shape}
        {unit.inventory > 0 && (
           <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-200 rounded-full shadow-sm animate-pulse" />
        )}
      </div>
    );
  });

  // Buildings
  const renderedBuildings = buildings.map((slot) => {
    const pos = getPosition(slot.angle, SURFACE_LEVEL); 
    const isVisible = pos.rot > -95 && pos.rot < 95; // Cull hidden

    if (!isVisible && !slot.unlocked) return null;

    const isHovered = hoveredSlotId === slot.id;
    let info = null;
    if (slot.type) info = BUILDING_COSTS[slot.type];

    let Visual = null;
    let Label = null;

    if (!slot.type) {
        // Empty Slot
        Visual = (
            <div className="relative group flex flex-col items-center justify-end pb-1">
                {/* Floating Plus */}
                <div className="mb-2 w-8 h-8 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 group-hover:text-white group-hover:border-white group-hover:bg-white/10 transition-all">
                    <span className="text-xl font-bold -mt-1">+</span>
                </div>
                {/* Foundation Marker */}
                <div className="w-12 h-1 bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.2)]"></div>
            </div>
        );
        Label = <div className="text-[8px] text-gray-500 mt-1 uppercase tracking-widest font-bold">Site {slot.id}</div>;
    } 
    else if (slot.type === BuildingType.DORMITORY) {
        Visual = (
            <div className="flex flex-col items-center relative -mb-1">
                 {/* Habitat Dome */}
                 <div className="w-12 h-10 bg-blue-600 rounded-t-full border-4 border-blue-800 relative overflow-hidden shadow-lg">
                     <div className="absolute top-2 left-3 w-3 h-3 bg-cyan-300 rounded-full blur-[1px] animate-pulse"></div>
                     <div className="absolute bottom-0 w-full h-2 bg-blue-900"></div>
                 </div>
                 {/* Base */}
                 <div className="w-14 h-2 bg-slate-700 rounded-sm mt-[-2px]"></div>
            </div>
        );
        Label = <div className="bg-blue-900/80 text-[9px] px-1.5 py-0.5 rounded text-blue-200 border border-blue-700 mt-1 shadow">HABITAT</div>;
    }
    else if (slot.type === BuildingType.WORKSHOP) {
        Visual = (
            <div className="flex flex-col items-center relative -mb-1">
                {/* Workshop Factory */}
                <div className="w-12 h-10 bg-slate-700 border-2 border-slate-500 relative shadow-lg">
                    {/* Roof */}
                    <div className="absolute -top-4 left-0 w-0 h-0 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent border-b-[16px] border-b-slate-700"></div>
                    {/* Door */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-6 bg-slate-900 border-t-2 border-x-2 border-slate-600"></div>
                    {/* Chimney */}
                    <div className="absolute -top-6 right-1 w-3 h-6 bg-slate-600 border border-slate-500"></div>
                    {/* Smoke */}
                    <div className="absolute -top-8 right-1.5 w-2 h-2 bg-gray-400 rounded-full opacity-50 animate-ping"></div>
                </div>
                 <div className="w-14 h-1 bg-slate-800 mt-[-1px]"></div>
            </div>
        );
        Label = <div className="bg-purple-900/80 text-[9px] px-1.5 py-0.5 rounded text-purple-200 border border-purple-700 mt-1 shadow">TECH LAB</div>;
    }
    else if (slot.type === BuildingType.REACTOR) {
        Visual = (
            <div className="flex flex-col items-center relative -mb-1">
                {/* Reactor Core */}
                <div className="w-10 h-12 bg-yellow-900 border-2 border-yellow-700 rounded-t-lg relative overflow-hidden shadow-lg flex items-center justify-center">
                    <div className="w-4 h-full bg-green-400/20 animate-pulse absolute"></div>
                    <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-50"></div>
                </div>
                <div className="w-14 h-2 bg-slate-800 mt-[-2px]"></div>
            </div>
        );
        Label = <div className="bg-yellow-900/80 text-[9px] px-1.5 py-0.5 rounded text-yellow-200 border border-yellow-700 mt-1 shadow">REACTOR</div>;
    }
    else if (slot.type === BuildingType.CRUSHER) {
        Visual = (
             <div className="flex flex-col items-center relative -mb-1">
                <div className="w-12 h-8 bg-red-900 border-2 border-red-700 rounded-sm flex items-center justify-center shadow-lg relative">
                    <div className="w-8 h-4 bg-black/50 animate-pulse"></div>
                    <div className="absolute -top-2 w-10 h-2 bg-red-800"></div>
                </div>
                <div className="w-14 h-2 bg-slate-800 mt-[-1px]"></div>
            </div>
        );
        Label = <div className="bg-red-900/80 text-[9px] px-1.5 py-0.5 rounded text-red-200 border border-red-700 mt-1 shadow">AUX CRUSHER</div>;
    }

    return (
      <div
        key={slot.id}
        onPointerEnter={() => setHoveredSlotId(slot.id)}
        onPointerLeave={() => setHoveredSlotId(null)}
        onClick={(e) => { e.stopPropagation(); onSelectSlot(slot.id); }}
        className="absolute flex flex-col items-center justify-end cursor-pointer hover:scale-105 transition-transform duration-200"
        style={{
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: `translate(-50%, -50%) rotate(${pos.rot}deg)`, // Rotates around center of container which is at surface
          // To make it "stand" on surface, we ensure the 'bottom' of the Visual is near the center of this container
          zIndex: 30,
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
      >
        {/* Container is centered on surface. 
            We push visual UP (negative margin or just flex order) 
            We push label DOWN 
        */}
        <div className="mb-[2px] origin-bottom">{Visual}</div>
        <div className="mt-[2px]">{Label}</div>

        {/* TOOLTIP */}
        {isHovered && info && (
            <div 
                className="absolute bottom-full mb-12 w-48 bg-gray-900/95 border border-gray-600 rounded-lg p-3 shadow-2xl text-center pointer-events-none z-50"
                style={{ 
                    transform: `rotate(${-pos.rot}deg)`, // Counter-rotate
                    transformOrigin: 'center bottom'
                }}
            >
                <div className="font-bold text-white">{info.label}</div>
                <div className="text-xs text-yellow-500 font-mono mb-1">Level {slot.level}</div>
                <div className="text-[10px] text-gray-300 leading-tight">{info.desc}</div>
                <div className="mt-2 text-[10px] text-blue-400 uppercase tracking-widest font-bold">Click to Manage</div>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-600" />
            </div>
        )}
      </div>
    );
  });

  const minePos = getPosition(MINE_ANGLE, SURFACE_LEVEL);
  const pilePos = getPosition(PILE_ANGLE, SURFACE_LEVEL);
  const crusherPos = getPosition(CRUSHER_ANGLE, SURFACE_LEVEL);
  
  const pileScale = Math.min(2, 0.5 + Math.sqrt(surfaceOre) * 0.1);
  
  // Visual depth calculation
  const holeDepthPx = Math.min(300, 20 + mineDepth * 1.5); 
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
            key={i}
            className="absolute rounded-full bg-white"
            style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity,
                boxShadow: star.blink ? '0 0 4px white' : 'none'
            }}
          />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-900/10 to-transparent pointer-events-none" />

      <div className="absolute bottom-0 left-1/2 w-0 h-0">
        
        {/* ASTEROID BODY */}
        <div 
          className="absolute rounded-full bg-stone-800 shadow-[0_0_150px_rgba(0,0,0,1)_inset] will-change-transform"
          style={{
            width: `${ASTEROID_RADIUS * 2}px`,
            height: `${ASTEROID_RADIUS * 2}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            border: '8px solid #292524'
          }}
        >
          {/* Craters */}
          {craters.map((c, i) => (
              <div 
                key={i} 
                className="absolute rounded-full bg-stone-900/40 shadow-[inset_2px_2px_10px_rgba(0,0,0,0.6)]"
                style={{
                    left: `calc(50% + ${c.x}px)`,
                    top: `calc(50% + ${c.y}px)`,
                    width: c.size,
                    height: c.size,
                    transform: 'translate(-50%, -50%)'
                }}
              />
          ))}
          
          {/* Surface Texture Overlays */}
          <div className="absolute inset-0 opacity-40 rounded-full" 
               style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.1), transparent 70%)' }}></div>
          <div className="absolute inset-0 opacity-30"
               style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/200\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }}></div>
          
          {/* THE MINE SHAFT HOLE (Rotates with asteroid) */}
          <div 
             className="absolute top-0 left-1/2 w-14 transform -translate-x-1/2 shadow-[inset_0_10px_20px_rgba(0,0,0,0.9)] overflow-hidden"
             style={{ 
               height: `${holeDepthPx}px`, 
               backgroundColor: '#1a1a1a', // Base dark
               borderRadius: '0 0 10px 10px',
               transition: 'height 0.5s'
             }}
          >
             <div className="absolute inset-0 opacity-50"
                  style={{ background: `linear-gradient(to bottom, transparent, ${toughnessColor})` }}
             />
             <div className="absolute top-0 left-2 w-1 h-full bg-stone-600 opacity-50" 
                  style={{ background: 'repeating-linear-gradient(to bottom, #555 0, #555 2px, transparent 2px, transparent 10px)'}} 
             />
          </div>
        </div>

        {renderedUnits}
        {renderedBuildings}

        {/* FIXED SURFACE FEATURES */}

        {/* Mine Entrance Sign */}
        <div 
            className="absolute flex flex-col items-center pointer-events-none will-change-transform"
            style={{
                left: `calc(50% + ${minePos.x}px)`,
                top: `calc(50% + ${minePos.y}px)`,
                transform: `translate(-50%, -50%) rotate(${minePos.rot}deg)`,
                zIndex: 25
            }}
        >
             <div className="flex flex-col items-center transform -translate-y-6">
                 <div className="bg-amber-900 border-2 border-amber-950 text-[10px] text-amber-100 px-2 py-0.5 rounded-sm font-serif shadow-lg">MINE</div>
                 <div className="w-0.5 h-4 bg-amber-950"></div>
             </div>
        </div>

        {/* Ore Pile */}
        <div 
            className="absolute flex flex-col items-center pointer-events-none will-change-transform"
            style={{
                left: `calc(50% + ${pilePos.x}px)`,
                top: `calc(50% + ${pilePos.y}px)`,
                transform: `translate(-50%, -50%) rotate(${pilePos.rot}deg)`,
                zIndex: 25
            }}
        >
            <div 
                className="bg-orange-600 rounded-full border-b-4 border-orange-800 transition-all duration-100"
                style={{ 
                    width: `${20 * pileScale}px`, 
                    height: `${15 * pileScale}px`, 
                    transform: `translateY(-${5 * pileScale}px)`
                }}
            />
            {surfaceOre > 0 && <div className="text-[10px] text-orange-200 font-mono mt-1">{Math.floor(surfaceOre)}</div>}
        </div>

        {/* Main Crusher */}
        <div 
            className="absolute flex flex-col items-center cursor-pointer will-change-transform hover:scale-105 transition-transform"
            style={{
                left: `calc(50% + ${crusherPos.x}px)`,
                top: `calc(50% + ${crusherPos.y}px)`,
                transform: `translate(-50%, -50%) rotate(${crusherPos.rot}deg)`,
                zIndex: 26
            }}
            onPointerEnter={() => setHoveredCrusher(true)}
            onPointerLeave={() => setHoveredCrusher(false)}
            onClick={(e) => { 
                e.stopPropagation(); 
                // Placeholder for future interaction 
            }}
        >
             <div className="relative group mb-[2px]">
                 <div className="w-16 h-12 bg-slate-700 border-2 border-slate-500 rounded-lg flex items-center justify-center shadow-lg relative z-10">
                    <Settings className="text-slate-400 animate-spin-slow" size={24} />
                 </div>
                 <div className="absolute top-1/2 -left-4 w-6 h-2 bg-slate-600 transform -rotate-12 z-0" />
                 {surfaceOre > 0 && (
                     <div className="absolute -top-4 left-1/2 w-2 h-2 bg-gray-400 rounded-full animate-ping opacity-50" />
                 )}
             </div>
             <div className="bg-slate-800 text-[10px] px-2 py-0.5 rounded text-slate-300 border border-slate-600 mt-[2px]">CRUSHER</div>

             {/* Crusher Tooltip */}
             {hoveredCrusher && (
                <div 
                    className="absolute bottom-full mb-8 w-48 bg-gray-900/95 border border-gray-600 rounded-lg p-3 shadow-2xl text-center pointer-events-none z-50"
                    style={{ 
                        transform: `rotate(${-crusherPos.rot}deg)`,
                        transformOrigin: 'center bottom'
                    }}
                >
                    <div className="font-bold text-white">Ore Crusher</div>
                    <div className="text-xs text-yellow-500 font-mono mb-1">Level 1</div>
                    <div className="text-[10px] text-gray-300 leading-tight">Main processing unit. Converts surface ore into credits automatically.</div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-600" />
                </div>
             )}
        </div>
      </div>

      {/* Manual Rotate Buttons */}
      <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 flex gap-8 z-40 pointer-events-auto opacity-50 hover:opacity-100 transition-opacity">
        <button 
          onMouseDown={() => {
             const interval = setInterval(() => setRotation(p => p+2), 20);
             const stop = () => clearInterval(interval);
             window.addEventListener('mouseup', stop, { once: true });
          }}
          className="p-3 rounded-full bg-slate-800 text-white border border-slate-600"
        >
          <RotateCcw size={20} />
        </button>
        <button 
          onMouseDown={() => {
            const interval = setInterval(() => setRotation(p => p-2), 20);
            const stop = () => clearInterval(interval);
            window.addEventListener('mouseup', stop, { once: true });
         }}
          className="p-3 rounded-full bg-slate-800 text-white border border-slate-600"
        >
          <RotateCw size={20} />
        </button>
      </div>

    </div>
  );
};

export default AsteroidCanvas;