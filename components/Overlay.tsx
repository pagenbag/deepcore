import React from 'react';
import { GameState, UnitType, BuildingType } from '../types';
import { UNIT_STATS, BUILDING_COSTS, UNIT_UNLOCKS, COST_SCALING_FACTOR, UPGRADE_COSTS } from '../constants';
import { Coins, Mountain, Pickaxe, Users, X, Hammer, ArrowUpCircle, UserCog } from 'lucide-react';

interface OverlayProps {
  gameState: GameState;
  onBuyUnit: (type: UnitType) => void;
  selectedSlotId: number | null;
  onBuild: (slotId: number, type: BuildingType) => void;
  onCloseBuildMenu: () => void;
  onUpgradeBuilding: (slotId: number) => void;
  onToggleWorkers: (slotId: number) => void;
}

const Overlay: React.FC<OverlayProps> = ({ gameState, onBuyUnit, selectedSlotId, onBuild, onCloseBuildMenu, onUpgradeBuilding, onToggleWorkers }) => {
  
  const formatNumber = (num: number) => Math.floor(num).toLocaleString();
  
  const selectedSlot = gameState.buildings.find(b => b.id === selectedSlotId);
  const isBuildingMenu = selectedSlot && selectedSlot.type !== null;

  const getUnitCost = (type: UnitType) => {
      const count = gameState.units.filter(u => u.type === type).length;
      const base = UNIT_STATS[type].cost;
      return Math.floor(base * Math.pow(COST_SCALING_FACTOR, count));
  };

  return (
    <>
      {/* Top Resource Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none z-50">
        <div className="flex gap-4 pointer-events-auto flex-wrap">
          <div className="bg-slate-900/90 border border-slate-700 p-2 px-4 rounded-full flex items-center gap-3 shadow-xl backdrop-blur">
            <Coins className="text-yellow-400" size={18} />
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Credits</div>
              <div className="text-lg font-mono text-white leading-none">${formatNumber(gameState.credits)}</div>
            </div>
          </div>
          
          <div className="bg-slate-900/90 border border-slate-700 p-2 px-4 rounded-full flex items-center gap-3 shadow-xl backdrop-blur">
            <Mountain className="text-orange-500" size={18} />
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Surface / Mine</div>
              <div className="text-lg font-mono text-white leading-none">
                  {formatNumber(gameState.surfaceOre)} <span className="text-gray-500 text-sm">/ {formatNumber(gameState.looseOreInMine)}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 p-2 px-4 rounded-full flex items-center gap-3 shadow-xl backdrop-blur">
            <Users className="text-blue-400" size={18} />
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Pop</div>
              <div className={`text-lg font-mono leading-none ${gameState.units.filter(u => !UNIT_STATS[u.type].isTool).length >= gameState.maxPopulation ? 'text-red-400' : 'text-white'}`}>
                {gameState.units.filter(u => !UNIT_STATS[u.type].isTool).length} / {gameState.maxPopulation}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 p-2 px-4 rounded-full flex items-center gap-3 shadow-xl backdrop-blur">
             <Pickaxe className="text-gray-400" size={18} />
             <div>
               <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Depth</div>
               <div className="text-lg font-mono text-white leading-none">{formatNumber(gameState.mineDepth)} m</div>
             </div>
           </div>
        </div>
      </div>

      {/* Bottom Interaction Panel */}
      {selectedSlotId !== null && (
        <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col items-center justify-end p-6 pointer-events-none">
          <div className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl p-6 pointer-events-auto animate-slideUp relative">
            
            <button 
                onClick={onCloseBuildMenu} 
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-20"
            >
                <X size={24} />
            </button>

            {!isBuildingMenu && (
                <>
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Construction Site</h2>
                        <p className="text-gray-400 text-sm">Select a facility to construct in this sector.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.values(BuildingType).map((bType) => {
                            const info = BUILDING_COSTS[bType];
                            const existingDorms = gameState.buildings.filter(b => b.type === BuildingType.DORMITORY).length;
                            const isFree = bType === BuildingType.DORMITORY && existingDorms === 0;
                            const finalCost = isFree ? 0 : info.baseCost;
                            const canAfford = gameState.credits >= finalCost;

                            return (
                                <button
                                    key={bType}
                                    onClick={() => onBuild(selectedSlotId, bType)}
                                    disabled={!canAfford}
                                    className={`flex flex-col p-4 rounded-xl border transition-all text-left group h-full
                                        ${canAfford 
                                            ? 'bg-slate-800/50 border-slate-600 hover:bg-slate-700 hover:border-blue-400 hover:shadow-lg' 
                                            : 'bg-slate-950/50 border-slate-800 opacity-50 cursor-not-allowed'}
                                    `}
                                >
                                    <div className="flex justify-between w-full mb-2 items-center">
                                        <span className={`font-bold ${canAfford ? 'text-blue-100' : 'text-gray-500'}`}>{info.label}</span>
                                        <span className={`font-mono px-2 py-0.5 rounded text-xs ${isFree ? 'bg-green-500/20 text-green-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                                            {isFree ? 'FREE' : `$${finalCost}`}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">{info.desc}</p>
                                </button>
                            )
                        })}
                    </div>
                </>
            )}

            {isBuildingMenu && selectedSlot && selectedSlot.type && (
                <div className="flex flex-col gap-4">
                    {/* Header with Upgrade/Work controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-4 pr-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/50">
                                <Hammer className="text-blue-400" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{BUILDING_COSTS[selectedSlot.type].label}</h2>
                                <p className="text-gray-400 text-sm">Level {selectedSlot.level} • Operational</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                             {/* WORKER TOGGLE */}
                             {selectedSlot.maxWorkers > 0 && (
                                 <button
                                    onClick={() => onToggleWorkers(selectedSlot.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all
                                        ${selectedSlot.workersEnabled 
                                            ? 'bg-green-900/50 border-green-700 text-green-300 hover:bg-green-800/50' 
                                            : 'bg-red-900/20 border-red-900 text-red-400 hover:bg-red-900/30'
                                        }
                                    `}
                                 >
                                    <UserCog size={16} />
                                    <div>
                                        <div>{selectedSlot.workersEnabled ? 'WORKERS: ON' : 'WORKERS: OFF'}</div>
                                        <div className="font-mono">{selectedSlot.assignedWorkers.length} / {selectedSlot.maxWorkers}</div>
                                    </div>
                                 </button>
                             )}

                             {/* UPGRADE BUTTON */}
                             {UPGRADE_COSTS[selectedSlot.type] && (
                                <button
                                    onClick={() => onUpgradeBuilding(selectedSlot.id)}
                                    disabled={gameState.credits < UPGRADE_COSTS[selectedSlot.type] * selectedSlot.level}
                                    className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 border border-purple-700 rounded-lg hover:bg-purple-800/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ArrowUpCircle className="text-purple-400" size={16} />
                                    <div className="text-left">
                                        <div className="text-xs text-purple-200 font-bold">UPGRADE</div>
                                        <div className="text-[10px] text-purple-400 font-mono">${UPGRADE_COSTS[selectedSlot.type] * selectedSlot.level}</div>
                                    </div>
                                </button>
                             )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                         {UNIT_UNLOCKS[selectedSlot.type].map(uType => {
                             const stats = UNIT_STATS[uType];
                             const currentCost = getUnitCost(uType);
                             const canAfford = gameState.credits >= currentCost;
                             
                             // Cap check
                             const currentCount = gameState.units.filter(u => !UNIT_STATS[u.type].isTool).length;
                             const popFull = !stats.isTool && currentCount >= gameState.maxPopulation;
                             const isFull = popFull;

                             return (
                                <button
                                    key={uType}
                                    onClick={() => onBuyUnit(uType)}
                                    disabled={!canAfford || isFull}
                                    className={`
                                        group relative overflow-hidden p-4 rounded-xl border text-left transition-all duration-200
                                        ${canAfford && !isFull
                                            ? 'bg-slate-800/60 border-slate-600 hover:bg-slate-700 hover:border-blue-500' 
                                            : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed grayscale'}
                                    `}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-slate-200 group-hover:text-white">{stats.label}</span>
                                        <span className="text-xs font-mono text-yellow-300 bg-yellow-900/30 px-2 py-1 rounded">${currentCost}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 grid grid-cols-2 gap-1">
                                        <span>Pow: {stats.power}</span>
                                        <span>{stats.isTool ? 'Yield: High' : `Cap: ${stats.capacity}`}</span>
                                    </div>
                                    {isFull && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-red-400 text-xs font-bold uppercase tracking-widest backdrop-blur-sm">Max Pop</div>}
                                </button>
                             )
                         })}

                         {UNIT_UNLOCKS[selectedSlot.type].length === 0 && (
                             <div className="col-span-3 flex items-center justify-center p-8 border border-dashed border-slate-700 rounded-xl text-gray-500 text-sm">
                                 {selectedSlot.type === BuildingType.CRUSHER 
                                    ? "Assign workers here (Upgrade Lv 2) to boost processing speed." 
                                    : "No recruitment available for this facility."}
                             </div>
                         )}
                    </div>
                </div>
            )}

          </div>
        </div>
      )}
    </>
  );
};

export default Overlay;