
import React, { useState, useEffect, useCallback } from 'react';
import AsteroidCanvas from './components/AsteroidCanvas';
import Overlay from './components/Overlay';
import { GameState, UnitType, BuildingType, Entity, SURFACE_LEVEL, MINE_ANGLE, PILE_ANGLE, BuildingSlot, BuildingStatus } from './types';
import { UNIT_STATS, ORE_VALUE, INITIAL_SLOTS, BUILDING_COSTS, BASE_POPULATION, POPULATION_PER_HABITAT, ENERGY_DRAIN_RATE, ENERGY_RECHARGE_RATE, BUILD_SPEED_BASE, COST_SCALING_FACTOR, DRILL_WEIGHT_SPEED_PENALTY, DRILL_PRODUCTION_RATE, BUILDING_UPGRADES, CRUSHER_WORKER_BONUS, TAX_INTERVAL, TAX_INITIAL_AMOUNT, TAX_SCALE, TUNNEL_DEFINITIONS } from './constants';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    credits: 10000,
    miningPermits: 0,
    surfaceOre: 0,
    looseOreInMine: 0,
    totalMined: 0,
    mineDepth: 0, // Starts at 0 visually
    tunnelLengths: TUNNEL_DEFINITIONS.map(() => 10), // Start with 10px nubs
    maxPopulation: BASE_POPULATION,
    units: [],
    buildings: INITIAL_SLOTS as BuildingSlot[],
    lastTick: Date.now(),
    rotation: 0,
    targetRotation: null,
    taxTimer: Date.now() + TAX_INTERVAL,
    taxAmount: TAX_INITIAL_AMOUNT,
    taxDue: false,
    lastTaxPaid: 0,
    globalMultiplier: 1,
    unitUpgrades: { speedLevel: 0, capacityLevel: 0, energyLevel: 0 }
  });

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Helper to create IDs
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // --- Helper: Calculate Cost ---
  const getUnitCost = (type: UnitType, currentUnits: Entity[]) => {
      const count = currentUnits.filter(u => u.type === type).length;
      const base = UNIT_STATS[type].cost;
      return Math.floor(base * Math.pow(COST_SCALING_FACTOR, count));
  };

  // --- Helper: Get Effective Unit Stats (Applying Global Upgrades) ---
  const getEffectiveStats = useCallback((type: UnitType, currentUpgrades: GameState['unitUpgrades']) => {
      const base = UNIT_STATS[type];
      const speedMult = 1 + (currentUpgrades.speedLevel * 0.2);
      const capMult = 1 + (currentUpgrades.capacityLevel * 0.2);
      const nrgMult = 1 + (currentUpgrades.energyLevel * 0.2);
      
      return {
          ...base,
          speed: base.speed * speedMult,
          capacity: Math.floor(base.capacity * capMult),
          maxEnergy: Math.floor(base.maxEnergy * nrgMult)
      };
  }, []);

  // --- Helper: Get Building Capacity ---
  const getHabitatCapacity = (b: BuildingSlot) => {
      let cap = POPULATION_PER_HABITAT;
      if (b.upgrades) {
          b.upgrades.forEach(uId => {
              const upg = BUILDING_UPGRADES[BuildingType.DORMITORY].find(x => x.id === uId);
              if (upg?.effect?.maxPopAdd) cap += upg.effect.maxPopAdd;
          });
      }
      return cap;
  };

  // --- Game Logic ---

  const spawnUnit = (type: UnitType) => {
    if (gameState.taxDue) return; // Blocked by tax

    const cost = getUnitCost(type, gameState.units);
    if (gameState.credits < cost) return;

    let spawnAngle = MINE_ANGLE;
    let homeId: number | null = null;

    const stats = getEffectiveStats(type, gameState.unitUpgrades);
    
    // Logic: Find Home
    if (stats.isTool) {
        // Drills spawn at Workshop
        const workshop = gameState.buildings.find(b => b.type === BuildingType.WORKSHOP && b.status === 'COMPLETED');
        if (!workshop) return; // Needs workshop
        spawnAngle = workshop.angle;
    } else {
        // Miners/Carriers need a Habitat
        const availableHabitat = gameState.buildings.find(b => {
            if (b.type !== BuildingType.DORMITORY || b.status !== 'COMPLETED') return false;
            const capacity = getHabitatCapacity(b);
            return b.occupants.length < capacity;
        });

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
      targetTunnelIdx: null,
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
    if (gameState.taxDue) return;

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
      if (gameState.taxDue) return;

      const slot = gameState.buildings.find(b => b.id === slotId);
      if (!slot || !slot.type) return;

      const upgradesList = BUILDING_UPGRADES[slot.type] || [];
      const upgrade = upgradesList.find(u => u.id === upgradeId);
      if (!upgrade) return;

      if (gameState.credits < upgrade.cost) return;

      setGameState(prev => {
          let newUpgrades = { ...prev.unitUpgrades };
          let upgradedUnits = [...prev.units];

          // Apply Global Stat Upgrades if Training Center
          if (slot.type === BuildingType.TRAINING && upgrade.effect?.statBoost) {
              if (upgrade.effect.statBoost === 'speed') newUpgrades.speedLevel++;
              if (upgrade.effect.statBoost === 'capacity') newUpgrades.capacityLevel++;
              if (upgrade.effect.statBoost === 'energy') newUpgrades.energyLevel++;

              // Update existing units immediately
              upgradedUnits = upgradedUnits.map(u => {
                  const newStats = getEffectiveStats(u.type, newUpgrades);
                  return {
                      ...u,
                      speed: newStats.speed,
                      maxCapacity: newStats.capacity,
                      maxEnergy: newStats.maxEnergy
                      // Note: We don't heal energy, just cap
                  };
              });
          }

          const newBuildings = prev.buildings.map(b => {
              if (b.id !== slotId) return b;
              
              const bUpgrades = [...b.upgrades, upgradeId];
              let newMaxWorkers = b.maxWorkers;
              let newLevel = b.level;
              
              if (upgrade.effect?.maxWorkersAdd) newMaxWorkers += upgrade.effect.maxWorkersAdd;
              newLevel += 1;

              return { ...b, upgrades: bUpgrades, maxWorkers: newMaxWorkers, level: newLevel };
          });

          return {
              ...prev,
              credits: prev.credits - upgrade.cost,
              buildings: newBuildings,
              unitUpgrades: newUpgrades,
              units: upgradedUnits
          };
      });
  };

  const toggleWorkerSlot = (slotId: number, targetCount: number) => {
      setGameState(prev => {
          const newBuildings = prev.buildings.map(b => {
              if (b.id !== slotId) return b;
              const validCount = Math.max(0, Math.min(targetCount, b.maxWorkers));
              return { ...b, requestedWorkers: validCount };
          });
          return { ...prev, buildings: newBuildings };
      });
  };

  const debugAddMoney = () => setGameState(p => ({ ...p, credits: p.credits + 1000 }));
  const debugToggleMultiplier = () => setGameState(p => ({ ...p, globalMultiplier: p.globalMultiplier >= 8 ? 1 : p.globalMultiplier * 2 }));

  const handleSelectSlot = (slotId: number) => {
      setSelectedSlot(slotId);
      const slot = gameState.buildings.find(b => b.id === slotId);
      if (slot) setGameState(prev => ({ ...prev, targetRotation: -slot.angle }));
  };

  const handleManualRotate = (val: number | ((prev: number) => number)) => {
      setGameState(p => ({ ...p, targetRotation: null, rotation: typeof val === 'function' ? val(p.rotation) : val }));
  };

  // --- Game Loop ---
  const tick = useCallback(() => {
    setGameState(prev => {
      const now = Date.now();
      const dt = Math.min((now - prev.lastTick) / 1000, 0.1); 
      const multiplier = prev.globalMultiplier;
      
      let newCredits = prev.credits;
      let newSurfaceOre = prev.surfaceOre;
      let newLooseOreInMine = prev.looseOreInMine;
      let newTotalMined = prev.totalMined;
      let newDepth = prev.mineDepth;
      let newTunnelLengths = [...prev.tunnelLengths];
      let newRotation = prev.rotation;
      let newTaxTimer = prev.taxTimer;
      let newTaxAmount = prev.taxAmount;
      let newTaxDue = prev.taxDue;
      let newLastTaxPaid = prev.lastTaxPaid;
      let newPermits = prev.miningPermits;

      // Tax Logic
      if (!newTaxDue && now >= newTaxTimer) newTaxDue = true;
      if (newTaxDue && newCredits >= newTaxAmount) {
          newCredits -= newTaxAmount;
          newTaxDue = false;
          newTaxAmount = Math.floor(newTaxAmount * TAX_SCALE);
          newTaxTimer = now + TAX_INTERVAL;
          newLastTaxPaid = now;
          newPermits += 1;
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

      // Max Pop
      const dorms = newBuildings.filter(b => b.type === BuildingType.DORMITORY && b.status === 'COMPLETED');
      let calculatedMaxPop = BASE_POPULATION;
      dorms.forEach(d => calculatedMaxPop += getHabitatCapacity(d));

      // Move Helper
      const moveUnit = (u: Entity, targetAngle: number, targetRadius: number, speedMult = 1) => {
         let arrivedAngle = false;
         let arrivedRadius = false;
         const effectiveSpeed = u.speed * multiplier;
         
         let diff = targetAngle - u.position.angle;
         while (diff > 180) diff -= 360;
         while (diff < -180) diff += 360;
         
         if (Math.abs(diff) < 0.5) arrivedAngle = true;
         else u.position.angle += (diff > 0 ? 1 : -1) * effectiveSpeed * speedMult * 15 * dt;

         const radDiff = targetRadius - u.position.radius;
         if (Math.abs(radDiff) < 2) arrivedRadius = true;
         else u.position.radius += (radDiff > 0 ? 1 : -1) * effectiveSpeed * speedMult * 30 * dt;

         return arrivedAngle && arrivedRadius;
      };

      // Job Helper
      const assignJob = (u: Entity) => {
          const buildJob = newBuildings.find(b => (b.status === 'PENDING' || b.status === 'UNDER_CONSTRUCTION') && b.assignedUnitId === null);
          if (buildJob) {
              buildJob.assignedUnitId = u.id;
              if (buildJob.status === 'PENDING') buildJob.status = 'UNDER_CONSTRUCTION';
              u.state = 'MOVING_TO_BUILD';
              return;
          }

          const workJob = newBuildings.find(b => b.status === 'COMPLETED' && b.requestedWorkers > 0 && b.assignedWorkers.length < b.requestedWorkers);
          if (workJob) {
              workJob.assignedWorkers.push(u.id);
              u.workingAtBuildingId = workJob.id;
              u.state = 'MOVING_TO_WORK';
              return;
          }

          const idleDrill = prev.units.find(d => d.type === UnitType.MINER_DRILL && d.state === 'IDLE' && d.carriedBy === null);
          if (idleDrill) {
              u.state = 'MOVING_TO_DRILL';
              return;
          }

          if (newLooseOreInMine > 10) {
              u.state = 'PICKUP_LOOSE_ORE'; 
              return;
          }

          u.state = 'MOVING_TO_MINE';
      };

      // 0. Sync Drill Ownership
      const carrierMap = new Map<string, string>();
      prev.units.forEach(u => { if (u.carryingId) carrierMap.set(u.carryingId, u.id); });
      const syncedUnits = prev.units.map(unit => {
          const u = { ...unit };
          if (carrierMap.has(u.id)) u.carriedBy = carrierMap.get(u.id)!;
          if (u.carryingId && !prev.units.find(t => t.id === u.carryingId)) u.carryingId = null;
          return u;
      });

      // 1. Sync Drill Positions
      const preProcessedUnits = syncedUnits.map(unit => {
          const u = { ...unit };
          if (UNIT_STATS[u.type].isTool) {
             if (u.carriedBy) {
                const carrier = syncedUnits.find(c => c.id === u.carriedBy);
                if (carrier) {
                    u.position = { ...carrier.position };
                    u.state = carrier.state === 'OPERATING_DRILL' ? 'OPERATING_DRILL' : 'IDLE';
                } else {
                    u.carriedBy = null;
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
          
          if (UNIT_STATS[u.type].isTool) {
             if (u.state === 'OPERATING_DRILL') {
                 const produced = DRILL_PRODUCTION_RATE * multiplier * dt;
                 newLooseOreInMine += produced;
                 newTotalMined += produced;
                 newDepth = Math.floor(newTotalMined / 100);
             }
             return u; 
          }

          // Energy
          if (u.state !== 'CHARGING' && u.state !== 'IDLE' && u.homeBuildingId) {
              const drainMult = u.carryingId ? 1.5 : 1;
              u.energy -= ENERGY_DRAIN_RATE * drainMult * dt;
          }

          // Low Energy Check
          if (u.energy <= 0 && u.state !== 'CHARGING' && u.state !== 'MOVING_TO_HOME') {
              let canGoHome = true;
              if (u.carryingId) {
                  // If carrying tool, MUST bring to surface first
                  if (u.position.radius < SURFACE_LEVEL - 5) {
                      canGoHome = false;
                      if (u.state !== 'EXITING_MINE') u.state = 'EXITING_MINE';
                  } else {
                      // On surface, drop
                      const drill = preProcessedUnits.find(d => d.id === u.carryingId);
                      if (drill) {
                          drill.carriedBy = null;
                          drill.state = 'IDLE';
                          drill.position = { ...u.position, radius: SURFACE_LEVEL };
                      }
                      u.carryingId = null;
                  }
              } else {
                  // Clean up jobs
                  const job = newBuildings.find(b => b.assignedUnitId === u.id);
                  if (job) job.assignedUnitId = null;
                  if (u.workingAtBuildingId !== null) {
                      const b = newBuildings.find(bd => bd.id === u.workingAtBuildingId);
                      if (b) b.assignedWorkers = b.assignedWorkers.filter(id => id !== u.id);
                      u.workingAtBuildingId = null;
                  }
              }
              if (canGoHome) u.state = 'MOVING_TO_HOME';
          }

          // State Machine
          switch (u.state) {
              case 'IDLE':
                  assignJob(u);
                  break;

              case 'MOVING_TO_HOME':
                  const home = newBuildings.find(b => b.id === u.homeBuildingId);
                  const homeAngle = home ? home.angle : MINE_ANGLE;
                  
                  // If we are deep underground, go to shaft center first, then up
                  if (u.position.radius < SURFACE_LEVEL - 5) {
                      // Still inside
                      moveUnit(u, MINE_ANGLE, SURFACE_LEVEL);
                  } else {
                      // On surface
                      u.position.radius = SURFACE_LEVEL;
                      if (moveUnit(u, homeAngle, SURFACE_LEVEL)) {
                          u.state = 'CHARGING';
                          // Sanity drop check
                          if (u.carryingId) {
                               const drill = preProcessedUnits.find(d => d.id === u.carryingId);
                               if (drill) {
                                   drill.carriedBy = null;
                                   drill.state = 'IDLE';
                                   drill.position = { ...u.position };
                               }
                               u.carryingId = null;
                          }
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
                  if (!job || job.status === 'COMPLETED') u.state = 'IDLE';
                  else if (moveUnit(u, job.angle, SURFACE_LEVEL)) u.state = 'BUILDING';
                  break;

              case 'BUILDING':
                  const buildJob = newBuildings.find(b => b.assignedUnitId === u.id);
                  if (!buildJob) u.state = 'IDLE';
                  else {
                      buildJob.constructionProgress += (BUILD_SPEED_BASE * u.miningPower * multiplier) * dt;
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
                  } else if (moveUnit(u, workJob.angle, SURFACE_LEVEL)) u.state = 'WORKING_IN_BUILDING';
                  break;

              case 'WORKING_IN_BUILDING':
                   const b = newBuildings.find(x => x.id === u.workingAtBuildingId);
                   if (!b || !b.assignedWorkers.includes(u.id)) {
                       u.workingAtBuildingId = null;
                       u.state = 'IDLE';
                   }
                   break;

              case 'MOVING_TO_MINE': 
              case 'PICKUP_LOOSE_ORE':
                  // Go to entrance
                  if (Math.abs(normalizeAngle(u.position.angle - MINE_ANGLE)) > 2 || Math.abs(u.position.radius - SURFACE_LEVEL) > 2) {
                      moveUnit(u, MINE_ANGLE, SURFACE_LEVEL);
                  } else {
                      // Decide Destination
                      const currentDepthPx = Math.min(300, 20 + newDepth * 1.5);
                      // Check available tunnels that are excavated enough to enter
                      // And check if they aren't fully mined out yet? No, they can always be extended up to max
                      const availableTunnels = TUNNEL_DEFINITIONS.filter((t, idx) => {
                          const isReachable = t.depthPx < currentDepthPx;
                          const canGrow = newTunnelLengths[idx] < t.maxWidth;
                          return isReachable && canGrow;
                      });
                      
                      // 40% Chance to go to a growing tunnel if available, else bottom
                      if (availableTunnels.length > 0 && Math.random() > 0.4) {
                          const randIdx = Math.floor(Math.random() * availableTunnels.length);
                          // Match index in global array
                          const realIdx = TUNNEL_DEFINITIONS.findIndex(t => t === availableTunnels[randIdx]);
                          u.targetTunnelIdx = realIdx;
                      } else {
                          u.targetTunnelIdx = null; // Main shaft
                      }
                      u.state = 'ENTERING_MINE';
                  }
                  break;

              case 'ENTERING_MINE':
                  const visualDepth = Math.min(newDepth * 1.5, 300);
                  let targetR = SURFACE_LEVEL - 20 - visualDepth;
                  
                  // If going to tunnel, target depth is fixed
                  if (u.targetTunnelIdx !== null && u.targetTunnelIdx !== undefined && TUNNEL_DEFINITIONS[u.targetTunnelIdx]) {
                       targetR = SURFACE_LEVEL - 20 - TUNNEL_DEFINITIONS[u.targetTunnelIdx].depthPx;
                  }

                  const spd = u.carryingId ? DRILL_WEIGHT_SPEED_PENALTY : 1;
                  
                  // Move vertically first
                  let atDepth = false;
                  const rDiff = targetR - u.position.radius;
                  if (Math.abs(rDiff) < 2) atDepth = true;
                  else u.position.radius += (rDiff > 0 ? 1 : -1) * u.speed * multiplier * spd * 30 * dt;

                  if (atDepth) {
                      // If drill carrier, start op
                      if (u.carryingId) {
                          u.state = 'OPERATING_DRILL';
                      } else if (prev.units.find(un => un.id === u.id)?.state === 'PICKUP_LOOSE_ORE') {
                           // Quick grab loose ore logic
                           const take = Math.min(u.maxCapacity, newLooseOreInMine);
                           u.inventory = take;
                           newLooseOreInMine -= take;
                           u.state = 'EXITING_MINE';
                      } else {
                           // Check loose ore first
                           if (newLooseOreInMine > 5 && !u.targetTunnelIdx) {
                               // Only grab loose ore if at bottom of shaft
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
                  break;

              case 'MINING': 
                  const toughness = 1 + (newDepth * 0.05); 
                  const pwr = u.miningPower * multiplier;
                  
                  // Horizontal Movement Logic for Tunnel vs Shaft
                  let targetAngle = MINE_ANGLE;
                  
                  if (u.targetTunnelIdx !== null && u.targetTunnelIdx !== undefined) {
                      // Move to the current FACE of the tunnel to mine it
                      const tun = TUNNEL_DEFINITIONS[u.targetTunnelIdx];
                      const currentLen = newTunnelLengths[u.targetTunnelIdx];
                      const radiusAtDepth = u.position.radius;
                      
                      // Angle offset in degrees = (ArcLength / Radius) * (180/PI)
                      // We aim slightly before the end to "stand" there
                      const angleOffsetRad = (currentLen / radiusAtDepth);
                      const angleOffsetDeg = angleOffsetRad * (180 / Math.PI) * tun.direction;
                      
                      targetAngle = MINE_ANGLE + angleOffsetDeg;
                  } else {
                      // Spread in main shaft
                      targetAngle = MINE_ANGLE + Math.sin(parseInt(u.id, 36)) * 8;
                  }

                  // Move Angularly towards work spot
                  let inPos = false;
                  const aDiff = targetAngle - u.position.angle;
                  if (Math.abs(aDiff) < 1) inPos = true;
                  else u.position.angle += (aDiff > 0 ? 1 : -1) * u.speed * multiplier * 10 * dt;

                  if (inPos) {
                      u.progress += (pwr / toughness) * dt;
                      if (u.progress >= 1) {
                          u.inventory = u.maxCapacity;
                          
                          if (u.targetTunnelIdx !== null && u.targetTunnelIdx !== undefined) {
                              // Tunnel Mining Logic
                              const tIdx = u.targetTunnelIdx;
                              const tDef = TUNNEL_DEFINITIONS[tIdx];
                              if (newTunnelLengths[tIdx] < tDef.maxWidth) {
                                  newTunnelLengths[tIdx] += 1; // Extend tunnel
                              } else {
                                  // Fallback if maxed
                                  newTotalMined += 1;
                                  newDepth = Math.floor(newTotalMined / 100);
                              }
                          } else {
                              // Shaft Logic
                              newTotalMined += 1; 
                              newDepth = Math.floor(newTotalMined / 100);
                          }
                          
                          u.state = 'EXITING_MINE';
                      }
                  }
                  break;

              case 'OPERATING_DRILL':
                  // Visual bob
                  u.position.angle = MINE_ANGLE + Math.sin(now/50) * 1;
                  break;

              case 'EXITING_MINE':
                  // First align to MINE ANGLE if in tunnel
                  let aligned = false;
                  if (Math.abs(u.position.angle - MINE_ANGLE) < 2) aligned = true;
                  else {
                      const dir = MINE_ANGLE - u.position.angle;
                      u.position.angle += (dir > 0 ? 1 : -1) * u.speed * multiplier * 20 * dt;
                  }

                  if (aligned) {
                      if (moveUnit(u, MINE_ANGLE, SURFACE_LEVEL)) {
                          // Reached Surface
                          if (u.energy <= 0) {
                               if (u.carryingId) {
                                   const drill = preProcessedUnits.find(d => d.id === u.carryingId);
                                   if (drill) {
                                       drill.carriedBy = null;
                                       drill.state = 'IDLE';
                                       drill.position = { ...u.position, radius: SURFACE_LEVEL };
                                   }
                                   u.carryingId = null;
                               }
                               u.state = 'MOVING_TO_HOME';
                          } else {
                               u.state = 'MOVING_TO_PILE';
                          }
                      }
                  }
                  break;

              case 'MOVING_TO_PILE':
                  if (moveUnit(u, PILE_ANGLE, SURFACE_LEVEL)) {
                      u.state = 'DEPOSITING';
                      u.progress = 0;
                  }
                  break;

              case 'DEPOSITING':
                  u.progress += dt * 5 * multiplier;
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
                           u.state = 'CARRYING_DRILL_TO_MINE'; 
                       }
                   }
                   break;
              
              case 'CARRYING_DRILL_TO_MINE':
                  // Ensure we go to mine entrance surface point first
                  if (Math.abs(normalizeAngle(u.position.angle - MINE_ANGLE)) > 2 || Math.abs(u.position.radius - SURFACE_LEVEL) > 2) {
                      moveUnit(u, MINE_ANGLE, SURFACE_LEVEL, DRILL_WEIGHT_SPEED_PENALTY);
                  } else {
                      // Enter mine
                      u.targetTunnelIdx = null; // Drills go to bottom
                      u.state = 'ENTERING_MINE';
                  }
                  break;
          }

          return u;
      });

      // Crusher Logic
      const crusherBuildings = newBuildings.filter(b => b.type === BuildingType.CRUSHER && b.status === 'COMPLETED');
      if (crusherBuildings.length > 0 && newSurfaceOre > 0) {
          let totalBonus = 0;
          crusherBuildings.forEach(cb => {
              totalBonus += 15; 
              const workers = newUnits.filter(u => u.workingAtBuildingId === cb.id && u.state === 'WORKING_IN_BUILDING');
              workers.forEach(w => {
                  const efficiency = w.energy / w.maxEnergy;
                  totalBonus += CRUSHER_WORKER_BONUS * efficiency;
              });
          });
          totalBonus *= multiplier;
          const extraCrush = Math.min(newSurfaceOre, totalBonus * dt);
          newSurfaceOre -= extraCrush;
          newCredits += extraCrush * ORE_VALUE;
      }

      return {
        ...prev,
        credits: newCredits,
        miningPermits: newPermits,
        surfaceOre: Math.max(0, newSurfaceOre),
        looseOreInMine: Math.max(0, newLooseOreInMine),
        totalMined: newTotalMined,
        mineDepth: newDepth,
        tunnelLengths: newTunnelLengths,
        maxPopulation: calculatedMaxPop,
        units: newUnits,
        buildings: newBuildings,
        lastTick: now,
        rotation: newRotation,
        taxTimer: newTaxTimer,
        taxAmount: newTaxAmount,
        taxDue: newTaxDue,
        lastTaxPaid: newLastTaxPaid
      };
    });

    requestAnimationFrame(tick);
  }, [getEffectiveStats]);

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
        onToggleDebug={() => setShowDebug(!showDebug)}
      />
      {showDebug && (
          <div className="absolute top-16 right-4 bg-slate-900 border border-slate-600 p-4 rounded-lg z-[100] shadow-xl">
              <h3 className="text-white font-bold mb-2">DEBUG MENU</h3>
              <div className="flex flex-col gap-2">
                  <button onClick={debugAddMoney} className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">Add $1000</button>
                  <button onClick={debugToggleMultiplier} className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm">
                      Multiplier: {gameState.globalMultiplier}x
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
