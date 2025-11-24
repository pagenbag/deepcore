
import React, { useState, useEffect } from 'react';
import { GameState, UnitType, BuildingType } from '../types';
import { UNIT_STATS, BUILDING_COSTS, UNIT_UNLOCKS, COST_SCALING_FACTOR, BUILDING_UPGRADES } from '../constants';
import { Coins, Mountain, Pickaxe, Users, X, Hammer, ArrowUpCircle, UserCog, Clock, ScrollText, Bolt } from 'lucide-react';

interface OverlayProps {
  gameState: GameState;
  onBuyUnit: (type: UnitType) => void;
  selectedSlotId: number | null;
  onBuild: (slotId: number, type: BuildingType) => void;
  onCloseBuildMenu: () => void;
  onPurchaseUpgrade: (slotId: number, upgradeId: string) => void;
  onToggleWorkerSlot: (slotId: number, targetCount: number) => void;
  onToggleDebug: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ gameState, onBuyUnit, selectedSlotId, onBuild, onCloseBuildMenu, onPurchaseUpgrade, onToggleWorkerSlot, onToggleDebug }) => {
  const [activeTab, setActiveTab] = useState<'RECRUIT' | 'UPGRADES' | 'WORKERS'>('RECRUIT');

  const formatNumber = (num: number) => Math.floor(num).toLocaleString();
  
  const selectedSlot = gameState.buildings.find(b => b.id === selectedSlotId);
  const isBuildingMenu = selectedSlot && selectedSlot.type !== null;

  const getUnitCost = (type: UnitType) => {
      const count = gameState.units.filter(u => u.type === type).length;
      const base = UNIT_STATS[type].cost;
      return Math.floor(base * Math.pow(COST_SCALING_FACTOR, count));
  };

  const hasUpgrades = selectedSlot && selectedSlot.type && BUILDING_UPGRADES[selectedSlot.type]?.length > 0;
  const hasWorkers = selectedSlot && selectedSlot.maxWorkers > 0;
  const hasRecruit = selectedSlot && selectedSlot.type && UNIT_UNLOCKS[selectedSlot.type] && UNIT_UNLOCKS[selectedSlot.type].length > 0;

  // Reset tab when slot changes
  useEffect(() => {
    if (isBuildingMenu) {
        if (hasRecruit) setActiveTab('RECRUIT');
        else if (hasUpgrades) setActiveTab('UPGRADES');
        else if (hasWorkers) setActiveTab('WORKERS');
    }
  }, [selectedSlotId, isBuildingMenu, hasRecruit, hasUpgrades, hasWorkers]);

  const taxTimeRemaining = Math.max(0, Math.floor((gameState.taxTimer - Date.now()) / 1000));
  const mins = Math.floor(taxTimeRemaining / 60);
  const secs = taxTimeRemaining % 60;
  
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
          
          {/* TAX INDICATOR */}
          <div className={`bg-slate-900/90 border p-2 px-4 rounded-full flex items-center gap-3 shadow-xl backdrop-blur ${gameState.taxDue ? 'border-red-500 animate-pulse' : 'border-slate-700'}`}>
             <Clock className={gameState.taxDue ? "text-red-500" : "text-gray-400"} size={18} />
             <div>
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Tax Due</div>
                <div className={`text-lg font-mono leading-none ${gameState.taxDue ? 'text-red-500' : 'text-gray-300'}`}>
                    ${formatNumber(gameState.taxAmount)} <span className="text-xs">({mins}:{secs < 10 ? '0'+secs : secs})</span>
                </div>
             </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 p-2 px-4 rounded-full flex items-center gap-3 shadow-xl backdrop-blur">
            <ScrollText className="text-purple-400" size={18} />
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Permits</div>
              <div className="text-lg font-mono text-white leading-none">{gameState.miningPermits}</div>
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
               <div className="text-lg font-mono text-white leading-none">{formatNumber(gameState.mineDepth * 10)} m</div>
             </div>
           </div>
        </div>

        {/* Debug Button */}
        <button onClick={onToggleDebug} className="pointer-events-auto bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs px-2 py-1 rounded text-gray-400">DEBUG</button>
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
            
            {/* TAX LOCK MSG */}
            {gameState.taxDue && (
                <div className="absolute inset-0 bg-slate-950/80 z-10 flex flex-col items-center justify-center rounded-2xl backdrop-blur-sm">
                    <div className="text-red-500 font-bold text-2xl mb-2">OPERATIONS SUSPENDED</div>
                    <div className="text-white text-lg">Outstanding Tax Payment Required: ${formatNumber(gameState.taxAmount)}</div>
                    <div className="text-gray-400 text-sm mt-2">All purchasing frozen until payment is auto-deducted.</div>
                </div>
            )}

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
                    {/* Header */}
                    <div className="flex justify-between items-center gap-4 border-b border-gray-800 pb-4 pr-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/50">
                                <Hammer className="text-blue-400" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{BUILDING_COSTS[selectedSlot.type].label}</h2>
                                <p className="text-gray-400 text-sm">Level {selectedSlot.level} • {selectedSlot.status}</p>
                            </div>
                        </div>
                    </div>

                    {/* TABS */}
                    <div className="flex gap-2 mb-2 border-b border-gray-800">
                        {hasRecruit && (
                            <button 
                                onClick={() => setActiveTab('RECRUIT')}
                                className={`px-4 py-2 rounded-t-lg text-sm font-bold border-b-2 transition-colors relative top-[2px] ${activeTab === 'RECRUIT' ? 'border-blue-500 text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                RECRUIT
                            </button>
                        )}
                        {hasUpgrades && (
                            <button 
                                onClick={() => setActiveTab('UPGRADES')}
                                className={`px-4 py-2 rounded-t-lg text-sm font-bold border-b-2 transition-colors relative top-[2px] ${activeTab === 'UPGRADES' ? 'border-purple-500 text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                UPGRADES
                            </button>
                        )}
                        {hasWorkers && (
                            <button 
                                onClick={() => setActiveTab('WORKERS')}
                                className={`px-4 py-2 rounded-t-lg text-sm font-bold border-b-2 transition-colors relative top-[2px] ${activeTab === 'WORKERS' ? 'border-green-500 text-white bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                WORKERS
                            </button>
                        )}
                    </div>

                    {/* RECRUIT CONTENT */}
                    {activeTab === 'RECRUIT' && hasRecruit && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {UNIT_UNLOCKS[selectedSlot.type].map(uType => {
                                const stats = UNIT_STATS[uType];
                                const currentCost = getUnitCost(uType);
                                const canAfford = gameState.credits >= currentCost;
                                
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
                        </div>
                    )}

                    {/* UPGRADES CONTENT */}
                    {activeTab === 'UPGRADES' && hasUpgrades && (
                        <div className="grid grid-cols-1 gap-3">
                            {BUILDING_UPGRADES[selectedSlot.type].map(upgrade => {
                                const purchased = selectedSlot.upgrades.includes(upgrade.id);
                                const canAfford = gameState.credits >= upgrade.cost;

                                return (
                                    <button
                                        key={upgrade.id}
                                        onClick={() => onPurchaseUpgrade(selectedSlot.id, upgrade.id)}
                                        disabled={purchased || !canAfford}
                                        className={`flex items-center justify-between p-3 rounded-lg border 
                                            ${purchased 
                                                ? 'bg-green-900/20 border-green-800 opacity-50' 
                                                : canAfford ? 'bg-slate-800 hover:bg-slate-700 border-slate-600' : 'bg-slate-900 border-slate-800 opacity-50'
                                            }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-sm text-white">{upgrade.label}</div>
                                            <div className="text-xs text-gray-400">{upgrade.desc}</div>
                                        </div>
                                        <div className="text-right">
                                            {purchased ? (
                                                <span className="text-xs font-bold text-green-500">INSTALLED</span>
                                            ) : (
                                                <span className="text-xs font-mono text-yellow-400">${upgrade.cost}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* WORKERS CONTENT */}
                    {activeTab === 'WORKERS' && hasWorkers && (
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                             <div className="flex justify-between items-center mb-4">
                                 <div>
                                     <div className="text-sm font-bold text-white">Assigned Workers</div>
                                     <div className="text-xs text-gray-400">Enable slots to assign idle workers.</div>
                                 </div>
                                 <div className="text-xl font-mono text-blue-400">
                                     {selectedSlot.assignedWorkers.length} / {selectedSlot.requestedWorkers}
                                 </div>
                             </div>

                             <div className="flex gap-2">
                                 {Array.from({ length: selectedSlot.maxWorkers }).map((_, i) => {
                                     const isEnabled = i < selectedSlot.requestedWorkers;
                                     const isOccupied = i < selectedSlot.assignedWorkers.length;
                                     
                                     return (
                                         <button
                                            key={i}
                                            onClick={() => onToggleWorkerSlot(selectedSlot.id, isEnabled ? i : i + 1)}
                                            className={`
                                                w-12 h-16 rounded border-2 flex flex-col items-center justify-center transition-all
                                                ${isEnabled 
                                                    ? 'bg-slate-700 border-blue-500 hover:bg-slate-600' 
                                                    : 'bg-slate-900 border-slate-700 hover:border-gray-500'}
                                            `}
                                         >
                                             {isOccupied ? (
                                                 <UserCog className="text-green-400 animate-pulse" size={20} />
                                             ) : isEnabled ? (
                                                 <div className="w-2 h-2 rounded-full bg-blue-500/50" />
                                             ) : (
                                                 <div className="w-2 h-2 rounded-full bg-slate-800" />
                                             )}
                                             <div className="mt-2 text-[9px] font-mono text-gray-500">#{i+1}</div>
                                         </button>
                                     )
                                 })}
                             </div>
                        </div>
                    )}

                </div>
            )}

          </div>
        </div>
      )}
    </>
  );
};

export default Overlay;
