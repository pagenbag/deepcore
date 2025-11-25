
import { BASE_TUNNELS, BUILDING_CONFIG, COST_SCALING_FACTOR, generateSlots, TAX_INITIAL_AMOUNT, TAX_INTERVAL, TAX_SCALE, UNIT_BASE_STATS, UNIT_UNLOCKS } from "../config";
import { BuildingType, Environment, Modifier, ModifierType, StatTarget, TunnelDef, UnitType } from "../types";
import { Building, Crusher, Habitat, Launchpad } from "./Building";
import { Drill, Miner, Unit } from "./Unit";
import { UPGRADE_CATALOG } from "./Upgrades";

export class GameEngine {
    // State
    credits: number = 10;
    surfaceOre: number = 0;
    looseOreInMine: number = 0;
    totalMined: number = 0;
    mineDepth: number = 0;
    
    // Entities
    units: Unit[] = [];
    buildings: Building[] = [];
    tunnels: TunnelDef[] = [];
    
    // Modifiers
    activeModifiers: Modifier[] = [];
    
    // Environment/Settings
    environment: Environment = {
        gravity: 1,
        oreValue: 1,
        oreHardness: 1,
        startingCredits: 10,
        miningPermits: 0,
        prestigeCount: 0
    };

    // System
    lastTick: number = Date.now();
    taxTimer: number = 0;
    taxAmount: number = TAX_INITIAL_AMOUNT;
    taxDue: boolean = false;
    taxStarted: boolean = false;
    lastTaxPaid: number = 0;
    
    // Debug
    globalMultiplier: number = 1;

    constructor() {
        this.resetGame();
    }

    private resetGame() {
        this.credits = this.environment.startingCredits;
        this.surfaceOre = 0;
        this.looseOreInMine = 0;
        this.totalMined = 0;
        this.mineDepth = 0;
        this.units = [];
        this.activeModifiers = [];
        this.tunnels = JSON.parse(JSON.stringify(BASE_TUNNELS));
        
        // Tax Init
        this.taxAmount = TAX_INITIAL_AMOUNT;
        this.taxTimer = 0; // Not started yet
        this.taxStarted = false;
        this.taxDue = false;

        // Init Slots
        const slots = generateSlots();
        this.buildings = slots.map(s => {
            if (s.id === 0) return new Crusher(0, s.angle); // Main Crusher
            if (s.isLaunchpad) return new Launchpad(s.id, s.angle, true);
            return new Building(s.id, s.angle, false);
        });

        // Setup Main Crusher
        const crusher = this.buildings[0];
        crusher.type = BuildingType.CRUSHER;
        crusher.status = 'COMPLETED';
        crusher.level = 1;
        crusher.constructionProgress = 1;
    }

    // --- MAIN LOOP ---
    tick() {
        const now = Date.now();
        const dt = Math.min((now - this.lastTick) / 1000, 0.1);
        this.lastTick = now;

        // Tax Logic
        if (this.taxStarted) {
            if (!this.taxDue && now >= this.taxTimer) this.taxDue = true;
            if (this.taxDue && this.credits >= this.taxAmount) {
                this.credits -= this.taxAmount;
                this.taxDue = false;
                this.taxAmount = Math.floor(this.taxAmount * TAX_SCALE);
                this.taxTimer = now + TAX_INTERVAL;
                this.lastTaxPaid = now;
                this.environment.miningPermits++;
            }
        }

        // Entities Update
        this.units.forEach(u => u.update(dt, this));
        this.buildings.forEach(b => b.update(dt, this));
    }

    // --- ACTIONS ---

    buyUnit(type: UnitType) {
        if (this.taxDue) return;
        const cost = this.getUnitCost(type);
        if (this.credits < cost) return;

        // Find Home
        let homeId: number | null = null;
        const isTool = UNIT_BASE_STATS[type].isTool;

        if (isTool) {
            const workshop = this.buildings.find(b => b.type === BuildingType.WORKSHOP && b.status === 'COMPLETED');
            if (!workshop) return;
            homeId = workshop.id;
        } else {
             const popCap = this.getMaxPopulation();
             const popCount = this.units.filter(u => !UNIT_BASE_STATS[u.type].isTool).length;
             if (popCount >= popCap) return;

             const habitat = this.buildings.find(b => b.type === BuildingType.DORMITORY && b.status === 'COMPLETED' && b.occupants.length < b.getMaxPopulation(this));
             if (!habitat) return; // No space in specific hab
             homeId = habitat.id;
        }

        this.credits -= cost;
        const id = Math.random().toString(36).substr(2, 9);
        
        let unit: Unit;
        if (type === UnitType.MINER_DRILL) unit = new Drill(id, type, homeId, this);
        else unit = new Miner(id, type, homeId, this); // Reusing Miner for basic/carriers for now

        this.units.push(unit);
        
        const b = this.buildings.find(x => x.id === homeId);
        if (b) b.occupants.push(unit.id);
    }

