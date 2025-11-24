
import React, { useState, useEffect, useCallback } from 'react';
import AsteroidCanvas from './components/AsteroidCanvas';
import Overlay from './components/Overlay';
import { GameState, UnitType, BuildingType, Entity, SURFACE_LEVEL, MINE_ANGLE, PILE_ANGLE } from './types';
import { UNIT_STATS, ORE_VALUE, INITIAL_SLOTS, BUILDING_COSTS, BASE_CRUSHER_RATE, BASE_POPULATION, POPULATION_PER_HABITAT, ENERGY_DRAIN_RATE, ENERGY_RECHARGE_RATE } from './constants';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    credits: 10,
    surfaceOre: 0,
    totalMined: 0,
    mineDepth: 0, // Starts at 0 visually
    maxPopulation: BASE_POPULATION,
    units: [],
    buildings: INITIAL_SLOTS,
    lastTick: Date.now(),
    rotation: 0,
    targetRotation: null
  });

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Helper to create IDs
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // --- Game Logic ---

  const spawnUnit = (type: UnitType) => {
    const stats = UNIT_STATS[type];
    if (gameState.credits < stats.cost) return;
    if (gameState.units.length >= gameState.maxPopulation) return;

    // Spawn at the first available dormitory/Habitat
    const dorm = gameState.buildings.find(b => b.type === BuildingType.DORMITORY);
    const spawnAngle = dorm ? dorm.angle : MINE_ANGLE;

    const newUnit: Entity = {
      id: generateId(),
      type,
      state: 'MOVING_TO_MINE',
      position: { x: 0, y: 0, angle: spawnAngle, radius: SURFACE_LEVEL },
      targetDepth: gameState.mineDepth,
      inventory: 0,
      maxCapacity: stats.capacity,
      energy: stats.maxEnergy,
      maxEnergy: stats.maxEnergy,
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
    // Free Habitat Logic: If it's a dormitory and we have 0 of them, cost is 0
    const existingDorms = gameState.buildings.filter(b => b.type === BuildingType.DORMITORY).length;
    const isFreeHabitat = type === BuildingType.DORMITORY && existingDorms === 0;
    
    const cost = isFreeHabitat ? 0 : BUILDING_COSTS[type].baseCost;

    if (gameState.credits < cost) return;

    setGameState(prev => {
        const newBuildings = prev.buildings.map(b => b.id === slotId ? { ...b, type, level: 1 } : b);
        
        // Recalculate Max Pop
        const dormCount = newBuildings.filter(b => b.type === BuildingType.DORMITORY).length;
        const newMaxPop = BASE_POPULATION + (dormCount * POPULATION_PER_HABITAT);

        return {
            ...prev,
            credits: prev.credits - cost,
            buildings: newBuildings,
            maxPopulation: newMaxPop
        };
    });
  };

  const handleSelectSlot = (slotId: number) => {
      setSelectedSlot(slotId);
      const slot = gameState.buildings.find(b => b.id === slotId);
      if (slot) {
          // Rotate to put this slot at top (0 degrees)
          // Current Rotation + Slot Angle = 0 => Target = -Slot Angle
          setGameState(prev => ({
              ...prev,
              targetRotation: -slot.angle
          }));
      }
  };

  const handleManualRotate = (val: number | ((prev: number) => number)) => {
      setGameState(p => ({
          ...p, 
          targetRotation: null, // Cancel auto-rotate on manual input
          rotation: typeof val === 'function' ? val(p.rotation) : val
      }));
  };

  // --- The Game Loop ---

  const tick = useCallback(() => {
    setGameState(prev => {
      const now = Date.now();
      const dt = Math.min((now - prev.lastTick) / 1000, 0.1); 
      
      let newCredits = prev.credits;
      let newSurfaceOre = prev.surfaceOre;
      let newTotalMined = prev.totalMined;
      let newDepth = prev.mineDepth;
      let newRotation = prev.rotation;

      // Handle Auto-Rotation
      if (prev.targetRotation !== null) {
          // Shortest path rotation
          let diff = prev.targetRotation - prev.rotation;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          
          if (Math.abs(diff) < 0.5) {
              newRotation = prev.targetRotation;
              // Don't clear targetRotation here, keeps it locked until user moves
          } else {
              newRotation += diff * 5 * dt; // Lerp speed
          }
      }

      // Helper to find nearest Dorm
      const getNearestDormAngle = (currentAngle: number) => {
          const dorms = prev.buildings.filter(b => b.type === BuildingType.DORMITORY);
          if (dorms.length === 0) return MINE_ANGLE; // Fallback
          
          // Find closest
          let closest = dorms[0];
          let minDiff = 360;
          
          dorms.forEach(d => {
              let diff = Math.abs(d.angle - currentAngle);
              if (diff > 180) diff = 360 - diff;
              if (diff < minDiff) {
                  minDiff = diff;
                  closest = d;
              }
          });
          return closest.angle;
      };

      // Update Units
      const newUnits = prev.units.map(unit => {
        const u = { ...unit };
        const isFlying = u.type === UnitType.CARRIER_DRONE;
        
        // Energy Consumption
        if (u.state !== 'CHARGING' && u.state !== 'IDLE') {
            u.energy -= ENERGY_DRAIN_RATE * dt;
        }

        // Low Energy Interrupt
        // If energy is empty, abort current task and go home.
        // Note: We allow them to finish depositing if they are already doing it, or if they have ore we prioritize dropping it off?
        // For simplicity, if energy is 0, they MUST recharge. If they have ore, they keep it until they come back.
        if (u.energy <= 0 && u.state !== 'CHARGING' && u.state !== 'MOVING_TO_HOME') {
            u.state = 'MOVING_TO_HOME';
        }

        // Movement Logic
        const moveTowardsAngle = (targetAngle: number, stopRadius = 0.5) => {
            let diff = targetAngle - u.position.angle;
            while (diff > 180) diff -= 360;
            while (diff < -180) diff += 360;

            if (Math.abs(diff) < stopRadius) return true;
            u.position.angle += (diff > 0 ? 1 : -1) * u.speed * 15 * dt;
            return false;
        };

        const moveTowardsRadius = (targetRadius: number, stopDist = 5) => {
             const diff = targetRadius - u.position.radius;
             if (Math.abs(diff) < stopDist) return true;
             u.position.radius += (diff > 0 ? 1 : -1) * u.speed * 30 * dt;
             return false;
        };

        // State Machine
        if (u.state === 'MOVING_TO_MINE') {
            if (moveTowardsAngle(MINE_ANGLE, 1)) {
                u.state = 'ENTERING_MINE';
            }
            // Keep on surface
            if (Math.abs(u.position.radius - SURFACE_LEVEL) > 2) {
                 u.position.radius += (SURFACE_LEVEL - u.position.radius) * 5 * dt;
            }
        }
        else if (u.state === 'ENTERING_MINE') {
            // Descend to current depth
            // Max visual depth cap at 300px
            const visualDepth = Math.min(newDepth * 1.5, 300);
            const targetR = SURFACE_LEVEL - 20 - visualDepth;

            if (moveTowardsRadius(targetR)) {
                u.state = 'MINING';
                u.progress = 0;
            }
            u.position.angle = MINE_ANGLE + Math.sin(now/300 + parseInt(u.id, 36)) * 1.5;
        }
        else if (u.state === 'MINING') {
            const toughness = 1 + (newDepth * 0.05); 
            const miningRate = u.miningPower / toughness;
            
            u.progress += dt * miningRate;
            
            if (u.progress >= 1) {
                u.inventory = u.maxCapacity;
                u.state = 'EXITING_MINE';
            }
        }
        else if (u.state === 'EXITING_MINE') {
            if (moveTowardsRadius(SURFACE_LEVEL)) {
                u.state = 'MOVING_TO_PILE';
            }
             u.position.angle = MINE_ANGLE + Math.sin(now/300 + parseInt(u.id, 36)) * 1.5;
        }
        else if (u.state === 'MOVING_TO_PILE') {
            const heightOffset = isFlying ? 25 : 0;
            u.position.radius = SURFACE_LEVEL + heightOffset;

            if (moveTowardsAngle(PILE_ANGLE, 2)) {
                u.state = 'DEPOSITING';
                u.progress = 0;
            }
        }
        else if (u.state === 'DEPOSITING') {
            u.progress += dt * 5; 
            if (u.progress >= 1) {
                newSurfaceOre += u.inventory;
                newTotalMined += u.inventory;
                newDepth = Math.floor(newTotalMined / 100); 
                u.inventory = 0;
                u.targetDepth = newDepth;
                
                // If energy low after deposit, go home, else mine
                if (u.energy < u.maxEnergy * 0.2) {
                    u.state = 'MOVING_TO_HOME';
                } else {
                    u.state = 'MOVING_TO_MINE';
                }
            }
        }
        else if (u.state === 'MOVING_TO_HOME') {
            // First, ensure we are on surface if we were in the hole
            if (u.position.radius < SURFACE_LEVEL) {
                moveTowardsRadius(SURFACE_LEVEL);
                u.position.angle = MINE_ANGLE + Math.sin(now/300 + parseInt(u.id, 36)) * 1.5;
            } else {
                // We are on surface, go to habitat
                const target = getNearestDormAngle(u.position.angle);
                if (moveTowardsAngle(target, 1)) {
                    u.state = 'CHARGING';
                }
            }
        }
        else if (u.state === 'CHARGING') {
            u.energy += ENERGY_RECHARGE_RATE * dt;
            if (u.energy >= u.maxEnergy) {
                u.energy = u.maxEnergy;
                // Return to work
                if (u.inventory > 0) u.state = 'MOVING_TO_PILE';
                else u.state = 'MOVING_TO_MINE';
            }
        }

        return u;
      });

      // Crusher Logic
      if (newSurfaceOre > 0) {
          const crushAmount = Math.min(newSurfaceOre, BASE_CRUSHER_RATE * dt);
          newSurfaceOre -= crushAmount;
          newCredits += crushAmount * ORE_VALUE;
      }

      // Aux Crushers
      const auxCrushers = prev.buildings.filter(b => b.type === BuildingType.CRUSHER).length;
      if (auxCrushers > 0 && newSurfaceOre > 0) {
          const extraCrush = Math.min(newSurfaceOre, auxCrushers * 15 * dt);
          newSurfaceOre -= extraCrush;
          newCredits += extraCrush * ORE_VALUE;
      }

      return {
        ...prev,
        credits: newCredits,
        surfaceOre: Math.max(0, newSurfaceOre),
        totalMined: newTotalMined,
        mineDepth: newDepth,
        units: newUnits,
        lastTick: now,
        rotation: newRotation
      };
    });

    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [tick]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <AsteroidCanvas 
        gameState={gameState} 
        setRotation={handleManualRotate}
        onSelectSlot={handleSelectSlot}
      />
      <Overlay 
        gameState={gameState} 
        onBuyUnit={spawnUnit}
        selectedSlotId={selectedSlot}
        onBuild={constructBuilding}
        onCloseBuildMenu={() => setSelectedSlot(null)}
      />
    </div>
  );
};

export default App;
