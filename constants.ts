import { UnitType, BuildingType } from './types';

export const TICK_RATE = 1000 / 60; // 60 FPS target logic

export const UNIT_STATS: Record<UnitType, { cost: number; speed: number; capacity: number; power: number; label: string }> = {
  [UnitType.MINER_BASIC]: { cost: 10, speed: 2, capacity: 5, power: 1, label: 'Gnorp Miner' },
  [UnitType.MINER_DRILL]: { cost: 150, speed: 1.5, capacity: 20, power: 5, label: 'Auto-Drill' },
  [UnitType.CARRIER_ROVER]: { cost: 15, speed: 3, capacity: 10, power: 0, label: 'Rover' },
  [UnitType.CARRIER_DRONE]: { cost: 200, speed: 6, capacity: 30, power: 0, label: 'Heavy Drone' },
};

export const BUILDING_COSTS: Record<BuildingType, { baseCost: number; scale: number; label: string; desc: string }> = {
  [BuildingType.DORMITORY]: { baseCost: 100, scale: 1.5, label: 'Habitat', desc: 'Housing for units' },
  [BuildingType.WORKSHOP]: { baseCost: 500, scale: 2.0, label: 'Tech Lab', desc: 'Better efficiency' },
  [BuildingType.CRUSHER]: { baseCost: 1000, scale: 1.5, label: 'Auto-Crusher', desc: 'Slowly refines surface ore' },
  [BuildingType.REACTOR]: { baseCost: 5000, scale: 2.5, label: 'Core Reactor', desc: 'Speed up all units' },
};

export const ORE_VALUE = 1; // Credits per ore
export const DEPTH_DIFFICULTY_SCALAR = 0.01; // How much harder mining gets per meter
export const INITIAL_SLOTS = [
  { id: 1, angle: -25, type: null, level: 0, unlocked: true },
  { id: 2, angle: -50, type: null, level: 0, unlocked: true },
  { id: 3, angle: 50, type: null, level: 0, unlocked: true },
  { id: 4, angle: 75, type: null, level: 0, unlocked: false },
  { id: 5, angle: -75, type: null, level: 0, unlocked: false },
];
