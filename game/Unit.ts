
import { BUILD_SPEED_BASE, DRILL_PRODUCTION_RATE, DRILL_WEIGHT_SPEED_PENALTY, ENERGY_DRAIN_RATE, ENERGY_RECHARGE_RATE, MINE_ANGLE, PILE_ANGLE, SURFACE_LEVEL, UNIT_BASE_STATS } from "../config";
import { Point, UnitState, UnitType } from "../types";
import { GameEngine } from "./GameEngine";

export abstract class Unit {
    id: string;
    type: UnitType;
    state: UnitState = 'IDLE';
    position: Point;
    
    // Stats
    energy: number;
    maxEnergy: number;
    inventory: number = 0;
    
    // Relationships
    homeBuildingId: number | null;
    carryingId: string | null = null;
    carriedBy: string | null = null;
    workingAtBuildingId: number | null = null;

    // Navigation
    targetTunnelIdx: number | null = null;
    progress: number = 0; // For timed actions (mining/building)

    constructor(id: string, type: UnitType, homeId: number | null, engine: GameEngine) {
        this.id = id;
        this.type = type;
        this.homeBuildingId = homeId;
        
        // Init Stats
        const stats = engine.getUnitStats(type);
        this.maxEnergy = stats.maxEnergy;
        this.energy = this.maxEnergy;
        
        // Init Position
        let startAngle = MINE_ANGLE;
        if (homeId !== null) {
            const b = engine.buildings.find(b => b.id === homeId);
            if (b) startAngle = b.angle;
        }
        this.position = { x: 0, y: 0, angle: startAngle, radius: SURFACE_LEVEL };
    }

    abstract update(dt: number, engine: GameEngine): void;

    // --- SHARED UTILS ---

    protected getStats(engine: GameEngine) {
        return engine.getUnitStats(this.type);
    }

    protected rotateTowards(targetAngle: number, dt: number, speed: number): boolean {
        // Calculate shortest path
        let diff = targetAngle - this.position.angle;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        // Snap if close
        if (Math.abs(diff) < 0.5) {
            this.position.angle = targetAngle; 
            return true;
        } 
        
        // Move
        const change = (diff > 0 ? 1 : -1) * speed * dt;
        this.position.angle += change;
        
        // Keep angle normalized 0-360 to prevent massive overflow over time
        this.position.angle = this.normalizeAngle(this.position.angle);
        
        return false;
    }

    protected moveTowards(targetAngle: number, targetRadius: number, dt: number, engine: GameEngine, speedPenalty: number = 1): boolean {
        const stats = this.getStats(engine);
        const effectiveSpeed = stats.speed * engine.globalMultiplier * speedPenalty;
        
        // Angle
        // 15 is an arbitrary turn speed multiplier relative to move speed
        const arrivedAngle = this.rotateTowards(targetAngle, dt, effectiveSpeed * 15);

        // Radius
        let arrivedRadius = false;
        const rDiff = targetRadius - this.position.radius;
        if (Math.abs(rDiff) < 2) {
            this.position.radius = targetRadius; // Snap
            arrivedRadius = true;
        } else {
            this.position.radius += (rDiff > 0 ? 1 : -1) * effectiveSpeed * 30 * dt;
        }

        return arrivedAngle && arrivedRadius;
    }

    protected normalizeAngle(a: number) {
        let angle = a % 360;
        while (angle > 180) angle -= 360;
        while (angle <= -180) angle += 360;
        return angle;
    }

    protected consumeEnergy(dt: number) {
        let drain = ENERGY_DRAIN_RATE;
        if (this.carryingId) drain *= 1.5;
        this.energy -= drain * dt;
    }
}

export class Miner extends Unit {
    
