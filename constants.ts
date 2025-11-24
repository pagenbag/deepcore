
import { UnitType, BuildingType, CRUSHER_ANGLE } from './types';

export const TICK_RATE = 1000 / 60; // 60 FPS target logic

export const COST_SCALING_FACTOR = 1.15; // Each unit costs 15% more than the previous one of that type

export const UNIT_STATS: Record<UnitType, { cost: number; speed: number; capacity: number; power: number; maxEnergy: number; label: string; isTool?: boolean }> = {
  [UnitType.MINER_BASIC]: { cost: 10, speed: 0.8, capacity: 5, power: 0.5, maxEnergy: 100, label: 'Miner' },
  [UnitType.MINER_DRILL]: { cost: 250, speed: 0, capacity: 0, power: 5, maxEnergy: 500, label: 'Hvy Drill', isTool: true }, // Speed 0 means it cannot move on its own
  [UnitType.CARRIER_ROVER]: { cost: 50, speed: 1.5, capacity: 15, power: 2, maxEnergy: 150, label: 'Speedy Bot' },
  [UnitType.CARRIER_DRONE]: { cost: 500, speed: 3, capacity: 40, power: 4, maxEnergy: 120, label: 'Flying Drone' },
};

export const BUILDING_COSTS: Record<BuildingType, { baseCost: number; scale: number; label: string; desc: string }> = {
  [BuildingType.DORMITORY]: { baseCost: 100, scale: 1.5, label: 'Habitat', desc: 'Increases population cap (+5)' },
  [BuildingType.WORKSHOP]: { baseCost: 500, scale: 2.0, label: 'Tech Lab', desc: 'Allows advanced unit production' },
  [BuildingType.CRUSHER]: { baseCost: 1500, scale: 1.5, label: 'Ore Crusher', desc: 'Passive ore processing' },
  [BuildingType.TRAINING]: { baseCost: 2500, scale: 2.0, label: 'Training Center', desc: 'Upgrade unit stats globally' },
  [BuildingType.REACTOR]: { baseCost: 5000, scale: 2.5, label: 'Core Reactor', desc: 'Speed up all units' },
};

// Which units can be recruited at which building
export const UNIT_UNLOCKS: Record<BuildingType, UnitType[]> = {
  [BuildingType.DORMITORY]: [UnitType.MINER_BASIC, UnitType.CARRIER_ROVER],
  [BuildingType.WORKSHOP]: [UnitType.MINER_DRILL, UnitType.CARRIER_DRONE],
  [BuildingType.CRUSHER]: [],
  [BuildingType.TRAINING]: [],
  [BuildingType.REACTOR]: [],
};

// Definitions for specific building upgrades
export interface BuildingUpgrade {
    id: string;
    label: string;
    cost: number;
    desc: string;
    effect?: { maxWorkersAdd?: number; maxPopAdd?: number; statBoost?: 'speed' | 'capacity' | 'energy' };
}

export const BUILDING_UPGRADES: Record<BuildingType, BuildingUpgrade[]> = {
    [BuildingType.CRUSHER]: [
        { id: 'crusher_slot_1', label: 'Manual Input', cost: 1000, desc: 'Adds a worker slot to boost production.', effect: { maxWorkersAdd: 1 } },
        { id: 'crusher_slot_2', label: 'Sorting Gear', cost: 5000, desc: 'Adds a second worker slot.', effect: { maxWorkersAdd: 1 } },
        { id: 'crusher_slot_3', label: 'Hydraulics', cost: 15000, desc: 'Adds a third worker slot.', effect: { maxWorkersAdd: 1 } }
    ],
    [BuildingType.DORMITORY]: [
        { id: 'dorm_exp_1', label: 'Expansion Module', cost: 500, desc: 'Adds 5 extra population capacity.', effect: { maxPopAdd: 5 } },
        { id: 'dorm_exp_2', label: 'High-Density Bunks', cost: 2000, desc: 'Adds another 5 population capacity.', effect: { maxPopAdd: 5 } }
    ],
    [BuildingType.TRAINING]: [
        { id: 'train_speed_1', label: 'Fitness Training', cost: 2000, desc: '+20% Move Speed for all units.', effect: { statBoost: 'speed' } },
        { id: 'train_cap_1', label: 'Better Backpacks', cost: 3000, desc: '+20% Carry Capacity for all units.', effect: { statBoost: 'capacity' } },
        { id: 'train_nrg_1', label: 'High-V Batteries', cost: 2500, desc: '+20% Max Energy for all units.', effect: { statBoost: 'energy' } },
        { id: 'train_speed_2', label: 'Exoskeletons', cost: 8000, desc: '+20% Move Speed for all units.', effect: { statBoost: 'speed' } },
        { id: 'train_cap_2', label: 'Anti-Grav Pallets', cost: 12000, desc: '+20% Carry Capacity for all units.', effect: { statBoost: 'capacity' } },
    ],
    [BuildingType.WORKSHOP]: [],
    [BuildingType.REACTOR]: []
};

// Tunnel Config
export interface TunnelDef {
    depthPx: number; // Where it starts vertically (0-300 scale)
    angleOffset: number; // Degrees (+ is right, - is left)
    width: number; // How wide the tunnel is visually
}

export const TUNNEL_DEFINITIONS: TunnelDef[] = [
    { depthPx: 60, angleOffset: -12, width: 30 },
    { depthPx: 120, angleOffset: 15, width: 40 },
    { depthPx: 180, angleOffset: -18, width: 35 },
    { depthPx: 240, angleOffset: 12, width: 30 },
    { depthPx: 280, angleOffset: -10, width: 25 },
];

export const ORE_VALUE = 1; // Credits per ore
export const CRUSHER_WORKER_BONUS = 20; // Extra ore per second if worker is present (scaled by energy)
export const BASE_POPULATION = 0;
export const POPULATION_PER_HABITAT = 5;
export const ENERGY_DRAIN_RATE = 3; // Energy lost per second while working
export const ENERGY_RECHARGE_RATE = 25; // Energy gained per second while charging
export const BUILD_SPEED_BASE = 0.2; // Progress per second per unit power
export const DRILL_WEIGHT_SPEED_PENALTY = 0.4; // Speed multiplier when carrying a drill
export const DRILL_PRODUCTION_RATE = 20; // Ore per second generated by heavy drill

export const TAX_INTERVAL = 120 * 1000; // 2 minutes
export const TAX_INITIAL_AMOUNT = 200;
export const TAX_SCALE = 1.5;

// Generate slots around the asteroid
const slots = [];

// 1. MAIN CRUSHER (ID 0)
slots.push({
    id: 0,
    angle: CRUSHER_ANGLE,
    type: BuildingType.CRUSHER,
    level: 1,
    unlocked: true,
    status: 'COMPLETED',
    constructionProgress: 1,
    assignedUnitId: null,
    occupants: [],
    maxWorkers: 0, 
    assignedWorkers: [],
    requestedWorkers: 0,
    upgrades: []
});

// 2. Empty Slots
const START_ANGLE = 50;
const END_ANGLE = 340; // Equivalent to -20
const STEP = 30;
let idCounter = 1;

for (let angle = START_ANGLE; angle <= END_ANGLE; angle += STEP) {
    slots.push({ 
      id: idCounter++, 
      angle: angle, 
      type: null, 
      level: 0, 
      unlocked: true,
      status: 'EMPTY',
      constructionProgress: 0,
      assignedUnitId: null,
      occupants: [],
      maxWorkers: 0,
      assignedWorkers: [],
      requestedWorkers: 0,
      upgrades: []
    });
}

export const INITIAL_SLOTS = slots;
