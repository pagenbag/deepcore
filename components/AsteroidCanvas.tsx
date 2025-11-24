import React, { useMemo } from 'react';
import { GameState, ASTEROID_RADIUS, SURFACE_LEVEL, UnitType, BuildingType } from '../types';
import { RotateCw, RotateCcw, Factory, Home, Pickaxe, Cpu, Zap, Box } from 'lucide-react';

interface AsteroidCanvasProps {
  gameState: GameState;
  setRotation: (val: number | ((prev: number) => number)) => void;
  onConstruct: (slotId: number) => void;
}

const DEG_TO_RAD = Math.PI / 180;

const AsteroidCanvas: React.FC<AsteroidCanvasProps> = ({ gameState, setRotation, onConstruct }) => {
  const { rotation, units, buildings, surfaceOre, mineDepth } = gameState;

  // Calculate position on the circle based on angle and radius
  const getPosition = (angleDeg: number, radius: number) => {
    // Correct angle by game rotation
    const totalAngle = (angleDeg + rotation - 90) * DEG_TO_RAD; // -90 to start at top
    return {
      x: Math.cos(totalAngle) * radius,
      y: Math.sin(totalAngle) * radius,
      rot: angleDeg + rotation
    };
  };

  const handleRotateLeft = () => setRotation((p) => p + 10);
  const handleRotateRight = () => setRotation((p) => p - 10);

  // Render Units
  const renderedUnits = units.map((unit) => {
    const pos = getPosition(unit.position.angle, unit.position.radius);
    
    // Determine icon and color
    let color = 'bg-white';
    let size = 'w-3 h-3';
    
    if (unit.type === UnitType.MINER_BASIC) color = 'bg-yellow-400';
    if (unit.type === UnitType.MINER_DRILL) { color = 'bg-orange-500'; size = 'w-4 h-4 rounded-sm'; }
    if (unit.type === UnitType.CARRIER_ROVER) { color = 'bg-blue-400'; size = 'w-4 h-3 rounded-full'; }
    if (unit.type === UnitType.CARRIER_DRONE) { color = 'bg-cyan-300'; size = 'w-3 h-3 rounded-full ring-2 ring-cyan-500/50'; }

    return (
      <div
        key={unit.id}
        className={`absolute ${color} ${size} shadow-lg transition-transform duration-75`}
        style={{
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: `translate(-50%, -50%) rotate(${pos.rot}deg)`,
          zIndex: 20
        }}
      >
        {/* Inventory Indicator */}
        {unit.inventory > 0 && (
           <div className="absolute -top-2 left-0 w-full h-1 bg-green-500 rounded-full" />
        )}
      </div>
    );
  });

  // Render Buildings
  const renderedBuildings = buildings.map((slot) => {
    const pos = getPosition(slot.angle, SURFACE_LEVEL + 30); // Float slightly above surface
    const isVisible = pos.rot > -80 && pos.rot < 80; // Only render if roughly visible

    if (!isVisible && !slot.unlocked) return null;

    let Icon = Box;
    let label = "Empty";
    let color = "text-gray-500 border-gray-600 bg-gray-800/80";

    if (slot.type === BuildingType.DORMITORY) { Icon = Home; label = "Habitat"; color = "text-blue-400 border-blue-500 bg-blue-900/80"; }
    else if (slot.type === BuildingType.WORKSHOP) { Icon = Cpu; label = "Lab"; color = "text-purple-400 border-purple-500 bg-purple-900/80"; }
    else if (slot.type === BuildingType.CRUSHER) { Icon = Pickaxe; label = "Crusher"; color = "text-red-400 border-red-500 bg-red-900/80"; }
    else if (slot.type === BuildingType.REACTOR) { Icon = Zap; label = "Reactor"; color = "text-yellow-400 border-yellow-500 bg-yellow-900/80"; }

    return (
      <div
        key={slot.id}
        onClick={() => onConstruct(slot.id)}
        className={`absolute flex flex-col items-center justify-center p-2 border-2 rounded-lg cursor-pointer hover:scale-110 transition-all shadow-xl backdrop-blur-sm ${color}`}
        style={{
          left: `calc(50% + ${pos.x}px)`,
          top: `calc(50% + ${pos.y}px)`,
          transform: `translate(-50%, -50%) rotate(${pos.rot}deg)`,
          width: '60px',
          height: '60px',
          zIndex: 30,
          opacity: isVisible ? 1 : 0.3
        }}
      >
        {slot.type ? <Icon size={24} /> : <div className="text-2xl opacity-50">+</div>}
      </div>
    );
  });

  // Calculate Mine and Refinery Positions
  const minePos = getPosition(0, SURFACE_LEVEL);
  const refineryPos = getPosition(25, SURFACE_LEVEL);
  
  // Dynamic dirt pile visualization
  const pileSize = Math.min(60, 10 + Math.sqrt(surfaceOre) * 2);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-900 select-none">
      {/* Stars Background */}
      <div className="absolute inset-0 opacity-30" 
           style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
      
      {/* Main Game Container - Centered at bottom */}
      <div className="absolute bottom-0 left-1/2 w-0 h-0">
        
        {/* The Asteroid Body */}
        <div 
          className="absolute rounded-full bg-slate-800 border-8 border-slate-700 shadow-[0_0_100px_rgba(0,0,0,0.8)_inset]"
          style={{
            width: `${ASTEROID_RADIUS * 2}px`,
            height: `${ASTEROID_RADIUS * 2}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            transition: 'transform 0.1s linear'
          }}
        >
          {/* Surface texture detail (CSS pattern) */}
          <div className="absolute inset-0 opacity-20" 
               style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, transparent 90%, #000 90%)', backgroundSize: '100px 100px' }}></div>
          
          {/* The Mine Shaft Hole */}
          <div 
             className="absolute top-0 left-1/2 w-12 bg-black/60 blur-sm transform -translate-x-1/2"
             style={{ 
               height: `${Math.min(ASTEROID_RADIUS, 50 + mineDepth * 2)}px`, // Visual depth limit
               transformOrigin: 'top center'
             }}
          />
        </div>

        {/* Render Layer for Game Entities (rotates with logic, not CSS transform) */}
        {/* Note: We rendered units above using logic-based positions relative to center, so they don't need a parent rotator container, 
            allows us to keep text upright if we wanted, but here we rotated them. */}
        
        {renderedUnits}
        {renderedBuildings}

        {/* The Mine Entrance (Fixed on Asteroid surface logic) */}
        <div 
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
                left: `calc(50% + ${minePos.x}px)`,
                top: `calc(50% + ${minePos.y}px)`,
                transform: `translate(-50%, -50%) rotate(${minePos.rot}deg)`,
                zIndex: 25
            }}
        >
            {/* Ore Pile */}
            <div 
                className="bg-yellow-700/80 rounded-full transition-all duration-300"
                style={{ width: `${pileSize}px`, height: `${pileSize/2}px`, marginTop: '-20px' }}
            />
            <div className="bg-gray-800 text-xs px-2 py-0.5 rounded text-gray-300 border border-gray-600 mt-1">MINE</div>
        </div>

        {/* The Refinery */}
        <div 
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
                left: `calc(50% + ${refineryPos.x}px)`,
                top: `calc(50% + ${refineryPos.y}px)`,
                transform: `translate(-50%, -50%) rotate(${refineryPos.rot}deg)`,
                zIndex: 26
            }}
        >
             <Factory size={48} className="text-gray-300 fill-gray-700 drop-shadow-lg" />
             <div className="bg-gray-800 text-xs px-2 py-0.5 rounded text-gray-300 border border-gray-600 mt-[-10px]">REFINERY</div>
        </div>
      </div>

      {/* Rotation Controls (Floating) */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-8 z-50">
        <button 
          onMouseDown={() => {
             const interval = setInterval(handleRotateLeft, 50);
             window.addEventListener('mouseup', () => clearInterval(interval), { once: true });
          }}
          className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 active:scale-95 text-white shadow-xl border-2 border-slate-500"
        >
          <RotateCcw size={24} />
        </button>
        <div className="text-xs text-center text-gray-400 mt-2 absolute -bottom-6 w-full">Rotate Colony</div>
        <button 
          onMouseDown={() => {
            const interval = setInterval(handleRotateRight, 50);
            window.addEventListener('mouseup', () => clearInterval(interval), { once: true });
         }}
          className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 active:scale-95 text-white shadow-xl border-2 border-slate-500"
        >
          <RotateCw size={24} />
        </button>
      </div>

    </div>
  );
};

export default AsteroidCanvas;
