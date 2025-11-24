
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
  TRAINING = 'TRAINING', // Unit stat upgrades
}

export type BuildingStatus = 'EMPTY' | 'PENDING' | 'UNDER_CONSTRUCTION' | 'COMPLETED';

export interface Entity {
  id: string;
  type: UnitType;
  // Updated State Machine
  state: 'IDLE' | 
         'MOVING_TO_MINE' | 'ENTERING_MINE' | 'MINING' | 'EXITING_MINE' | 
         'MOVING_TO_PILE' | 'DEPOSITING' | 
         'MOVING_TO_HOME' | 'CHARGING' | 
         'MOVING_TO_BUILD' | 'BUILDING' |
         'MOVING_TO_DRILL' | 'CARRYING_DRILL_TO_MINE' | 'OPERATING_DRILL' | 
         'PICKUP_LOOSE_ORE' | 
         'MOVING_TO_WORK' | 'WORKING_IN_BUILDING';
  
  position: { x: number; y: number; angle: number; radius: number };
  targetDepth: number;
  targetTunnelIdx: number | null; // null/-1 for main shaft bottom, 0+ for specific tunnel
  inventory: number;
  maxCapacity: number;
  energy: number;
  maxEnergy: number;
  speed: number;
  miningPower: number;
  progress: number; // 0 to 1 for current action
  
  // New Logic Props
  homeBuildingId: number | null; // ID of the habitat this unit belongs to
  carryingId: string | null; // ID of the tool/drill this unit is carrying
  carriedBy: string | null; // ID of the unit carrying this entity (if it's a drill)
  workingAtBuildingId: number | null; // ID of building unit is assigned to work at
}

export interface BuildingSlot {
  id: number;
  angle: number; // Position on asteroid in degrees
  type: BuildingType | null;
  level: number;
  unlocked: boolean;
  status: BuildingStatus;
  constructionProgress: number; // 0 to 1
  assignedUnitId: string | null;
  occupants: string[]; // IDs of units that live here
  
  // Worker Logic
  maxWorkers: number; // Capacity based on upgrades
  assignedWorkers: string[]; // IDs of units working here
  requestedWorkers: number; // User set target (0 to maxWorkers)
  upgrades: string[]; // IDs of purchased upgrades
}

export interface GameState {
  credits: number;
  miningPermits: number; // Meta progression currency
  surfaceOre: number; // Ore sitting at the pile (Surface)
  looseOreInMine: number; // Ore sitting at the bottom of the mine (needs hauling)
  totalMined: number; // Used to calculate depth
  mineDepth: number; // Visual and logic depth (meters)
  maxPopulation: number;
  units: Entity[];
  buildings: BuildingSlot[];
  lastTick: number;
  rotation: number; // Visual rotation of the asteroid
  targetRotation: number | null; // If set, asteroid auto-rotates to this angle
  
  // Tax System
  taxTimer: number; // Timestamp when next tax is due
  taxAmount: number; // Current tax amount required
  taxDue: boolean; // Is payment pending (blocking spending)
  lastTaxPaid: number; // Timestamp of last payment for visuals

  // Debug
  globalMultiplier: number;
  
  // Global Upgrades
  unitUpgrades: {
      speedLevel: number;
      capacityLevel: number;
      energyLevel: number;
  };
}

export const ASTEROID_RADIUS = 400; // Radius in pixels
export const SURFACE_LEVEL = ASTEROID_RADIUS;
export const MINE_ANGLE = 0; // Top center
export const PILE_ANGLE = 12; // Between Mine and Crusher
export const CRUSHER_ANGLE = 25; // Where the Crusher/Refinery sits