    update(dt: number, engine: GameEngine) {
        const stats = this.getStats(engine);
        const multiplier = engine.globalMultiplier;

        // Energy Check (except moving home/charging)
        if (this.state !== 'MOVING_TO_HOME' && this.state !== 'CHARGING' && this.state !== 'EXITING_MINE') {
            this.consumeEnergy(dt);
            if (this.energy <= 0) {
                // Must exit mine first if inside
                if (this.position.radius < SURFACE_LEVEL - 5) {
                    this.state = 'EXITING_MINE';
                } else {
                    // Drop tools if on surface
                    if (this.carryingId) {
                         const tool = engine.getUnit(this.carryingId);
                         if (tool) {
                             tool.carriedBy = null;
                             tool.state = 'IDLE';
                             tool.position = { ...this.position, radius: SURFACE_LEVEL };
                         }
                         this.carryingId = null;
                    }
                    this.state = 'MOVING_TO_HOME';
                }
            }
        }

        switch (this.state) {
            case 'IDLE':
                this.findJob(engine);
                break;

            case 'MOVING_TO_HOME':
                this.moveToHome(dt, engine);
                break;

            case 'CHARGING':
                this.energy += ENERGY_RECHARGE_RATE * dt;
                if (this.energy >= this.maxEnergy) {
                    this.energy = this.maxEnergy;
                    this.state = 'IDLE';
                }
                break;

            case 'MOVING_TO_BUILD':
                const buildJob = engine.buildings.find(b => b.assignedUnitId === this.id);
                if (!buildJob || buildJob.status === 'COMPLETED') this.state = 'IDLE';
                else if (this.moveTowards(buildJob.angle, SURFACE_LEVEL, dt, engine)) this.state = 'BUILDING';
                break;

            case 'BUILDING':
                const b = engine.buildings.find(x => x.assignedUnitId === this.id);
                if (!b) this.state = 'IDLE';
                else {
                    b.constructionProgress += (BUILD_SPEED_BASE * stats.power * multiplier) * dt;
                    if (b.constructionProgress >= 1) {
                        b.completeConstruction();
                        this.state = 'IDLE';
                    }
                }
                break;

            case 'MOVING_TO_WORK':
                const wJob = engine.buildings.find(x => x.id === this.workingAtBuildingId);
                if (!wJob || wJob.requestedWorkers === 0) {
                    this.workingAtBuildingId = null;
                    this.state = 'IDLE';
                } else if (this.moveTowards(wJob.angle, SURFACE_LEVEL, dt, engine)) {
                    this.state = 'WORKING_IN_BUILDING';
                }
                break;
            
            case 'WORKING_IN_BUILDING':
                const wB = engine.buildings.find(x => x.id === this.workingAtBuildingId);
                if (!wB || !wB.assignedWorkers.includes(this.id)) {
                    this.workingAtBuildingId = null;
                    this.state = 'IDLE';
                }
                break;

            case 'MOVING_TO_MINE':
            case 'PICKUP_LOOSE_ORE':
                if (this.moveTowards(MINE_ANGLE, SURFACE_LEVEL, dt, engine)) {
                    // Decide Path
                    const currentDepthPx = Math.min(300, 20 + engine.mineDepth * 1.5);
                    const tunnels = engine.tunnels.filter(t => t.depthPx < currentDepthPx && t.currentLength < t.maxWidth);
                    
                    if (tunnels.length > 0 && Math.random() > 0.4 && this.state !== 'PICKUP_LOOSE_ORE') {
                        const t = tunnels[Math.floor(Math.random() * tunnels.length)];
                        this.targetTunnelIdx = engine.tunnels.indexOf(t);
                    } else {
                        this.targetTunnelIdx = null;
                    }
                    this.state = 'ENTERING_MINE';
                }
                break;

            case 'ENTERING_MINE':
                this.handleEnteringMine(dt, engine);
                break;

            case 'MINING':
                this.handleMining(dt, engine, stats.power * multiplier);
                break;

            case 'EXITING_MINE':
                this.handleExitingMine(dt, engine);
                break;

            case 'MOVING_TO_PILE':
                if (this.moveTowards(PILE_ANGLE, SURFACE_LEVEL, dt, engine)) {
                    this.state = 'DEPOSITING';
                    this.progress = 0;
                }
                break;

            case 'DEPOSITING':
                this.progress += dt * 5 * multiplier;
                if (this.progress >= 1) {
                    engine.surfaceOre += this.inventory;
                    this.inventory = 0;
                    this.state = 'IDLE';
                }
                break;

            case 'MOVING_TO_DRILL':
                const drill = engine.units.find(u => u.type === UnitType.MINER_DRILL && u.state === 'IDLE' && !u.carriedBy && !u.carryingId);
                if (!drill) {
                    this.state = 'IDLE';
                } else {
                    if (this.moveTowards(drill.position.angle, drill.position.radius, dt, engine)) {
                        this.carryingId = drill.id;
                        drill.carriedBy = this.id;
                        this.state = 'CARRYING_DRILL_TO_MINE';
                    }
                }
                break;

            case 'CARRYING_DRILL_TO_MINE':
                 // Go to surface entrance first
                 if (this.moveTowards(MINE_ANGLE, SURFACE_LEVEL, dt, engine, DRILL_WEIGHT_SPEED_PENALTY)) {
                     this.targetTunnelIdx = null; // Drills go to bottom
                     this.state = 'ENTERING_MINE';
                 }
                 break;
        }
    }

