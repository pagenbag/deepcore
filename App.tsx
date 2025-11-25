
import React, { useEffect, useRef, useState } from 'react';
import AsteroidCanvas from './components/AsteroidCanvas';
import Overlay from './components/Overlay';
import { GameEngine } from './game/GameEngine';

const App: React.FC = () => {
  // The Engine instance (ref because we don't want to recreate it on render)
  const engineRef = useRef<GameEngine>(new GameEngine());
  
  // React State to force re-renders
  const [tick, setTick] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [targetRotation, setTargetRotation] = useState<number | null>(null);

  useEffect(() => {
    const loop = setInterval(() => {
      const engine = engineRef.current;
      engine.tick();
      
      // Handle Auto-Rotation Logic in View layer or simple visual update
      if (targetRotation !== null) {
          let diff = targetRotation - rotation;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          if (Math.abs(diff) < 0.5) setRotation(targetRotation);
          else setRotation(r => r + diff * 0.1);
      }
      
      setTick(t => t + 1);
    }, 16); // 60 FPS

    return () => clearInterval(loop);
  }, [rotation, targetRotation]);

  const handleSelectSlot = (id: number) => {
      setSelectedSlot(id);
      const slot = engineRef.current.buildings.find(b => b.id === id);
      if (slot) setTargetRotation(-slot.angle);
  };

  const handleManualRotate = (val: number | ((prev: number) => number)) => {
      setTargetRotation(null);
      setRotation(val);
  };

  return (
    <div className="relative w-full h-full bg-black">
      <AsteroidCanvas 
        engine={engineRef.current} 
        tickVersion={tick}
        rotation={rotation}
        setRotation={handleManualRotate}
        onSelectSlot={handleSelectSlot}
      />
      <Overlay 
        engine={engineRef.current}
        tickVersion={tick}
        selectedSlotId={selectedSlot}
        onCloseBuildMenu={() => { setSelectedSlot(null); setTargetRotation(null); }}
        onToggleDebug={() => { engineRef.current.globalMultiplier = engineRef.current.globalMultiplier > 1 ? 1 : 10; }}
      />
    </div>
  );
};

export default App;
