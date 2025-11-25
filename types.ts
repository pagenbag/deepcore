
export enum UnitType {
  MINER_BASIC = 'MINER_BASIC',
  MINER_DRILL = 'MINER_DRILL',
  CARRIER_ROVER = 'CARRIER_ROVER',
  CARRIER_DRONE = 'CARRIER_DRONE',
}

export enum BuildingType {
  DORMITORY = 'DORMITORY',
  WORKSHOP = 'WORKSHOP',
  CRUSHER = 'CRUSHER',
  REACTOR = 'REACTOR',
  TRAINING = 'TRAINING',
  LAUNCHPAD = 'LAUNCHPAD',
}

export type UnitState = 
  | 'IDLE' 
  | 'MOVING_TO_MINE' | 'ENTERING_MINE' | 'MINING' | 'EXITING_MINE' 
  | 'MOVING_TO_PILE' | 'DEPOSITING' 
  | 'MOVING_TO_HOME' | 'CHARGING' 
  | 'MOVING_TO_BUILD' | 'BUILDING' 
  | 'MOVING_TO_DRILL' | 'CARRYING_DRILL_TO_MINE' | 'OPERATING_DRILL' 
  | 'PICKUP_LOOSE_ORE' 
  | 'MOVING_TO_WORK' | 'WORKING_IN_BUILDING';

export interface Point {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export interface TunnelDef {
    id: number;
    depthPx: number; // Vertical depth (0-300 scale)
    direction: -1 | 1; // -1 Left, 1 Right
    maxWidth: number; // Max visual width
    currentLength: number; // Runtime state
}

// Upgrade System Types
export type ModifierType = 'ADD_FLAT' | 'MULTIPLY_PERCENT';
export type StatTarget = 'SPEED' | 'CAPACITY' | 'ENERGY' | 'POWER' | 'MAX_WORKERS' | 'MAX_POPULATION';

export interface Modifier {
  targetType: 'UNIT' | 'BUILDING' | 'GLOBAL';
  targetId?: string; // Specific UnitType or BuildingType enum
  stat: StatTarget;
  type: ModifierType;
  value: number;
}

export interface Environment {
  gravity: number; // Affects movement speed (default 1)
  oreValue: number; // Credits per ore (default 1)
  oreHardness: number; // Mining duration multiplier (default 1)
  startingCredits: number;
  miningPermits: number;
  prestigeCount: number;
}

// Visual/Render Props (extracted from Classes for React components)
export interface RenderableUnit {
  id: string;
  type: UnitType;
  state: UnitState;
  position: Point;
  energy: number;
  maxEnergy: number;
  inventory: number;
  carryingId: string | null;
  carriedBy: string | null;
}

export interface RenderableBuilding {
  id: number;
  angle: number;
  type: BuildingType | null;
  status: 'EMPTY' | 'PENDING' | 'UNDER_CONSTRUCTION' | 'COMPLETED';
  level: number;
  constructionProgress: number;
  occupants: number; // count
  assignedWorkers: number; // count
  requestedWorkers: number;
  maxWorkers: number;
  isLaunchpadSlot: boolean;
}
