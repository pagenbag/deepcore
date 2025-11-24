export enum UnitType {
  MINER_BASIC = 'MINER_BASIC',
  MINER_DRILL = 'MINER_DRILL',
  CARRIER_ROVER = 'CARRIER_ROVER',
  CARRIER_DRONE = 'CARRIER_DRONE',
}

export enum BuildingType {
  DORMITORY = 'DORMITORY', // Increases max unit count
  WORKSHOP = 'WORKSHOP', // Unlocks better units
  CRUSHER = 'CRUSHER', // Passive ore processing (Auxiliary)
  REACTOR = 'REACTOR', // Global speed boost
}

export interface Entity {
  id: string;
  type: UnitType;
  state: 'IDLE' | 'MOVING_TO_MINE' | 'ENTERING_MINE' | 'MINING' | 'EXITING_MINE' | 'MOVING_TO_PILE' | 'DEPOSITING';
  position: { x: number; y: number; angle: number; radius: number };
  targetDepth: number;
  inventory: number;
  maxCapacity: number;
  speed: number;
  miningPower: number;
  progress: number; // 0 to 1 for current action
}

export interface BuildingSlot {
  id: number;
  angle: number; // Position on asteroid in degrees
  type: BuildingType | null;
  level: number;
  unlocked: boolean;
}

export interface GameState {
  credits: number;
  surfaceOre: number; // Ore sitting at the pile
  totalMined: number; // Used to calculate depth
  mineDepth: number; // Visual and logic depth (meters)
  maxPopulation: number;
  units: Entity[];
  buildings: BuildingSlot[];
  lastTick: number;
  rotation: number; // Visual rotation of the asteroid
  targetRotation: number | null; // If set, asteroid auto-rotates to this angle
}

export const ASTEROID_RADIUS = 400; // Radius in pixels
export const SURFACE_LEVEL = ASTEROID_RADIUS;
export const MINE_ANGLE = 0; // Top center
export const PILE_ANGLE = 12; // Between Mine and Crusher
export const CRUSHER_ANGLE = 25; // Where the Crusher/Refinery sits
