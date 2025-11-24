import React from 'react';
import { GameState, UnitType, BuildingType } from '../types';
import { UNIT_STATS, BUILDING_COSTS } from '../constants';
import { Coins, Mountain, Pickaxe, Hammer } from 'lucide-react';

interface OverlayProps {
  gameState: GameState;
  onBuyUnit: (type: UnitType) => void;
  selectedBuildingSlot: number | null;
  onBuild: (slotId: number, type: BuildingType) => void;
  onCloseBuildMenu: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ gameState, onBuyUnit, selectedBuildingSlot, onBuild, onCloseBuildMenu }) => {
  
  const formatNumber = (num: number) => Math.floor(num).toLocaleString();

  return (
    <>
      {/* Top Resource Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
        <div className="flex gap-4 pointer-events-auto">
          <div className="bg-slate-800/90 border border-slate-600 p-3 rounded-lg flex items-center gap-3 shadow-xl backdrop-blur">
            <div className="bg-yellow-500/20 p-2 rounded-full"><Coins className="text-yellow-400" size={20} /></div>
            <div>
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Credits</div>
              <div className="text-xl font-mono text-white">${formatNumber(gameState.credits)}</div>
            </div>
          </div>
          
          <div className="bg-slate-800/90 border border-slate-600 p-3 rounded-lg flex items-center gap-3 shadow-xl backdrop-blur">
            <div className="bg-orange-500/20 p-2 rounded-full"><Mountain className="text-orange-400" size={20} /></div>
            <div>
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Surface Ore</div>
              <div className="text-xl font-mono text-white">{formatNumber(gameState.surfaceOre)} kg</div>
            </div>
          </div>

          <div className="bg-slate-800/90 border border-slate-600 p-3 rounded-lg flex items-center gap-3 shadow-xl backdrop-blur">
             <div className="bg-gray-500/20 p-2 rounded-full"><Pickaxe className="text-gray-400" size={20} /></div>
             <div>
               <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Depth</div>
               <div className="text-xl font-mono text-white">{formatNumber(gameState.mineDepth)} m</div>
             </div>
           </div>
        </div>

        {/* Stats Summary */}
        <div className="text-right pointer-events-auto bg-black/40 p-2 rounded text-xs text-gray-400">
            <div>Units: {gameState.units.length}</div>
            <div>Lifetime Mined: {formatNumber(gameState.totalMined)}</div>
        </div>
      </div>

      {/* Recruitment Panel (Left Side) */}
      <div className="absolute left-4 top-32 w-64 flex flex-col gap-2 pointer-events-auto">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-1 flex items-center gap-2">
            <Hammer size={16} /> Recruitment
        </h3>
        
        {Object.values(UnitType).map((type) => {
            const stats = UNIT_STATS[type];
            const canAfford = gameState.credits >= stats.cost;
            return (
                <button
                    key={type}
                    onClick={() => onBuyUnit(type)}
                    disabled={!canAfford}
                    className={`
                        relative overflow-hidden p-3 rounded border text-left transition-all
                        ${canAfford ? 'bg-slate-800 border-slate-600 hover:bg-slate-700 hover:border-slate-500' : 'bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed'}
                    `}
                >
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm">{stats.label}</span>
                        <span className="text-yellow-400 text-xs font-mono">${stats.cost}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 flex gap-2">
                        {stats.capacity > 0 && <span>Cap: {stats.capacity}</span>}
                        {stats.power > 0 && <span>Pow: {stats.power}</span>}
                        <span>Spd: {stats.speed}</span>
                    </div>
                </button>
            )
        })}
      </div>

      {/* Building Construction Modal (Center) */}
      {selectedBuildingSlot !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto">
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Construction Menu</h2>
                <button onClick={onCloseBuildMenu} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(BuildingType).map((bType) => {
                    const info = BUILDING_COSTS[bType];
                    const canAfford = gameState.credits >= info.baseCost;
                    return (
                        <button
                            key={bType}
                            onClick={() => onBuild(selectedBuildingSlot, bType)}
                            disabled={!canAfford}
                            className={`flex flex-col p-4 rounded-lg border text-left transition-all
                                ${canAfford ? 'bg-slate-700 border-slate-500 hover:bg-slate-600 hover:scale-[1.02]' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'}
                            `}
                        >
                            <div className="flex justify-between w-full mb-2">
                                <span className="font-bold text-lg text-blue-200">{info.label}</span>
                                <span className="font-mono text-yellow-400">${info.baseCost}</span>
                            </div>
                            <p className="text-sm text-gray-300">{info.desc}</p>
                        </button>
                    )
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Overlay;
