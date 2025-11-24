

import React, { useState, useEffect, useCallback } from 'react';
import AsteroidCanvas from './components/AsteroidCanvas';
import Overlay from './components/Overlay';
import { GameState, UnitType, BuildingType, Entity, SURFACE_LEVEL, MINE_ANGLE, PILE_ANGLE, BuildingSlot, BuildingStatus } from './types';
import { UNIT_STATS, ORE_VALUE, INITIAL_SLOTS, BUILDING_COSTS, BASE_CRUSHER_RATE, BASE_POPULATION, POPULATION_PER_HABITAT, ENERGY_DRAIN_RATE, ENERGY_RECHARGE_RATE, BUILD_SPEED_BASE, COST_SCALING_FACTOR, DRILL_WEIGHT_SPEED_PENALTY, DRILL_PRODUCTION_RATE, UPGRADE_COSTS, CRUSHER_WORKER_BONUS } from './constants';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    credits: 10,
    surfaceOre: 0,
    looseOreInMine: 0,
    totalMined: 0,
    mineDepth: 0, // Starts at 0 visually
    maxPopulation: BASE_POPULATION,
    units: [],
    buildings: INITIAL_SLOTS as BuildingSlot[],
    lastTick: Date.now(),
    rotation: 0,
    targetRotation: null
  });

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Helper to create IDs
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // --- Helper: Calculate Cost ---
  const getUnitCost = (type: UnitType, currentUnits: Entity[]) => {
      const count = currentUnits.filter(u => u.type === type).length;
      const base = UNIT_STATS[type].cost;
      return Math.floor(base * Math.pow(COST_SCALING_FACTOR, count));
  };

  // --- Game Logic ---

  const spawnUnit = (type: UnitType) => {
    const cost = getUnitCost(type, gameState.units);
    if (gameState.credits < cost) return;

    let spawnAngle = MINE_ANGLE;
    let homeId: number | null = null;

    const stats = UNIT_STATS[type];
    
    // Logic: Find Home
    if (stats.isTool) {
        // Drills spawn at Workshop
        const workshop = gameState.buildings.find(b => b.type === BuildingType.WORKSHOP && b.status === 'COMPLETED');
        if (!workshop) return; // Needs workshop
        spawnAngle = workshop.angle;
    } else {
        // Miners/Carriers need a Habitat
        // Find first habitat with < 5 occupants
        const availableHabitat = gameState.buildings.find(b => 
            b.type === BuildingType.DORMITORY && 
            b.status === 'COMPLETED' && 
            b.occupants.length < POPULATION_PER_HABITAT
        );

        if (!availableHabitat) return; // No room
        
        homeId = availableHabitat.id;
        spawnAngle = availableHabitat.angle;
    }

    const newUnit: Entity = {
      id: generateId(),
      type,
      state: 'IDLE', 
      position: { x: 0, y: 0, angle: spawnAngle, radius: SURFACE_LEVEL },
      targetDepth: gameState.mineDepth,
      inventory: 0,
      maxCapacity: stats.capacity,
      energy: stats.maxEnergy,
      maxEnergy: stats.maxEnergy,
      speed: stats.speed,
      miningPower: stats.power,
      progress: 0,
      homeBuildingId: homeId,
      carryingId: null,
      carriedBy: null,
      workingAtBuildingId: null
    };

    setGameState(prev => {
        // Update building occupancy if it's a unit
        const newBuildings = prev.buildings.map(b => {
            if (b.id === homeId) {
                return { ...b, occupants: [...b.occupants, newUnit.id] };
            }
            return b;
        });

        return {
            ...prev,
            credits: prev.credits - cost,
            units: [...prev.units, newUnit],
            buildings: newBuildings
        };
    });
  };

  const constructBuilding = (slotId: number, type: BuildingType) => {
    const existingDorms = gameState.buildings.filter(b => b.type === BuildingType.DORMITORY).length;
    const isFreeHabitat = type === BuildingType.DORMITORY && existingDorms === 0;
    const cost = isFreeHabitat ? 0 : BUILDING_COSTS[type].baseCost;

    if (gameState.credits < cost) return;

    setGameState(prev => {
        const newBuildings = prev.buildings.map(b => {
          if (b.id !== slotId) return b;
          return { 
            ...b, 
            type, 
            level: 1,
            status: (isFreeHabitat ? 'COMPLETED' : 'PENDING') as BuildingStatus,
            constructionProgress: isFreeHabitat ? 1 : 0,
            assignedUnitId: null,
            occupants: [],
            maxWorkers: 0,
            assignedWorkers: [],
            workersEnabled: false
          };
        });
        
        return {
            ...prev,
            credits: prev.credits - cost,
            buildings: newBuildings
        };
    });
  };

  const upgradeBuilding = (slotId: number) => {
      const slot = gameState.buildings.find(b => b.id === slotId);
      if (!slot || !slot.type) return;
      
      const cost = UPGRADE_COSTS[slot.type] * slot.level;
      if (gameState.credits < cost) return;

      setGameState(prev => {
          const newBuildings = prev.buildings.map(b => {
              if (b.id !== slotId) return b;
              
              // Define upgrade effects
              let newMaxWorkers = b.maxWorkers;
              if (b.type === BuildingType.CRUSHER && b.level === 1) {
                  newMaxWorkers = 1; // Level 2 unlock worker slot
              }

              return {
                  ...b,
                  level: b.level + 1,
                  maxWorkers: newMaxWorkers
              };
          });

          return {
              ...prev,
              credits: prev.credits - cost,
              buildings: newBuildings
          };
      });
  };

  const toggleBuildingWorkers = (slotId: number) => {
      setGameState(prev => {
          const newBuildings = prev.buildings.map(b => {
              if (b.id !== slotId) return b;
              return { ...b, workersEnabled: !b.workersEnabled };
          });
          return { ...prev, buildings: newBuildings };
      });
  };

  const handleSelectSlot = (slotId: number) => {
      setSelectedSlot(slotId);
      const slot = gameState.buildings.find(b => b.id === slotId);
      if (slot) {
          setGameState(prev => ({
              ...prev,
              targetRotation: -slot.angle
          }));
      }
  };

  const handleManualRotate = (val: number | ((prev: number) => number)) => {
      setGameState(p => ({
          ...p, 
          targetRotation: null, 
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
      let newLooseOreInMine = prev.looseOreInMine;
      let newTotalMined = prev.totalMined;
      let newDepth = prev.mineDepth;
      let newRotation = prev.rotation;

      const newBuildings = prev.buildings.map(b => ({ ...b }));

      // Auto-Rotation
      if (prev.targetRotation !== null) {
          let diff = prev.targetRotation - prev.rotation;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          if (Math.abs(diff) < 0.5) newRotation = prev.targetRotation;
          else newRotation += diff * 5 * dt; 
      }

      // Calculate Max Pop
      const dorms = newBuildings.filter(b => b.type === BuildingType.DORMITORY && b.status === 'COMPLETED');
      const newMaxPop = BASE_POPULATION + (dorms.length * POPULATION_PER_HABITAT);

      // Helper: Movement
      const moveUnit = (u: Entity, targetAngle: number, targetRadius: number, speedMult = 1) => {
         let arrivedAngle = false;
         let arrivedRadius = false;

         // Angle
         let diff = targetAngle - u.position.angle;
         while (diff > 180) diff -= 360;
         while (diff < -180) diff += 360;
         if (Math.abs(diff) < 0.5) {
             arrivedAngle = true;
         } else {
             u.position.angle += (diff > 0 ? 1 : -1) * u.speed * speedMult * 15 * dt;
         }

         // Radius
         const radDiff = targetRadius - u.position.radius;
         if (Math.abs(radDiff) < 2) {
             arrivedRadius = true;
         } else {
             u.position.radius += (radDiff > 0 ? 1 : -1) * u.speed * speedMult * 30 * dt;
         }

         return arrivedAngle && arrivedRadius;
      };

      // Helper: Find Job
      const assignJob = (u: Entity) => {
          // 1. Construction
          const buildJob = newBuildings.find(b => (b.status === 'PENDING' || b.status === 'UNDER_CONSTRUCTION') && b.assignedUnitId === null);
          if (buildJob) {
              buildJob.assignedUnitId = u.id;
              if (buildJob.status === 'PENDING') buildJob.status = 'UNDER_CONSTRUCTION';
              u.state = 'MOVING_TO_BUILD';
              return;
          }

          // 2. Work in Building (if enabled)
          const workJob = newBuildings.find(b => 
              b.status === 'COMPLETED' && 
              b.workersEnabled && 
              b.assignedWorkers.length < b.maxWorkers
          );
          if (workJob) {
              workJob.assignedWorkers.push(u.id);
              u.workingAtBuildingId = workJob.id;
              u.state = 'MOVING_TO_WORK';
              return;
          }

          // 3. Unattended Drill (If not a carrier drone)
          // Find a drill that is IDLE (not carried, not operating)
          const idleDrill = prev.units.find(d => d.type === UnitType.MINER_DRILL && d.state === 'IDLE' && d.carriedBy === null);
          if (idleDrill) {
              u.state = 'MOVING_TO_DRILL';
              return;
          }

          // 4. Haul Loose Ore
          // If there's a lot of loose ore, prioritize picking it up
          if (newLooseOreInMine > 10) {
              u.state = 'PICKUP_LOOSE_ORE'; 
              return;
          }

          // 5. Manual Mining (Default)
          u.state = 'MOVING_TO_MINE';
      };

      // --- UNIT LOOP ---
      // We map over existing units
      const newUnits = prev.units.map(unit => {
          const u = { ...unit };
          
          // --- TOOL/DRILL LOGIC ---
          // If this is a Drill/Tool, it doesn't think. It just exists.
          if (UNIT_STATS[u.type].isTool) {
             if (u.carriedBy) {
                 // Update position to follow carrier
                 const carrier = prev.units.find(c => c.id === u.carriedBy);
                 if (carrier) {
                     u.position = { ...carrier.position };
                     u.state = 'IDLE'; // Being carried
                 } else {
                     u.carriedBy = null; // Carrier disappeared?
                 }
             }
             // If Operating, generate ore
             if (u.state === 'OPERATING_DRILL') {
                 const produced = DRILL_PRODUCTION_RATE * dt;
                 newLooseOreInMine += produced;
                 newTotalMined += produced;
                 newDepth = Math.floor(newTotalMined / 100);
             }
             return u; 
          }

          // --- MINER/WORKER LOGIC ---

          // Energy Drain
          if (u.state !== 'CHARGING' && u.state !== 'IDLE' && u.homeBuildingId) {
              const drainMult = u.carryingId ? 1.5 : 1;
              u.energy -= ENERGY_DRAIN_RATE * drainMult * dt;
          }

          // Critical Energy Logic
          if (u.energy <= 0 && u.state !== 'CHARGING' && u.state !== 'MOVING_TO_HOME') {
              // Drop everything
              u.carryingId = null; 
              
              // Drop construction job
              const job = newBuildings.find(b => b.assignedUnitId === u.id);
              if (job) job.assignedUnitId = null;

              // Drop Building Work
              if (u.workingAtBuildingId) {
                  const b = newBuildings.find(bd => bd.id === u.workingAtBuildingId);
                  if (b) {
                      b.assignedWorkers = b.assignedWorkers.filter(id => id !== u.id);
                  }
                  u.workingAtBuildingId = null;
              }

              u.state = 'MOVING_TO_HOME';
          }

          // State Machine
          switch (u.state) {
              case 'IDLE':
                  assignJob(u);
                  break;

              case 'MOVING_TO_HOME':
                  const home = newBuildings.find(b => b.id === u.homeBuildingId);
                  const homeAngle = home ? home.angle : MINE_ANGLE;
                  
                  // Check if we are effectively on the surface (tolerance 3px)
                  const isOnSurface = Math.abs(u.position.radius - SURFACE_LEVEL) < 3;

                  if (!isOnSurface && u.position.radius < SURFACE_LEVEL) {
                      // We are in the mine, climb out
                      u.position.angle = MINE_ANGLE; // Center in shaft while climbing
                      moveUnit(u, MINE_ANGLE, SURFACE_LEVEL);
                  } else {
                      // We are out, ensure we are snapped to surface to prevent glitches
                      u.position.radius = SURFACE_LEVEL;
                      
                      if (moveUnit(u, homeAngle, SURFACE_LEVEL)) {
                          u.state = 'CHARGING';
                          u.carryingId = null; // Ensure drill is dropped
                          u.workingAtBuildingId = null;
                      }
                  }
                  break;

              case 'CHARGING':
                  u.energy += ENERGY_RECHARGE_RATE * dt;
                  if (u.energy >= u.maxEnergy) {
                      u.energy = u.maxEnergy;
                      u.state = 'IDLE'; // Look for work
                  }
                  break;

              case 'MOVING_TO_BUILD':
                  const job = newBuildings.find(b => b.assignedUnitId === u.id);
                  if (!job || job.status === 'COMPLETED') {
                      u.state = 'IDLE';
                  } else {
                      if (moveUnit(u, job.angle, SURFACE_LEVEL)) {
                          u.state = 'BUILDING';
                      }
                  }
                  break;

              case 'BUILDING':
                  const buildJob = newBuildings.find(b => b.assignedUnitId === u.id);
                  if (!buildJob) {
                      u.state = 'IDLE';
                  } else {
                      buildJob.constructionProgress += (BUILD_SPEED_BASE * u.miningPower) * dt;
                      if (buildJob.constructionProgress >= 1) {
                          buildJob.constructionProgress = 1;
                          buildJob.status = 'COMPLETED';
                          buildJob.assignedUnitId = null;
                          buildJob.level = 1;
                          u.state = 'IDLE';
                      }
                  }
                  break;
              
              case 'MOVING_TO_WORK':
                  const workJob = newBuildings.find(b => b.id === u.workingAtBuildingId);
                  // Check if job still valid (enabled, exists)
                  if (!workJob || !workJob.workersEnabled || !workJob.assignedWorkers.includes(u.id)) {
                       u.workingAtBuildingId = null;
                       u.state = 'IDLE';
                  } else {
                       if (moveUnit(u, workJob.angle, SURFACE_LEVEL)) {
                           u.state = 'WORKING_IN_BUILDING';
                       }
                  }
                  break;

              case 'WORKING_IN_BUILDING':
                   const b = newBuildings.find(x => x.id === u.workingAtBuildingId);
                   if (!b || !b.workersEnabled || !b.assignedWorkers.includes(u.id)) {
                       u.workingAtBuildingId = null;
                       u.state = 'IDLE';
                   }
                   // Unit just stays here, draining energy. Building logic applies the bonus.
                   break;

              case 'MOVING_TO_MINE': // Intent: Manual Mine
              case 'PICKUP_LOOSE_ORE': // Intent: Grab loose ore
                  // 1. Move to Shaft Top
                  if (Math.abs(normalizeAngle(u.position.angle - MINE_ANGLE)) > 2 || Math.abs(u.position.radius - SURFACE_LEVEL) > 2) {
                      moveUnit(u, MINE_ANGLE, SURFACE_LEVEL);
                  } else {
                      u.state = 'ENTERING_MINE';
                  }
                  break;

              case 'ENTERING_MINE':
                  const visualDepth = Math.min(newDepth * 1.5, 300);
                  const targetR = SURFACE_LEVEL - 20 - visualDepth;
                  
                  // Speed penalty if carrying drill
                  const spd = u.carryingId ? DRILL_WEIGHT_SPEED_PENALTY : 1;
                  
                  if (moveUnit(u, MINE_ANGLE, targetR, spd)) {
                      // Arrived at bottom
                      if (u.carryingId) {
                          // We brought a drill down!
                          u.state = 'OPERATING_DRILL';
                      } else if (prev.units.find(un => un.id === u.id)?.state === 'PICKUP_LOOSE_ORE') {
                           // Grab loose ore logic
                           if (newLooseOreInMine > 0) {
                               const take = Math.min(u.maxCapacity, newLooseOreInMine);
                               u.inventory = take;
                               newLooseOreInMine -= take;
                               u.state = 'EXITING_MINE';
                           } else {
                               // No loose ore? Switch to mining
                               u.state = 'MINING';
                               u.progress = 0;
                           }
                      } else {
                           // Default logic
                           if (newLooseOreInMine > 5) {
                               const take = Math.min(u.maxCapacity, newLooseOreInMine);
                               u.inventory = take;
                               newLooseOreInMine -= take;
                               u.state = 'EXITING_MINE';
                           } else {
                               u.state = 'MINING';
                               u.progress = 0;
                           }
                      }
                  }
                  // Wiggle in shaft
                  u.position.angle = MINE_ANGLE + Math.sin(now/300 + parseInt(u.id, 36)) * 1.5;
                  break;

              case 'MINING': // Manual Mining
                  const toughness = 1 + (newDepth * 0.05); 
                  u.progress += (u.miningPower / toughness) * dt;
                  if (u.progress >= 1) {
                      u.inventory = u.maxCapacity;
                      // THIS is where manual mining increases depth
                      newTotalMined += 1; // 1 unit of earth removed (visual scaling)
                      newDepth = Math.floor(newTotalMined / 100);
                      u.state = 'EXITING_MINE';
                  }
                  break;

              case 'OPERATING_DRILL':
                  // Just wait here until energy runs out. 
                  // The DRILL entity (handled above) produces the ore.
                  u.position.angle = MINE_ANGLE + Math.sin(now/50) * 1;
                  break;

              case 'EXITING_MINE':
                  if (moveUnit(u, MINE_ANGLE, SURFACE_LEVEL)) {
                      u.state = 'MOVING_TO_PILE';
                  }
                  break;

              case 'MOVING_TO_PILE':
                  if (moveUnit(u, PILE_ANGLE, SURFACE_LEVEL)) {
                      u.state = 'DEPOSITING';
                      u.progress = 0;
                  }
                  break;

              case 'DEPOSITING':
                  u.progress += dt * 5;
                  if (u.progress >= 1) {
                      newSurfaceOre += u.inventory;
                      u.inventory = 0;
                      u.targetDepth = newDepth;
                      u.state = 'IDLE';
                  }
                  break;

              case 'MOVING_TO_DRILL':
                   // Find the drill again
                   const targetDrill = prev.units.find(d => d.type === UnitType.MINER_DRILL && d.state === 'IDLE' && !d.carriedBy);
                   if (!targetDrill) {
                       u.state = 'IDLE'; // Drill taken or gone
                   } else {
                       const isNear = moveUnit(u, targetDrill.position.angle, targetDrill.position.radius);
                       if (isNear) {
                           u.carryingId = targetDrill.id;
                           // FIX: Don't teleport to mine. Switch to CARRYING state.
                           u.state = 'CARRYING_DRILL_TO_MINE'; 
                       }
                   }
                   break;
              
              case 'CARRYING_DRILL_TO_MINE':
                  // Move to Shaft Top with drill
                  if (Math.abs(normalizeAngle(u.position.angle - MINE_ANGLE)) > 2 || Math.abs(u.position.radius - SURFACE_LEVEL) > 2) {
                      moveUnit(u, MINE_ANGLE, SURFACE_LEVEL, DRILL_WEIGHT_SPEED_PENALTY);
                  } else {
                      u.state = 'ENTERING_MINE';
                  }
                  break;
          }

          return u;
      });

      // --- SECONDARY PASS: SYNC DRILLS AND CARRIERS ---
      const syncedUnits = newUnits.map(u => {
          if (UNIT_STATS[u.type].isTool) {
              // Find who is carrying me (in the NEW state)
              const carrier = newUnits.find(m => m.carryingId === u.id);
              if (carrier) {
                  u.carriedBy = carrier.id;
                  u.position = { ...carrier.position };
                  if (carrier.state === 'OPERATING_DRILL') u.state = 'OPERATING_DRILL';
                  else u.state = 'IDLE'; // Just being carried
              } else {
                  // Dropped
                  u.carriedBy = null;
                  u.state = 'IDLE'; 
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

      // Aux Crushers & Workers
      const crusherBuildings = newBuildings.filter(b => b.type === BuildingType.CRUSHER && b.status === 'COMPLETED');
      if (crusherBuildings.length > 0 && newSurfaceOre > 0) {
          let totalBonus = 0;
          crusherBuildings.forEach(cb => {
              // Base rate per crusher
              totalBonus += 15; 
              // Worker bonus
              const workers = newUnits.filter(u => u.workingAtBuildingId === cb.id && u.state === 'WORKING_IN_BUILDING').length;
              totalBonus += workers * CRUSHER_WORKER_BONUS;
          });

          const extraCrush = Math.min(newSurfaceOre, totalBonus * dt);
          newSurfaceOre -= extraCrush;
          newCredits += extraCrush * ORE_VALUE;
      }

      return {
        ...prev,
        credits: newCredits,
        surfaceOre: Math.max(0, newSurfaceOre),
        looseOreInMine: Math.max(0, newLooseOreInMine),
        totalMined: newTotalMined,
        mineDepth: newDepth,
        maxPopulation: newMaxPop,
        units: syncedUnits,
        buildings: newBuildings,
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

  // Normalize Angle helper for logic usage outside canvas
  const normalizeAngle = (angle: number) => {
    let a = angle % 360;
    while (a > 180) a -= 360;
    while (a <= -180) a += 360;
    return a;
  };

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
        onUpgradeBuilding={upgradeBuilding}
        onToggleWorkers={toggleBuildingWorkers}
      />
    </div>
  );
};

export default App;
