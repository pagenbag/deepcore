
import React, { useState, useEffect, useCallback } from 'react';
import AsteroidCanvas from './components/AsteroidCanvas';
import Overlay from './components/Overlay';
import { GameState, UnitType, BuildingType, Entity, SURFACE_LEVEL, MINE_ANGLE, PILE_ANGLE, BuildingSlot, BuildingStatus } from './types';
import { UNIT_STATS, ORE_VALUE, INITIAL_SLOTS, BUILDING_COSTS, BASE_POPULATION, POPULATION_PER_HABITAT, ENERGY_DRAIN_RATE, ENERGY_RECHARGE_RATE, BUILD_SPEED_BASE, COST_SCALING_FACTOR, DRILL_WEIGHT_SPEED_PENALTY, DRILL_PRODUCTION_RATE, BUILDING_UPGRADES, CRUSHER_WORKER_BONUS, TAX_INTERVAL, TAX_INITIAL_AMOUNT, TAX_SCALE } from './constants';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    credits: 10000,
    surfaceOre: 0,
    looseOreInMine: 0,
    totalMined: 0,
    mineDepth: 0, // Starts at 0 visually
    maxPopulation: BASE_POPULATION,
    units: [],
    buildings: INITIAL_SLOTS as BuildingSlot[],
    lastTick: Date.now(),
    rotation: 0,
    targetRotation: null,
    taxTimer: Date.now() + TAX_INTERVAL,
    taxAmount: TAX_INITIAL_AMOUNT,
    taxDue: false
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
    if (gameState.taxDue) return; // Blocked by tax

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
    if (gameState.taxDue) return; // Blocked by tax

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
            requestedWorkers: 0,
            upgrades: []
          };
        });
        
        return {
            ...prev,
            credits: prev.credits - cost,
            buildings: newBuildings
        };
    });
  };

  const purchaseUpgrade = (slotId: number, upgradeId: string) => {
      if (gameState.taxDue) return; // Blocked by tax

      const slot = gameState.buildings.find(b => b.id === slotId);
      if (!slot || !slot.type) return;

      const upgradesList = BUILDING_UPGRADES[slot.type] || [];
      const upgrade = upgradesList.find(u => u.id === upgradeId);
      if (!upgrade) return;

      if (gameState.credits < upgrade.cost) return;

      setGameState(prev => {
          const newBuildings = prev.buildings.map(b => {
              if (b.id !== slotId) return b;
              
              const newUpgrades = [...b.upgrades, upgradeId];
              let newMaxWorkers = b.maxWorkers;
              let newLevel = b.level;
              
              // Apply Effects
              if (upgrade.effect?.maxWorkersAdd) {
                  newMaxWorkers += upgrade.effect.maxWorkersAdd;
              }
              // Just generic level up for visuals
              newLevel += 1;

              return {
                  ...b,
                  upgrades: newUpgrades,
                  maxWorkers: newMaxWorkers,
                  level: newLevel
              };
          });

          return {
              ...prev,
              credits: prev.credits - upgrade.cost,
              buildings: newBuildings
          };
      });
  };

  const toggleWorkerSlot = (slotId: number, targetCount: number) => {
      setGameState(prev => {
          const newBuildings = prev.buildings.map(b => {
              if (b.id !== slotId) return b;
              // Ensure we don't exceed max
              const validCount = Math.max(0, Math.min(targetCount, b.maxWorkers));
              return { ...b, requestedWorkers: validCount };
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
      let newTaxTimer = prev.taxTimer;
      let newTaxAmount = prev.taxAmount;
      let newTaxDue = prev.taxDue;

      // Tax Logic
      if (!newTaxDue) {
          if (now >= newTaxTimer) {
              newTaxDue = true;
          }
      }
      if (newTaxDue) {
          if (newCredits >= newTaxAmount) {
              newCredits -= newTaxAmount;
              newTaxDue = false;
              newTaxAmount = Math.floor(newTaxAmount * TAX_SCALE);
              newTaxTimer = now + TAX_INTERVAL;
          }
      }

      const newBuildings = prev.buildings.map(b => ({ ...b }));

      // Auto-Rotation
      if (prev.targetRotation !== null) {
          let diff = prev.targetRotation - prev.rotation;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          if (Math.abs(diff) < 0.5) newRotation = prev.targetRotation;
          else newRotation += diff * 5 * dt; 
      }

      // Calculate Max Pop (Including Upgrades)
      const dorms = newBuildings.filter(b => b.type === BuildingType.DORMITORY && b.status === 'COMPLETED');
      let calculatedMaxPop = BASE_POPULATION;
      dorms.forEach(d => {
          calculatedMaxPop += POPULATION_PER_HABITAT;
          // Check upgrades for extra pop
          if (d.upgrades) {
             d.upgrades.forEach(uId => {
                 const upg = BUILDING_UPGRADES[BuildingType.DORMITORY].find(x => x.id === uId);
                 if (upg?.effect?.maxPopAdd) calculatedMaxPop += upg.effect.maxPopAdd;
             });
          }
      });

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
              b.requestedWorkers > 0 &&
              b.assignedWorkers.length < b.requestedWorkers
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

      // --- PRIMARY UNIT LOOP ---

      // Step 0: Carrier <-> Tool Handshake
      // Ensure that if a Carrier has a carryingId, the Tool knows it is carriedBy that Carrier.
      const carrierMap = new Map<string, string>(); // ToolID -> CarrierID
      prev.units.forEach(u => {
          if (u.carryingId) carrierMap.set(u.carryingId, u.id);
      });

      const syncedUnits = prev.units.map(unit => {
          const u = { ...unit };
          // If I am a tool and someone claims to carry me, update my state
          if (carrierMap.has(u.id)) {
              u.carriedBy = carrierMap.get(u.id)!;
          }
          // If I am a carrier, but my tool doesn't exist anymore (bug safety), clear it
          if (u.carryingId && !prev.units.find(t => t.id === u.carryingId)) {
              u.carryingId = null;
          }
          return u;
      });

      // Step 1: Pre-process Position Sync
      const preProcessedUnits = syncedUnits.map(unit => {
          const u = { ...unit };
          // If this is a tool, sync it with its carrier immediately
          if (UNIT_STATS[u.type].isTool) {
             if (u.carriedBy) {
                const carrier = syncedUnits.find(c => c.id === u.carriedBy);
                if (carrier) {
                    u.position = { ...carrier.position };
                    if (carrier.state === 'OPERATING_DRILL') u.state = 'OPERATING_DRILL';
                    else u.state = 'IDLE'; // Just being carried
                } else {
                    u.carriedBy = null; // Carrier lost
                    u.state = 'IDLE';
                }
             } else {
                 u.carriedBy = null;
                 u.state = 'IDLE';
             }
          }
          return u;
      });

      const newUnits = preProcessedUnits.map(unit => {
          const u = { ...unit };
          
          // --- TOOL/DRILL LOGIC ---
          if (UNIT_STATS[u.type].isTool) {
             // If Operating, generate ore
             // Note: State was synced in pre-process, so this is current
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
              if (u.workingAtBuildingId !== null) {
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
                  const isOnSurface = Math.abs(u.position.radius - SURFACE_LEVEL) < 3;

                  if (!isOnSurface && u.position.radius < SURFACE_LEVEL) {
                      u.position.angle = MINE_ANGLE; 
                      moveUnit(u, MINE_ANGLE, SURFACE_LEVEL);
                  } else {
                      u.position.radius = SURFACE_LEVEL;
                      if (moveUnit(u, homeAngle, SURFACE_LEVEL)) {
                          u.state = 'CHARGING';
                          u.carryingId = null; 
                          u.workingAtBuildingId = null;
                      }
                  }
                  break;

              case 'CHARGING':
                  u.energy += ENERGY_RECHARGE_RATE * dt;
                  if (u.energy >= u.maxEnergy) {
                      u.energy = u.maxEnergy;
                      u.state = 'IDLE'; 
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
                  if (!workJob || workJob.requestedWorkers === 0 || !workJob.assignedWorkers.includes(u.id)) {
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
                   if (!b || !b.assignedWorkers.includes(u.id)) {
                       u.workingAtBuildingId = null;
                       u.state = 'IDLE';
                   }
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
                  const spd = u.carryingId ? DRILL_WEIGHT_SPEED_PENALTY : 1;
                  
                  if (moveUnit(u, MINE_ANGLE, targetR, spd)) {
                      // Arrived at bottom
                      if (u.carryingId) {
                          u.state = 'OPERATING_DRILL';
                      } else if (prev.units.find(un => un.id === u.id)?.state === 'PICKUP_LOOSE_ORE') {
                           if (newLooseOreInMine > 0) {
                               const take = Math.min(u.maxCapacity, newLooseOreInMine);
                               u.inventory = take;
                               newLooseOreInMine -= take;
                               u.state = 'EXITING_MINE';
                           } else {
                               u.state = 'MINING';
                               u.progress = 0;
                           }
                      } else {
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
                  u.position.angle = MINE_ANGLE + Math.sin(now/300 + parseInt(u.id, 36)) * 1.5;
                  break;

              case 'MINING': 
                  const toughness = 1 + (newDepth * 0.05); 
                  u.progress += (u.miningPower / toughness) * dt;
                  if (u.progress >= 1) {
                      u.inventory = u.maxCapacity;
                      newTotalMined += 1; 
                      newDepth = Math.floor(newTotalMined / 100);
                      u.state = 'EXITING_MINE';
                  }
                  break;

              case 'OPERATING_DRILL':
                  // Carrier just stands here. The Drill produces ore in its own loop pass.
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
                   const targetDrill = prev.units.find(d => d.type === UnitType.MINER_DRILL && d.state === 'IDLE' && !d.carriedBy);
                   if (!targetDrill) {
                       u.state = 'IDLE'; 
                   } else {
                       const isNear = moveUnit(u, targetDrill.position.angle, targetDrill.position.radius);
                       if (isNear) {
                           u.carryingId = targetDrill.id;
                           // Note: We don't set targetDrill.carriedBy here because we can't mutate other units in map.
                           // The 'syncedUnits' step at start of next tick will handle the handshake.
                           u.state = 'CARRYING_DRILL_TO_MINE'; 
                       }
                   }
                   break;
              
              case 'CARRYING_DRILL_TO_MINE':
                  if (Math.abs(normalizeAngle(u.position.angle - MINE_ANGLE)) > 2 || Math.abs(u.position.radius - SURFACE_LEVEL) > 2) {
                      moveUnit(u, MINE_ANGLE, SURFACE_LEVEL, DRILL_WEIGHT_SPEED_PENALTY);
                  } else {
                      u.state = 'ENTERING_MINE';
                  }
                  break;
          }

          return u;
      });

      
      // Aux Crushers & Workers
      const crusherBuildings = newBuildings.filter(b => b.type === BuildingType.CRUSHER && b.status === 'COMPLETED');
      if (crusherBuildings.length > 0 && newSurfaceOre > 0) {
          let totalBonus = 0;
          crusherBuildings.forEach(cb => {
              // Base rate
              totalBonus += 15; 
              // Worker bonus
              const workers = newUnits.filter(u => u.workingAtBuildingId === cb.id && u.state === 'WORKING_IN_BUILDING');
              workers.forEach(w => {
                  const efficiency = w.energy / w.maxEnergy; // Efficiency based on energy
                  totalBonus += CRUSHER_WORKER_BONUS * efficiency;
              });
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
        maxPopulation: calculatedMaxPop,
        units: newUnits,
        buildings: newBuildings,
        lastTick: now,
        rotation: newRotation,
        taxTimer: newTaxTimer,
        taxAmount: newTaxAmount,
        taxDue: newTaxDue
      };
    });

    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [tick]);

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
        onPurchaseUpgrade={purchaseUpgrade}
        onToggleWorkerSlot={toggleWorkerSlot}
      />
    </div>
  );
};

export default App;
