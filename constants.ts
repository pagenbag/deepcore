
import { UnitType, BuildingType } from './types';

export const TICK_RATE = 1000 / 60; // 60 FPS target logic

export const UNIT_STATS: Record<UnitType, { cost: number; speed: number; capacity: number; power: number; maxEnergy: number; label: string }> = {
  [UnitType.MINER_BASIC]: { cost: 10, speed: 0.8, capacity: 5, power: 0.5, maxEnergy: 100, label: 'Miner' },
  [UnitType.MINER_DRILL]: { cost: 250, speed: 0.3, capacity: 50, power: 3, maxEnergy: 200, label: 'Hvy Drill' },
  [UnitType.CARRIER_ROVER]: { cost: 50, speed: 1.5, capacity: 15, power: 2, maxEnergy: 150, label: 'Speedy Bot' },
  [UnitType.CARRIER_DRONE]: { cost: 500, speed: 3, capacity: 40, power: 4, maxEnergy: 120, label: 'Flying Drone' },
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
export const ENERGY_DRAIN_RATE = 3; // Energy lost per second while working
export const ENERGY_RECHARGE_RATE = 25; // Energy gained per second while charging

// Generate slots around the asteroid, avoiding the "Industrial Zone" (-10 to 40 degrees)
const slots = [];
const START_ANGLE = 50;
const END_ANGLE = 340; // Equivalent to -20
const STEP = 30;
let idCounter = 1;

for (let angle = START_ANGLE; angle <= END_ANGLE; angle += STEP) {
    // Normalize angle for display logic if needed, but physics handles > 360
    slots.push({ id: idCounter++, angle: angle, type: null, level: 0, unlocked: true });
}

export const INITIAL_SLOTS = slots;
