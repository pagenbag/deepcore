import { UnitType, BuildingType } from './types';

export const TICK_RATE = 1000 / 60; // 60 FPS target logic

export const UNIT_STATS: Record<UnitType, { cost: number; speed: number; capacity: number; power: number; label: string }> = {
  [UnitType.MINER_BASIC]: { cost: 10, speed: 2.5, capacity: 5, power: 1, label: 'Miner' },
  [UnitType.MINER_DRILL]: { cost: 250, speed: 0.5, capacity: 50, power: 8, label: 'Hvy Drill' },
  [UnitType.CARRIER_ROVER]: { cost: 50, speed: 4, capacity: 15, power: 2, label: 'Speedy Bot' },
  [UnitType.CARRIER_DRONE]: { cost: 500, speed: 8, capacity: 40, power: 4, label: 'Flying Drone' },
};

export const BUILDING_COSTS: Record<BuildingType, { baseCost: number; scale: number; label: string; desc: string }> = {
  [BuildingType.DORMITORY]: { baseCost: 100, scale: 1.5, label: 'Habitat', desc: 'Increases population cap (+5)' },
  [BuildingType.WORKSHOP]: { baseCost: 500, scale: 2.0, label: 'Tech Lab', desc: 'Allows advanced unit production' },
  [BuildingType.CRUSHER]: { baseCost: 1500, scale: 1.5, label: 'Aux Crusher', desc: 'Passive ore processing' },
  [BuildingType.REACTOR]: { baseCost: 5000, scale: 2.5, label: 'Core Reactor', desc: 'Speed up all units' },
};

// Which units can be recruited at which building
export const UNIT_UNLOCKS: Record<BuildingType, UnitType[]> = {
  [BuildingType.DORMITORY]: [UnitType.MINER_BASIC, UnitType.CARRIER_ROVER],
  [BuildingType.WORKSHOP]: [UnitType.MINER_DRILL, UnitType.CARRIER_DRONE],
  [BuildingType.CRUSHER]: [],
  [BuildingType.REACTOR]: [],
};

export const ORE_VALUE = 1; // Credits per ore
export const BASE_CRUSHER_RATE = 10; // Ore per second processed by the main crusher
export const BASE_POPULATION = 0;
export const POPULATION_PER_HABITAT = 5;

// Industrial Zone is approx -20 to +40 degrees (Mine at 0, Crusher at 25)
// We distribute slots around the rest of the 360 degrees
export const INITIAL_SLOTS = [
  // Right Side
  { id: 1, angle: 45, type: null, level: 0, unlocked: true },
  { id: 2, angle: 75, type: null, level: 0, unlocked: true },
  { id: 3, angle: 105, type: null, level: 0, unlocked: true },
  { id: 4, angle: 135, type: null, level: 0, unlocked: true },
  { id: 5, angle: 165, type: null, level: 0, unlocked: true },
  
  // Back / Bottom
  { id: 6, angle: 195, type: null, level: 0, unlocked: true }, 
  { id: 7, angle: 225, type: null, level: 0, unlocked: true }, // -135

  // Left Side (Negative angles)
  { id: 8, angle: -30, type: null, level: 0, unlocked: true },
  { id: 9, angle: -60, type: null, level: 0, unlocked: true },
  { id: 10, angle: -90, type: null, level: 0, unlocked: true },
  { id: 11, angle: -120, type: null, level: 0, unlocked: true },
];