    private findJob(engine: GameEngine) {
        // 1. Build
        const buildJob = engine.buildings.find(b => (b.status === 'PENDING' || b.status === 'UNDER_CONSTRUCTION') && !b.assignedUnitId);
        if (buildJob) {
            buildJob.assignedUnitId = this.id;
            if (buildJob.status === 'PENDING') buildJob.status = 'UNDER_CONSTRUCTION';
            this.state = 'MOVING_TO_BUILD';
            return;
        }

        // 2. Work
        const workJob = engine.buildings.find(b => b.status === 'COMPLETED' && b.requestedWorkers > 0 && b.assignedWorkers.length < b.requestedWorkers);
        if (workJob) {
            workJob.assignedWorkers.push(this.id);
            this.workingAtBuildingId = workJob.id;
            this.state = 'MOVING_TO_WORK';
            return;
        }

        // 3. Drill Transport
        const idleDrill = engine.units.find(d => d.type === UnitType.MINER_DRILL && d.state === 'IDLE' && !d.carriedBy);
        if (idleDrill) {
            this.state = 'MOVING_TO_DRILL';
            return;
        }

        // 4. Loose Ore
        if (engine.looseOreInMine > 10) {
            this.state = 'PICKUP_LOOSE_ORE';
            return;
        }

        // 5. Mine
        this.state = 'MOVING_TO_MINE';
    }

    private moveToHome(dt: number, engine: GameEngine) {
        if (this.position.radius < SURFACE_LEVEL - 5) {
            // In mine, exit first
             this.handleExitingMine(dt, engine);
             return;
        }

        this.position.radius = SURFACE_LEVEL; // Snap
        const home = engine.buildings.find(b => b.id === this.homeBuildingId);
        const ang = home ? home.angle : 0;
        
        if (this.moveTowards(ang, SURFACE_LEVEL, dt, engine)) {
            this.state = 'CHARGING';
            this.workingAtBuildingId = null;
        }
    }

    private handleEnteringMine(dt: number, engine: GameEngine) {
        const visualDepth = Math.min(engine.mineDepth * 1.5, 300);
        let targetR = SURFACE_LEVEL - 20 - visualDepth;
        if (this.targetTunnelIdx !== null && engine.tunnels[this.targetTunnelIdx]) {
            targetR = SURFACE_LEVEL - 20 - engine.tunnels[this.targetTunnelIdx].depthPx;
        }

        const spdPenalty = this.carryingId ? DRILL_WEIGHT_SPEED_PENALTY : 1;
        
        // Vertical move only first
        const rDiff = targetR - this.position.radius;
        const stats = this.getStats(engine);
        const effSpeed = stats.speed * engine.globalMultiplier * spdPenalty;
        
        if (Math.abs(rDiff) < 2) {
            this.position.radius = targetR;
            
            // Arrived at depth
            if (this.carryingId) {
                // We are carrying a drill, so we start op
                this.state = 'OPERATING_DRILL';
                // Also set the drill's state
                const drill = engine.getUnit(this.carryingId);
                if (drill) drill.state = 'OPERATING_DRILL';
            } else if (engine.looseOreInMine > 5 && this.targetTunnelIdx === null) {
                // Grab loose ore at bottom
                const take = Math.min(stats.capacity, engine.looseOreInMine);
                this.inventory = take;
                engine.looseOreInMine -= take;
                this.state = 'EXITING_MINE';
            } else {
                this.state = 'MINING';
                this.progress = 0;
            }
        } else {
             this.position.radius += (rDiff > 0 ? 1 : -1) * effSpeed * 30 * dt;
        }
    }

