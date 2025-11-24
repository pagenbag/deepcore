import React, { useState, useEffect, useRef, useCallback } from 'react';
import AsteroidCanvas from './components/AsteroidCanvas';
import Overlay from './components/Overlay';
import { GameState, UnitType, BuildingType, Entity, ASTEROID_RADIUS, SURFACE_LEVEL, MINE_ANGLE, REFINERY_ANGLE } from './types';
import { UNIT_STATS, TICK_RATE, ORE_VALUE, INITIAL_SLOTS, BUILDING_COSTS } from './constants';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    credits: 0,
    surfaceOre: 0,
    totalMined: 0,
    mineDepth: 10,
    units: [],
    buildings: INITIAL_SLOTS,
    lastTick: Date.now(),
    rotation: 0
  });

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  
  // Use ref for state in the loop to avoid closure staleness, 
  // though we will use functional updates mostly.
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Helper to create IDs
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // --- Game Logic ---

  const spawnUnit = (type: UnitType) => {
    const stats = UNIT_STATS[type];
    if (gameState.credits < stats.cost) return;

    // Determine spawn point
    // Miners spawn at mine entrance, Carriers at Refinery
    const isMiner = type === UnitType.MINER_BASIC || type === UnitType.MINER_DRILL;
    const spawnAngle = isMiner ? MINE_ANGLE : REFINERY_ANGLE;

    const newUnit: Entity = {
      id: generateId(),
      type,
      state: isMiner ? 'MOVING_TO_MINE' : 'IDLE',
      position: { x: 0, y: 0, angle: spawnAngle, radius: SURFACE_LEVEL },
      targetDepth: gameState.mineDepth,
      inventory: 0,
      maxCapacity: stats.capacity,
      speed: stats.speed,
      miningPower: stats.power,
      progress: 0
    };

    setGameState(prev => ({
      ...prev,
      credits: prev.credits - stats.cost,
      units: [...prev.units, newUnit]
    }));
  };

  const constructBuilding = (slotId: number, type: BuildingType) => {
    const cost = BUILDING_COSTS[type].baseCost; // Simplified cost logic for MVP
    if (gameState.credits < cost) return;

    setGameState(prev => ({
        ...prev,
        credits: prev.credits - cost,
        buildings: prev.buildings.map(b => b.id === slotId ? { ...b, type, level: 1 } : b)
    }));
    setSelectedSlot(null);
  };

  // --- The Game Loop ---

  const tick = useCallback(() => {
    setGameState(prev => {
      const now = Date.now();
      const dt = (now - prev.lastTick) / 1000; // Delta time in seconds
      
      let newCredits = prev.credits;
      let newSurfaceOre = prev.surfaceOre;
      let newTotalMined = prev.totalMined;
      let newDepth = prev.mineDepth;

      // Update Units
      const newUnits = prev.units.map(unit => {
        const u = { ...unit };
        const isMiner = u.type === UnitType.MINER_BASIC || u.type === UnitType.MINER_DRILL;
        
        // --- MINER LOGIC ---
        if (isMiner) {
           if (u.state === 'MOVING_TO_MINE') {
               // Move angle towards 0
               // Move radius towards target depth (SURFACE_LEVEL - depth)
               const targetRadius = SURFACE_LEVEL - 50; // Visual Mine "Interior"
               const radiusDiff = targetRadius - u.position.radius;
               
               if (Math.abs(radiusDiff) < 5) {
                   u.state = 'MINING';
                   u.progress = 0;
               } else {
                   u.position.radius += (radiusDiff > 0 ? 1 : -1) * u.speed * 20 * dt;
                   // Jiggle x/y slightly for visual effect inside mine
                   u.position.angle = MINE_ANGLE + (Math.sin(now/200 + parseInt(u.id)) * 2); 
               }
           }
           else if (u.state === 'MINING') {
               u.progress += dt * u.miningPower;
               if (u.progress >= 2) { // Time to mine
                   u.inventory = u.maxCapacity;
                   u.state = 'MOVING_TO_SURFACE';
               }
           }
           else if (u.state === 'MOVING_TO_SURFACE') {
               const targetRadius = SURFACE_LEVEL;
               const radiusDiff = targetRadius - u.position.radius;
               
               if (Math.abs(radiusDiff) < 5) {
                   u.state = 'DEPOSITING';
               } else {
                   u.position.radius += u.speed * 20 * dt;
               }
           }
           else if (u.state === 'DEPOSITING') {
               newSurfaceOre += u.inventory;
               newTotalMined += u.inventory;
               newDepth = 10 + Math.floor(newTotalMined / 100); // Depth increases with mining
               u.inventory = 0;
               u.state = 'MOVING_TO_MINE';
               u.targetDepth = newDepth; // Update target
           }
        }
        
        // --- CARRIER LOGIC ---
        else {
            const moveTowards = (targetAngle: number) => {
                const diff = targetAngle - u.position.angle;
                if (Math.abs(diff) < 2) return true;
                u.position.angle += (diff > 0 ? 1 : -1) * u.speed * 10 * dt;
                return false;
            };

            if (u.state === 'IDLE') {
                if (newSurfaceOre > 0) u.state = 'MOVING_TO_MINE';
            }
            else if (u.state === 'MOVING_TO_MINE') {
                // Move along surface to Mine
                if (moveTowards(MINE_ANGLE + 4)) { // Offset slightly right of mine
                    u.state = 'COLLECTING';
                }
            }
            else if (u.state === 'COLLECTING') {
                // Instant pickup for smoother gameplay
                const amountToTake = Math.min(u.maxCapacity, newSurfaceOre);
                if (amountToTake > 0) {
                    newSurfaceOre -= amountToTake;
                    u.inventory += amountToTake;
                    u.state = 'MOVING_TO_REFINERY';
                } else {
                    u.state = 'IDLE'; // Wait for ore
                }
            }
            else if (u.state === 'MOVING_TO_REFINERY') {
                if (moveTowards(REFINERY_ANGLE)) {
                    u.state = 'DEPOSITING';
                }
            }
            else if (u.state === 'DEPOSITING') {
                newCredits += u.inventory * ORE_VALUE;
                u.inventory = 0;
                u.state = 'IDLE';
            }
        }
        
        return u;
      });

      // Passive Buildings
      const crushers = prev.buildings.filter(b => b.type === BuildingType.CRUSHER).length;
      if (crushers > 0 && newSurfaceOre > 0) {
          const crushedAmt = Math.min(newSurfaceOre, crushers * dt * 5); // 5 ore per sec per crusher
          newSurfaceOre -= crushedAmt;
          newCredits += crushedAmt * ORE_VALUE;
      }

      return {
        ...prev,
        credits: newCredits,
        surfaceOre: newSurfaceOre,
        totalMined: newTotalMined,
        mineDepth: newDepth,
        units: newUnits,
        lastTick: now
      };
    });

    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [tick]);

  // Initial free unit
  useEffect(() => {
      // Small timeout to allow render
      setTimeout(() => {
          if (gameState.units.length === 0) {
              setGameState(p => ({ ...p, credits: 10 })); // Give starting cash
          }
      }, 500);
      // eslint-disable-next-line
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AsteroidCanvas 
        gameState={gameState} 
        setRotation={(val) => setGameState(p => ({...p, rotation: typeof val === 'function' ? val(p.rotation) : val}))}
        onConstruct={(id) => setSelectedSlot(id)}
      />
      <Overlay 
        gameState={gameState} 
        onBuyUnit={spawnUnit}
        selectedBuildingSlot={selectedSlot}
        onBuild={constructBuilding}
        onCloseBuildMenu={() => setSelectedSlot(null)}
      />
    </div>
  );
};

export default App;
