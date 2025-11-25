
import { UnitType, BuildingType, TunnelDef } from './types';

// --- VISUAL CONSTANTS ---
export const ASTEROID_RADIUS = 400;
export const SURFACE_LEVEL = ASTEROID_RADIUS;
export const MINE_ANGLE = 0; 
export const PILE_ANGLE = 12;
export const CRUSHER_ANGLE = 25; 
export const LAUNCHPAD_ANGLE = 180; // Opposite side

// --- GAME LOOP ---
export const TICK_RATE_MS = 16; // ~60 FPS
export const AUTOSAVE_INTERVAL = 30000;

// --- COSTS & BALANCE ---
export const UNIT_BASE_STATS: Record<UnitType, { cost: number; speed: number; capacity: number; power: number; maxEnergy: number; label: string; isTool?: boolean }> = {
  [UnitType.MINER_BASIC]: { cost: 10, speed: 0.8, capacity: 5, power: 0.5, maxEnergy: 100, label: 'Miner' },
  [UnitType.MINER_DRILL]: { cost: 250, speed: 0, capacity: 0, power: 5, maxEnergy: 500, label: 'Hvy Drill', isTool: true },
  [UnitType.CARRIER_ROVER]: { cost: 50, speed: 1.5, capacity: 15, power: 2, maxEnergy: 150, label: 'Speedy Bot' },
  [UnitType.CARRIER_DRONE]: { cost: 500, speed: 3, capacity: 40, power: 4, maxEnergy: 120, label: 'Flying Drone' },
};

export const BUILDING_CONFIG: Record<BuildingType, { baseCost: number; scale: number; label: string; desc: string }> = {
  [BuildingType.DORMITORY]: { baseCost: 100, scale: 1.5, label: 'Habitat', desc: 'Increases population cap (+5)' },
  [BuildingType.WORKSHOP]: { baseCost: 500, scale: 2.0, label: 'Tech Lab', desc: 'Allows advanced unit production' },
  [BuildingType.CRUSHER]: { baseCost: 1500, scale: 1.5, label: 'Ore Crusher', desc: 'Passive ore processing' },
  [BuildingType.TRAINING]: { baseCost: 2500, scale: 2.0, label: 'Training Center', desc: 'Upgrade unit stats globally' },
  [BuildingType.REACTOR]: { baseCost: 5000, scale: 2.5, label: 'Core Reactor', desc: 'Speed up all units' },
  [BuildingType.LAUNCHPAD]: { baseCost: 50000, scale: 1.0, label: 'Launchpad', desc: 'Prepare for departure (Prestige)' },
};

export const UNIT_UNLOCKS: Record<BuildingType, UnitType[]> = {
  [BuildingType.DORMITORY]: [UnitType.MINER_BASIC, UnitType.CARRIER_ROVER],
  [BuildingType.WORKSHOP]: [UnitType.MINER_DRILL, UnitType.CARRIER_DRONE],
  [BuildingType.CRUSHER]: [],
  [BuildingType.TRAINING]: [],
  [BuildingType.REACTOR]: [],
  [BuildingType.LAUNCHPAD]: [],
};

// --- ENVIRONMENT ---
export const BASE_TUNNELS: TunnelDef[] = [
    { id: 0, depthPx: 60, direction: -1, maxWidth: 120, currentLength: 10 },
    { id: 1, depthPx: 120, direction: 1, maxWidth: 160, currentLength: 10 },
    { id: 2, depthPx: 180, direction: -1, maxWidth: 140, currentLength: 10 },
    { id: 3, depthPx: 240, direction: 1, maxWidth: 120, currentLength: 10 },
    { id: 4, depthPx: 280, direction: -1, maxWidth: 100, currentLength: 10 },
];

export const COST_SCALING_FACTOR = 1.15;
export const ENERGY_DRAIN_RATE = 3;
export const ENERGY_RECHARGE_RATE = 25;
export const BUILD_SPEED_BASE = 0.2;
export const DRILL_WEIGHT_SPEED_PENALTY = 0.4;
export const DRILL_PRODUCTION_RATE = 20;
export const CRUSHER_PASSIVE_RATE = 15;
export const CRUSHER_WORKER_BONUS = 20;

export const TAX_INTERVAL = 120 * 1000;
export const TAX_INITIAL_AMOUNT = 200;
export const TAX_SCALE = 1.5;

export const MAX_PILE_CAPACITY = 1000;
export const PILE_RESUME_THRESHOLD = 800;

// Building Slots Layout
export const generateSlots = () => {
    const slots = [];
    
    // 0. Main Crusher
    slots.push({ id: 0, angle: CRUSHER_ANGLE, isLaunchpad: false });

    // 1. Arc
    const START_ANGLE = 50;
    const END_ANGLE = 340; // -20
    const STEP = 30;
    let idCounter = 1;

    for (let angle = START_ANGLE; angle <= END_ANGLE; angle += STEP) {
        slots.push({ id: idCounter++, angle: angle, isLaunchpad: false });
    }

    // Convert last slot to launchpad slot (visually distant)
    let bestSlot = slots[0];
    let minDiff = 360;
    slots.forEach(s => {
        if(s.id === 0) return;
        const diff = Math.abs(s.angle - LAUNCHPAD_ANGLE);
        if (diff < minDiff) {
            minDiff = diff;
            bestSlot = s;
        }
    });
    bestSlot.isLaunchpad = true;

    return slots;
};