    private handleMining(dt: number, engine: GameEngine, power: number) {
        const toughness = 1 + (engine.mineDepth * 0.05);
        let targetAngle = MINE_ANGLE;
        
        // Horizontal/Angular move
        if (this.targetTunnelIdx !== null) {
            const tun = engine.tunnels[this.targetTunnelIdx];
            const rad = this.position.radius;
            // Angle to reach end of tunnel
            const angleOffsetDeg = (tun.currentLength / rad) * (180 / Math.PI) * tun.direction;
            targetAngle = MINE_ANGLE + angleOffsetDeg;
        } else {
             // Shaft spread
             targetAngle = MINE_ANGLE + Math.sin(parseInt(this.id.substr(0,4), 36)) * 8;
        }

        // Move to face using shortest path
        const turnSpeed = this.getStats(engine).speed * engine.globalMultiplier * 10;
        const inPos = this.rotateTowards(targetAngle, dt, turnSpeed);

        if (inPos) {
            this.progress += (power / toughness) * dt;
            if (this.progress >= 1) {
                this.inventory = this.getStats(engine).capacity;
                
                if (this.targetTunnelIdx !== null) {
                    const t = engine.tunnels[this.targetTunnelIdx];
                    if (t.currentLength < t.maxWidth) t.currentLength += 1;
                    else {
                        engine.addMined(1);
                    }
                } else {
                    engine.addMined(1);
                }
                this.state = 'EXITING_MINE';
            }
        }
    }

    private handleExitingMine(dt: number, engine: GameEngine) {
        const stats = this.getStats(engine);
        // Align to shaft center first (Shortest Path rotation)
        const turnSpeed = stats.speed * engine.globalMultiplier * 20;
        
        // We consider it "aligned" if within 2 degrees
        // rotateTowards returns true if within 0.5 deg
        const aligned = this.rotateTowards(MINE_ANGLE, dt, turnSpeed);
        
        if (Math.abs(this.normalizeAngle(this.position.angle - MINE_ANGLE)) < 2 || aligned) {
            // Go Up
            if (this.moveTowards(MINE_ANGLE, SURFACE_LEVEL, dt, engine)) {
                // Reached Surface
                if (this.energy <= 0) {
                     // Drop Drill if holding
                     if (this.carryingId) {
                         const drill = engine.getUnit(this.carryingId);
                         if (drill) {
                             drill.carriedBy = null;
                             drill.state = 'IDLE';
                             drill.position = { ...this.position, radius: SURFACE_LEVEL };
                         }
                         this.carryingId = null;
                     }
                     this.state = 'MOVING_TO_HOME';
                } else {
                     this.state = 'MOVING_TO_PILE';
                }
            }
        }
    }
}

export class Drill extends Unit {
    update(dt: number, engine: GameEngine) {
        // Passive check
        if (this.carriedBy) {
            const carrier = engine.getUnit(this.carriedBy);
            if (carrier) {
                this.position = { ...carrier.position };
                // If carrier operating, we produce
                if (carrier.state === 'OPERATING_DRILL') {
                    this.state = 'OPERATING_DRILL';
                    const prod = DRILL_PRODUCTION_RATE * engine.globalMultiplier * dt;
                    engine.looseOreInMine += prod;
                    engine.addMined(prod);
                    
                    // Visual wobble
                    this.position.angle = MINE_ANGLE + Math.sin(Date.now() / 50);
                } else {
                    this.state = 'IDLE';
                }
            } else {
                this.carriedBy = null;
                this.state = 'IDLE';
            }
        }
    }
}

export class Carrier extends Unit {
    update(dt: number, engine: GameEngine) {
        // Simplified Logic for Carrier (Future expansion)
        // For now, same as Miner basically but simpler job queue
        // Reusing Miner for now since logic is 90% shared
    }
}