    constructBuilding(slotId: number, type: BuildingType) {
        if (this.taxDue) return;
        const slot = this.buildings.find(b => b.id === slotId);
        if (!slot) return;

        // Rule: First Habitat is Free and Instant to bootstrap the colony
        const isFirstHabitat = type === BuildingType.DORMITORY && !this.buildings.some(b => b.type === BuildingType.DORMITORY);

        let cost = BUILDING_CONFIG[type].baseCost;
        if (isFirstHabitat) cost = 0;
        
        if (this.credits < cost) return;
        this.credits -= cost;

        // Replace instance with subclass if needed
        let newB: Building = slot;
        if (type === BuildingType.DORMITORY) newB = new Habitat(slot.id, slot.angle);
        else if (type === BuildingType.CRUSHER) newB = new Crusher(slot.id, slot.angle);
        else newB = new Building(slot.id, slot.angle, slot.isLaunchpadSlot);
        
        // Swap in array
        const idx = this.buildings.findIndex(b => b.id === slotId);
        this.buildings[idx] = newB;

        if (isFirstHabitat) {
            newB.type = type;
            newB.status = 'COMPLETED';
            newB.level = 1;
            // Initialize arrays if not done by constructor
            newB.assignedWorkers = [];
            newB.occupants = [];
            newB.purchasedUpgrades = [];
            
            // START TAX SYSTEM
            this.taxStarted = true;
            this.taxTimer = Date.now() + TAX_INTERVAL;
        } else {
            newB.startConstruction(type);
        }
    }

    buyUpgrade(slotId: number, upgradeId: string) {
        if (this.taxDue) return;
        const slot = this.buildings.find(b => b.id === slotId);
        if (!slot) return;
        
        const upgrade = UPGRADE_CATALOG.find(u => u.id === upgradeId);
        if (!upgrade) return;
        if (this.credits < upgrade.cost) return;

        this.credits -= upgrade.cost;
        slot.purchasedUpgrades.push(upgrade.id);
        
        // Add Modifiers
        this.activeModifiers.push(...upgrade.modifiers);
        
        slot.level++;
    }

    setWorkerRequest(slotId: number, count: number) {
        const b = this.buildings.find(x => x.id === slotId);
        if (b) b.requestedWorkers = Math.max(0, Math.min(count, b.getMaxWorkers(this)));
    }

    prestige() {
        this.environment.prestigeCount++;
        // Keep permits, reset everything else
        const perms = this.environment.miningPermits;
        this.resetGame();
        this.environment.miningPermits = perms;
        // Could apply prestige buffs to environment here
    }

    // --- HELPERS ---

    addCredits(amount: number) {
        this.credits += amount;
    }

    addMined(amount: number) {
        this.totalMined += amount;
        this.mineDepth = Math.floor(this.totalMined / 100);
    }

    getUnit(id: string) {
        return this.units.find(u => u.id === id);
    }

    getUnitCost(type: UnitType) {
        const count = this.units.filter(u => u.type === type).length;
        const base = UNIT_BASE_STATS[type].cost;
        return Math.floor(base * Math.pow(COST_SCALING_FACTOR, count));
    }

    getMaxPopulation() {
        let cap = 0;
        this.buildings.filter(b => b.type === BuildingType.DORMITORY && b.status === 'COMPLETED')
            .forEach(b => cap += b.getMaxPopulation(this));
        return cap;
    }

    // --- MODIFIER SYSTEM ---
    
    applyModifiers(baseValue: number, context: 'UNIT' | 'BUILDING', targetId: string | null, stat: StatTarget): number {
        let val = baseValue;
        
        const mods = this.activeModifiers.filter(m => {
             if (m.stat !== stat) return false;
             if (m.targetType === 'GLOBAL') return true;
             if (m.targetType === context) {
                 if (!m.targetId) return true; // Applies to all units/buildings
                 return m.targetId === targetId;
             }
             return false;
        });

        // Apply Adds
        mods.filter(m => m.type === 'ADD_FLAT').forEach(m => val += m.value);
        // Apply Mults
        mods.filter(m => m.type === 'MULTIPLY_PERCENT').forEach(m => val *= (1 + m.value));
        
        return val;
    }

    getUnitStats(type: UnitType) {
        const base = UNIT_BASE_STATS[type];
        return {
            ...base,
            speed: this.applyModifiers(base.speed, 'UNIT', type, 'SPEED'),
            capacity: Math.floor(this.applyModifiers(base.capacity, 'UNIT', type, 'CAPACITY')),
            maxEnergy: Math.floor(this.applyModifiers(base.maxEnergy, 'UNIT', type, 'ENERGY')),
            power: this.applyModifiers(base.power, 'UNIT', type, 'POWER')
        };
    }
}
