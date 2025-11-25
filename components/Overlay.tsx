
import React, { useState, useEffect } from 'react';
import { GameEngine } from '../game/GameEngine';
import { BuildingType, UnitType } from '../types';
import { BUILDING_CONFIG, UNIT_BASE_STATS, UNIT_UNLOCKS } from '../config';
import { UPGRADE_CATALOG } from '../game/Upgrades';
import { Coins, Clock, ScrollText, Mountain, Users, Pickaxe, X, Hammer, UserCog, Zap } from 'lucide-react';

interface OverlayProps {
  engine: GameEngine;
  tickVersion: number;
  selectedSlotId: number | null;
  onCloseBuildMenu: () => void;
  onToggleDebug?: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ engine, selectedSlotId, onCloseBuildMenu }) => {
  const [activeTab, setActiveTab] = useState<'RECRUIT' | 'UPGRADES' | 'WORKERS' | 'ACTIONS'>('RECRUIT');
  const [showDebug, setShowDebug] = useState(false);

  const selectedSlot = engine.buildings.find(b => b.id === selectedSlotId);
  const isBuildingMenu = selectedSlot && selectedSlot.type !== null;

  // Tabs Logic
  useEffect(() => {
    if (isBuildingMenu) {
        if (selectedSlot.type === BuildingType.LAUNCHPAD) setActiveTab('ACTIONS');
        else if (UNIT_UNLOCKS[selectedSlot.type!].length > 0) setActiveTab('RECRUIT');
        else setActiveTab('UPGRADES');
    }
  }, [selectedSlotId]);

  const taxRemaining = Math.max(0, Math.floor((engine.taxTimer - Date.now())/1000));
  const justPaid = (Date.now() - engine.lastTaxPaid) < 3000;
  
  return (
    <>
      {/* HEADER */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-start z-50 pointer-events-none">
         <div className="flex gap-4 pointer-events-auto flex-wrap">
             <Badge icon={<Coins className="text-yellow-400" size={18}/>} label="Credits" value={`$${Math.floor(engine.credits).toLocaleString()}`} />
             <div className={`bg-slate-900/90 border p-2 px-4 rounded-full flex gap-3 shadow-xl backdrop-blur transition-colors ${engine.taxDue ? 'border-red-500 animate-pulse' : justPaid ? 'border-yellow-400' : 'border-slate-700'}`}>
                 <Clock className={engine.taxDue ? "text-red-500" : "text-gray-400"} size={18} />
                 <div><div className="text-[10px] text-gray-500 font-bold">TAX</div><div className="text-lg font-mono text-white">${engine.taxAmount} <span className="text-xs">({Math.floor(taxRemaining/60)}:{taxRemaining%60})</span></div></div>
             </div>
             <Badge icon={<ScrollText className="text-purple-400" size={18}/>} label="Permits" value={engine.environment.miningPermits} />
             <Badge icon={<Mountain className="text-orange-500" size={18}/>} label="Ore" value={`${Math.floor(engine.surfaceOre)} / ${Math.floor(engine.looseOreInMine)}`} />
             <Badge icon={<Pickaxe className="text-gray-400" size={18}/>} label="Depth" value={`${engine.mineDepth * 5}m`} />
         </div>
         <button onClick={() => setShowDebug(!showDebug)} className="pointer-events-auto bg-slate-800 text-xs px-2 py-1 rounded text-gray-400 hover:text-white">DEBUG</button>
      </div>
      
      {/* DEBUG PANEL */}
      {showDebug && (
        <div className="absolute top-16 right-4 z-50 bg-slate-900 border border-slate-700 p-4 rounded shadow-xl flex flex-col gap-2 pointer-events-auto">
            <h3 className="text-xs font-bold text-gray-500">DEBUG TOOLS</h3>
            <button onClick={() => engine.addCredits(1000)} className="px-3 py-2 bg-green-900/50 hover:bg-green-800 rounded text-xs text-green-200 border border-green-700">+$1,000 Credits</button>
            <button onClick={() => engine.globalMultiplier = engine.globalMultiplier === 1 ? 5 : 1} className="px-3 py-2 bg-blue-900/50 hover:bg-blue-800 rounded text-xs text-blue-200 border border-blue-700 flex justify-between gap-4">
                <span>Toggle Speed</span> <span className="font-bold">{engine.globalMultiplier}x</span>
            </button>
        </div>
      )}

      {/* BOTTOM PANEL */}
      {selectedSlotId !== null && (
          <div className="absolute bottom-0 w-full p-6 flex justify-center z-50 pointer-events-none">
              <div className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl p-6 pointer-events-auto relative">
                  <button onClick={onCloseBuildMenu} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white z-50"><X size={24}/></button>
                  
                  {/* Tax Lock */}
                  {engine.taxDue && <div className="absolute inset-0 bg-slate-950/90 z-40 flex items-center justify-center flex-col text-red-500 font-bold text-xl rounded-2xl"><div>OPERATIONS SUSPENDED</div><div className="text-sm text-gray-400">Pay Tax to Resume</div></div>}

                  {/* BUILD MENU */}
                  {!isBuildingMenu && (
                      <>
                        <h2 className="text-2xl font-bold text-white mb-4">Construction Site</h2>
                        <div className="grid grid-cols-4 gap-4">
                            {Object.values(BuildingType).map(t => {
                                if (t === BuildingType.LAUNCHPAD && !selectedSlot?.isLaunchpadSlot) return null; // Only allow launchpad on specific slot
                                if (t !== BuildingType.LAUNCHPAD && selectedSlot?.isLaunchpadSlot) return null; // Launchpad slot only builds launchpad
                                
                                const conf = BUILDING_CONFIG[t];
                                const cost = conf.baseCost; 
                                return (
                                    <button key={t} onClick={() => engine.constructBuilding(selectedSlotId, t)} disabled={engine.credits < cost}
                                        className={`p-4 rounded border text-left flex flex-col ${engine.credits >= cost ? 'bg-slate-800 hover:bg-slate-700 border-slate-600' : 'bg-slate-950 opacity-50'}`}>
                                        <div className="font-bold text-blue-100">{conf.label}</div>
                                        <div className="text-xs text-yellow-400 mb-1">${cost}</div>
                                        <div className="text-[10px] text-gray-400">{conf.desc}</div>
                                    </button>
                                );
                            })}
                        </div>
                      </>
                  )}

                  {/* BUILDING DETAILS */}
                  {isBuildingMenu && selectedSlot.type && (
                      <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                              <div className="p-2 bg-blue-500/20 rounded"><Hammer className="text-blue-400" size={24}/></div>
                              <div>
                                  <h2 className="text-2xl font-bold text-white">{BUILDING_CONFIG[selectedSlot.type].label}</h2>
                                  <p className="text-gray-400 text-sm">Level {selectedSlot.level}</p>
                              </div>
                          </div>

                          <div className="flex gap-2 border-b border-gray-800 mb-2">
                              {UNIT_UNLOCKS[selectedSlot.type].length > 0 && <TabBtn label="RECRUIT" active={activeTab==='RECRUIT'} onClick={()=>setActiveTab('RECRUIT')} />}
                              {UPGRADE_CATALOG.some(u => u.buildingType === selectedSlot.type) && <TabBtn label="UPGRADES" active={activeTab==='UPGRADES'} onClick={()=>setActiveTab('UPGRADES')} />}
                              {selectedSlot.getMaxWorkers(engine) > 0 && <TabBtn label="WORKERS" active={activeTab==='WORKERS'} onClick={()=>setActiveTab('WORKERS')} />}
                              {selectedSlot.type === BuildingType.LAUNCHPAD && <TabBtn label="ACTIONS" active={activeTab==='ACTIONS'} onClick={()=>setActiveTab('ACTIONS')} />}
                          </div>

                          {activeTab === 'RECRUIT' && (
                              <div className="grid grid-cols-3 gap-4">
                                  {UNIT_UNLOCKS[selectedSlot.type].map(uType => {
                                      const cost = engine.getUnitCost(uType);
                                      return (
                                          <button key={uType} onClick={()=>engine.buyUnit(uType)} disabled={engine.credits < cost}
                                              className={`p-4 rounded border text-left ${engine.credits >= cost ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-950 opacity-50'}`}>
                                              <div className="font-bold text-white">{UNIT_BASE_STATS[uType].label}</div>
                                              <div className="text-yellow-400 font-mono text-sm">${cost}</div>
                                          </button>
                                      )
                                  })}
                              </div>
                          )}

                          {activeTab === 'UPGRADES' && (
                              <div className="grid gap-2">
                                  {UPGRADE_CATALOG.filter(u => u.buildingType === selectedSlot.type).map(u => {
                                      const bought = selectedSlot.purchasedUpgrades.includes(u.id);
                                      return (
                                          <button key={u.id} onClick={()=>engine.buyUpgrade(selectedSlot.id, u.id)} disabled={bought || engine.credits < u.cost}
                                              className={`p-3 flex justify-between rounded border ${bought ? 'bg-green-900/20 border-green-800' : 'bg-slate-800 border-slate-600'}`}>
                                              <div className="text-left">
                                                  <div className="text-white font-bold">{u.label}</div>
                                                  <div className="text-gray-400 text-xs">{u.description}</div>
                                              </div>
                                              <div className="text-right">{bought ? <span className="text-green-500 font-bold">OWNED</span> : <span className="text-yellow-400">${u.cost}</span>}</div>
                                          </button>
                                      )
                                  })}
                              </div>
                          )}

                          {activeTab === 'WORKERS' && (
                              <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                                  <div className="flex justify-between mb-4"><span className="text-white font-bold">Slots</span> <span className="text-blue-400 font-mono">{selectedSlot.assignedWorkers.length} / {selectedSlot.requestedWorkers}</span></div>
                                  <div className="flex gap-2">
                                      {Array.from({length: selectedSlot.getMaxWorkers(engine)}).map((_, i) => (
                                          <button key={i} onClick={()=>engine.setWorkerRequest(selectedSlot.id, i < selectedSlot.requestedWorkers ? i : i+1)}
                                              className={`w-12 h-16 rounded border-2 flex items-center justify-center ${i < selectedSlot.requestedWorkers ? 'bg-slate-700 border-blue-500' : 'bg-slate-900 border-slate-700'}`}>
                                              {i < selectedSlot.assignedWorkers.length ? <UserCog className="text-green-400"/> : <div className="w-2 h-2 rounded-full bg-slate-600"/>}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}
                          
                          {activeTab === 'ACTIONS' && (
                              <div className="flex justify-center p-8">
                                  <button onClick={() => engine.prestige()} className="bg-red-600 hover:bg-red-500 text-white font-bold text-xl px-8 py-4 rounded-xl shadow-lg border-2 border-red-400 animate-pulse">
                                      LAUNCH COLONY SHIP
                                      <div className="text-xs font-normal mt-1 text-red-200">Reset Game (Keep Permits)</div>
                                  </button>
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

const Badge = ({ icon, label, value }: any) => (
  <div className="bg-slate-900/90 border border-slate-700 p-2 px-4 rounded-full flex items-center gap-3 shadow-xl backdrop-blur">
    {icon}
    <div><div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">{label}</div><div className="text-lg font-mono text-white leading-none">{value}</div></div>
  </div>
);

const TabBtn = ({ label, active, onClick }: any) => (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-bold border-b-2 ${active ? 'border-blue-500 text-white bg-white/5' : 'border-transparent text-gray-500'}`}>{label}</button>
);

export default Overlay;
