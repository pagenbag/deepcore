
import { BUILDING_CONFIG, BUILDING_CONFIG as CONFIG, CRUSHER_PASSIVE_RATE, CRUSHER_WORKER_BONUS } from "../config";
import { BuildingType, Modifier, RenderableBuilding } from "../types";
import { GameEngine } from "./GameEngine";
import { UPGRADE_CATALOG } from "./Upgrades";

export class Building {
    id: number;
    angle: number;
    type: BuildingType | null = null;
    status: 'EMPTY' | 'PENDING' | 'UNDER_CONSTRUCTION' | 'COMPLETED' = 'EMPTY';
    level: number = 0;
    constructionProgress: number = 0;
    
    // Workers
    assignedUnitId: string | null = null; // Builder
    occupants: string[] = []; // Residents
    assignedWorkers: string[] = []; // Workers
    requestedWorkers: number = 0;
    
    // Stats (Base)
    baseMaxWorkers: number = 0;
    baseMaxPop: number = 0;

    purchasedUpgrades: string[] = [];
    isLaunchpadSlot: boolean;

    constructor(id: number, angle: number, isLaunchpadSlot: boolean = false) {
        this.id = id;
        this.angle = angle;
        this.isLaunchpadSlot = isLaunchpadSlot;
    }

    startConstruction(type: BuildingType) {
        this.type = type;
        this.status = 'PENDING';
        this.constructionProgress = 0;
        this.level = 1;
        
        // Reset state
        this.assignedWorkers = [];
        this.occupants = [];
        this.purchasedUpgrades = [];
        this.requestedWorkers = 0;
    }

    completeConstruction() {
        this.status = 'COMPLETED';
        this.assignedUnitId = null;
        this.onComplete();
    }

    protected onComplete() {}

    // Main Update Loop
    update(dt: number, engine: GameEngine) {
        if (this.status !== 'COMPLETED') return;
        this.onTick(dt, engine);
    }

    protected onTick(dt: number, engine: GameEngine) {}

    // Stats
    getMaxWorkers(engine: GameEngine): number {
        if (!this.type) return 0;
        let val = this.baseMaxWorkers;
        val = engine.applyModifiers(val, 'BUILDING', this.type, 'MAX_WORKERS');
        return Math.floor(val);
    }

    getMaxPopulation(engine: GameEngine): number {
        if (!this.type) return 0;
        let val = this.baseMaxPop;
        val = engine.applyModifiers(val, 'BUILDING', this.type, 'MAX_POPULATION');
        return Math.floor(val);
    }

    // Serialization for React
    toRenderable(engine: GameEngine): RenderableBuilding {
        return {
            id: this.id,
            angle: this.angle,
            type: this.type,
            status: this.status,
            level: this.level,
            constructionProgress: this.constructionProgress,
            occupants: this.occupants.length,
            assignedWorkers: this.assignedWorkers.length,
            requestedWorkers: this.requestedWorkers,
            maxWorkers: this.getMaxWorkers(engine),
            isLaunchpadSlot: this.isLaunchpadSlot
        };
    }
}

export class Habitat extends Building {
    constructor(id: number, angle: number) {
        super(id, angle);
        this.baseMaxPop = 5;
    }
}

export class Crusher extends Building {
    onTick(dt: number, engine: GameEngine): void {
        if (engine.surfaceOre <= 0) return;

        let rate = CRUSHER_PASSIVE_RATE; // Base passive
        
        // Add worker bonus
        this.assignedWorkers.forEach(workerId => {
            const worker = engine.getUnit(workerId);
            if (worker && worker.state === 'WORKING_IN_BUILDING') {
                const efficiency = worker.energy / worker.maxEnergy;
                rate += CRUSHER_WORKER_BONUS * efficiency;
            }
        });

        rate *= engine.environment.oreHardness; // Abuse hardness prop as general speed modifier? Or create new prop.
        // Actually use globalMultiplier from Debug
        rate *= engine.globalMultiplier;

        const processAmount = Math.min(engine.surfaceOre, rate * dt);
        engine.surfaceOre -= processAmount;
        engine.addCredits(processAmount * engine.environment.oreValue);
    }
}

export class Launchpad extends Building {
    // Only allows launch action
}
