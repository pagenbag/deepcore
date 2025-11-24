import React from 'react';
import { GameState, UnitType, BuildingType } from '../types';
import { UNIT_STATS, BUILDING_COSTS, UNIT_UNLOCKS } from '../constants';
import { Coins, Mountain, Pickaxe, Users, X, Hammer, ArrowUpCircle } from 'lucide-react';

interface OverlayProps {
  gameState: GameState;
  onBuyUnit: (type: UnitType) => void;
  selectedSlotId: number | null;
  onBuild: (slotId: number, type: BuildingType) => void;
  onCloseBuildMenu: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ gameState, onBuyUnit, selectedSlotId, onBuild, onCloseBuildMenu }) => {
  
  const formatNumber = (num: number) => Math.floor(num).toLocaleString();
  
  // Find currently selected slot data
  const selectedSlot = gameState.buildings.find(b => b.id === selectedSlotId);
  const isBuildingMenu = selectedSlot && selectedSlot.type !== null;

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
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Pile</div>
              <div className="text-lg font-mono text-white leading-none">{formatNumber(gameState.surfaceOre)} kg</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 p-2 px-4 rounded-full flex items-center gap-3 shadow-xl backdrop-blur">
            <Users className="text-blue-400" size={18} />
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Pop</div>
              <div className={`text-lg font-mono leading-none ${gameState.units.length >= gameState.maxPopulation ? 'text-red-400' : 'text-white'}`}>
                {gameState.units.length} / {gameState.maxPopulation}
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

      {/* Bottom Center Interaction Panel (Instead of modal overlay, to keep game visible) */}
      {selectedSlotId !== null && (
        <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col items-center justify-end p-6 pointer-events-none">
          <div className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl p-6 pointer-events-auto animate-slideUp relative">
            
            <button onClick={onCloseBuildMenu} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <X size={24} />
            </button>

            {/* --- IF SLOT IS EMPTY: BUILD MENU --- */}
            {!isBuildingMenu && (
                <>
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Construction Site</h2>
                        <p className="text-gray-400 text-sm">Select a facility to construct in this sector.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.values(BuildingType).map((bType) => {
                            const info = BUILDING_COSTS[bType];
                            // Check free habitat condition
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

            {/* --- IF SLOT HAS BUILDING: ACTION MENU --- */}
            {isBuildingMenu && selectedSlot && selectedSlot.type && (
                <>
                    <div className="mb-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/50">
                            <Hammer className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">{BUILDING_COSTS[selectedSlot.type].label}</h2>
                            <p className="text-gray-400 text-sm">Level {selectedSlot.level} • Operational</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                         {/* Recruitment Options */}
                         {UNIT_UNLOCKS[selectedSlot.type].map(uType => {
                             const stats = UNIT_STATS[uType];
                             const canAfford = gameState.credits >= stats.cost;
                             const popFull = gameState.units.length >= gameState.maxPopulation;
                             
                             return (
                                <button
                                    key={uType}
                                    onClick={() => onBuyUnit(uType)}
                                    disabled={!canAfford || popFull}
                                    className={`
                                        group relative overflow-hidden p-4 rounded-xl border text-left transition-all duration-200
                                        ${canAfford && !popFull
                                            ? 'bg-slate-800/60 border-slate-600 hover:bg-slate-700 hover:border-blue-500' 
                                            : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed grayscale'}
                                    `}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-slate-200 group-hover:text-white">{stats.label}</span>
                                        <span className="text-xs font-mono text-yellow-300 bg-yellow-900/30 px-2 py-1 rounded">${stats.cost}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 grid grid-cols-2 gap-1">
                                        <span>Pow: {stats.power}</span>
                                        <span>Cap: {stats.capacity}</span>
                                    </div>
                                    {popFull && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-red-400 text-xs font-bold uppercase tracking-widest backdrop-blur-sm">Full Pop</div>}
                                </button>
                             )
                         })}

                         {/* Placeholder for Upgrades (If no units or extra space) */}
                         {UNIT_UNLOCKS[selectedSlot.type].length === 0 && (
                             <div className="col-span-3 flex items-center justify-center p-8 border border-dashed border-slate-700 rounded-xl text-gray-500 text-sm">
                                 No actions available for this facility yet.
                             </div>
                         )}
                    </div>
                </>
            )}

          </div>
        </div>
      )}
    </>
  );
};

export default Overlay;
