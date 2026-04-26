import React, { useEffect, useRef, useState } from 'react';
import { Camera, Settings, Maximize, Loader2, Sparkles } from 'lucide-react';
import { initializeHandLandmarker, detectHandOpenness } from './lib/handTracking';
import { ParticleSystem, ShapeType } from './lib/ParticleSystem';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shape, setShape] = useState<ShapeType>('heart');
  const [color, setColor] = useState('#ff3366');
  const [openness, setOpenness] = useState(1);
  const [showWebcam, setShowWebcam] = useState(false);

  useEffect(() => {
    let animationFrame: number;
    let landmarker: any;
    
    const initSpace = async () => {
      try {
        // Init 3D
        if (containerRef.current && !particleSystemRef.current) {
          particleSystemRef.current = new ParticleSystem({
             container: containerRef.current,
             particleCount: 12000,
             color: color
          });
        }
        
        // Init MediaPipe
        landmarker = await initializeHandLandmarker();
        
        // Setup Webcam
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: "user" } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
          
          // Make ready immediately so UI shows up, but only detect once ready
          setIsReady(true);
          
          const waitAndDetect = () => {
             if (videoRef.current && videoRef.current.readyState >= 2) {
                detectLoop();
             } else {
                requestAnimationFrame(waitAndDetect);
             }
          };
          waitAndDetect();
        }
        
      } catch (err: any) {
        console.warn("Hand tracking unavailable, using manual control fallback.", err);
        setError("Camera not available. Drag to explore manually!");
        setIsReady(true);
      }
    };
    
    const detectLoop = () => {
      if (videoRef.current && landmarker && videoRef.current.readyState >= 2) {
        const results = landmarker.detectForVideo(videoRef.current, performance.now());
        const openVal = detectHandOpenness(results);
        
        if (openVal !== null && particleSystemRef.current) {
           setOpenness(openVal);
           particleSystemRef.current.setOpenness(openVal);
        }
      }
      animationFrame = requestAnimationFrame(detectLoop);
    };

    initSpace();

    return () => {
      cancelAnimationFrame(animationFrame);
      if (particleSystemRef.current) {
         particleSystemRef.current.dispose();
      }
    };
  }, []); // Only run once

  // Handlers for UI
  useEffect(() => {
    if (particleSystemRef.current) {
       particleSystemRef.current.setShape(shape);
    }
  }, [shape]);

  useEffect(() => {
    if (particleSystemRef.current) {
       particleSystemRef.current.setColor(color);
    }
  }, [color]);

  const handlePointerMove = (e: React.PointerEvent) => {
    // Fallback: If camera is off or not tracking, allow drag up/down to change openness
    if (e.buttons === 1) {
      const newOpenness = Math.max(0, Math.min(1, 1 - (e.clientY / window.innerHeight)));
      setOpenness(newOpenness);
      if (particleSystemRef.current) {
         particleSystemRef.current.setOpenness(newOpenness);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const shapes: { id: ShapeType, label: string }[] = [
    { id: 'heart', label: 'Heart' },
    { id: 'flower', label: 'Flower' },
    { id: 'saturn', label: 'Saturn' },
    { id: 'fireworks', label: 'Fireworks' },
  ];

  return (
    <div 
      className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans select-none text-white flex flex-col"
      onPointerMove={handlePointerMove}
    >
      {/* 3D Container */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 z-0" 
      />

      {/* Loading Overlay */}
      {!isReady && !error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] bg-opacity-90">
          <Loader2 className="w-10 h-10 animate-spin text-white mb-4" />
          <p className="text-gray-300 tracking-wider">INITIALIZING REALITY ENGINE</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/20 text-red-100 px-6 py-2 rounded-full border border-red-500/50 backdrop-blur-md">
          {error}
        </div>
      )}

      {/* Hidden WebCam for Tracking */}
      <video 
        ref={videoRef} 
        className={`absolute bottom-4 left-4 w-48 h-36 object-cover rounded-xl border border-white/10 shadow-2xl transition-opacity duration-300 ${showWebcam ? 'opacity-100' : 'opacity-0'} pointer-events-none z-10 scale-x-[-1]`} 
        playsInline 
      />

      {/* UI Overlay */}
      {isReady && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6">
          
          {/* Top Bar */}
          <header className="flex justify-between items-center opacity-80 transition-opacity hover:opacity-100 pointer-events-auto">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-white" />
              <h1 className="text-sm font-semibold tracking-[0.2em] font-mono text-white/90">
                GESTURE.SYS
              </h1>
            </div>
            
            <button 
              onClick={toggleFullscreen}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-95"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </header>

          {/* Bottom Bar Controls */}
          <div className="max-w-2xl w-full mx-auto p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl pointer-events-auto shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Shape Selector */}
            <div className="flex space-x-1 bg-white/5 p-1 rounded-xl w-full md:w-auto">
              {shapes.map(s => (
                <button
                  key={s.id}
                  onClick={() => setShape(s.id)}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    shape === s.id 
                    ? 'bg-white text-black shadow-sm' 
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end">
              {/* Color Picker Container */}
              <div className="flex items-center space-x-3 bg-white/5 py-1 px-3 rounded-xl">
                <span className="text-xs uppercase font-mono tracking-wider text-white/50">Hue</span>
                <div className="relative group w-8 h-8 rounded-full overflow-hidden shadow-inner ring-1 ring-white/20">
                  <input 
                    type="color" 
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute -inset-2 w-12 h-12 cursor-pointer border-none p-0 outline-none"
                  />
                </div>
              </div>

              {/* Status & Options */}
              <div className="flex items-center space-x-3 border-l border-white/10 pl-6">
                
                {/* Visual indicator of openness */}
                <div className="flex items-center space-x-2 hint-tooltip" title="Hand Openness">
                   <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-100 ease-out" 
                        style={{ width: `${openness * 100}%` }}
                      />
                   </div>
                </div>

                <button 
                  onClick={() => setShowWebcam(!showWebcam)}
                  className={`p-2 rounded-lg transition-colors ${showWebcam ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'}`}
                  title="Toggle Camera Feed"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default App;
