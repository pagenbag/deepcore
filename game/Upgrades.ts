
import { BuildingType, Modifier, StatTarget, UnitType } from "../types";

export class Upgrade {
    id: string;
    buildingType: BuildingType;
    label: string;
    description: string;
    cost: number;
    modifiers: Modifier[];

    constructor(id: string, type: BuildingType, label: string, desc: string, cost: number, mods: Modifier[]) {
        this.id = id;
        this.buildingType = type;
        this.label = label;
        this.description = desc;
        this.cost = cost;
        this.modifiers = mods;
    }
}

export const UPGRADE_CATALOG: Upgrade[] = [
    // CRUSHER
    new Upgrade('crush_1', BuildingType.CRUSHER, 'Manual Input', 'Adds a worker slot.', 1000, 
        [{ targetType: 'BUILDING', targetId: BuildingType.CRUSHER, stat: 'MAX_WORKERS', type: 'ADD_FLAT', value: 1 }]),
    new Upgrade('crush_2', BuildingType.CRUSHER, 'Sorting Gear', 'Adds a 2nd worker slot.', 5000, 
        [{ targetType: 'BUILDING', targetId: BuildingType.CRUSHER, stat: 'MAX_WORKERS', type: 'ADD_FLAT', value: 1 }]),
    new Upgrade('crush_3', BuildingType.CRUSHER, 'Hydraulics', 'Adds a 3rd worker slot.', 15000, 
        [{ targetType: 'BUILDING', targetId: BuildingType.CRUSHER, stat: 'MAX_WORKERS', type: 'ADD_FLAT', value: 1 }]),

    // HABITAT
    new Upgrade('dorm_1', BuildingType.DORMITORY, 'Expansion Module', '+5 Population Cap.', 500,
        [{ targetType: 'BUILDING', targetId: BuildingType.DORMITORY, stat: 'MAX_POPULATION', type: 'ADD_FLAT', value: 5 }]),
    new Upgrade('dorm_2', BuildingType.DORMITORY, 'High-Density Bunks', '+5 Population Cap.', 2000,
        [{ targetType: 'BUILDING', targetId: BuildingType.DORMITORY, stat: 'MAX_POPULATION', type: 'ADD_FLAT', value: 5 }]),

    // TRAINING CENTER (Global Unit Buffs)
    new Upgrade('train_spd_1', BuildingType.TRAINING, 'Fitness Training', '+20% Speed (All Units).', 2000,
        [{ targetType: 'UNIT', stat: 'SPEED', type: 'MULTIPLY_PERCENT', value: 0.2 }]),
    new Upgrade('train_cap_1', BuildingType.TRAINING, 'Better Backpacks', '+20% Capacity (All Units).', 3000,
        [{ targetType: 'UNIT', stat: 'CAPACITY', type: 'MULTIPLY_PERCENT', value: 0.2 }]),
    new Upgrade('train_nrg_1', BuildingType.TRAINING, 'High-V Batteries', '+20% Energy (All Units).', 2500,
        [{ targetType: 'UNIT', stat: 'ENERGY', type: 'MULTIPLY_PERCENT', value: 0.2 }]),
    
    new Upgrade('train_spd_2', BuildingType.TRAINING, 'Exoskeletons', '+20% Speed (All Units).', 8000,
        [{ targetType: 'UNIT', stat: 'SPEED', type: 'MULTIPLY_PERCENT', value: 0.2 }]),
    new Upgrade('train_cap_2', BuildingType.TRAINING, 'Anti-Grav Pallets', '+20% Capacity (All Units).', 12000,
        [{ targetType: 'UNIT', stat: 'CAPACITY', type: 'MULTIPLY_PERCENT', value: 0.2 }]),
];
