import { motion } from 'motion/react';

export const LandingPage = ({ onEnter }: { onEnter: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
      className="fixed inset-0 bg-[#f5f1e8] z-[100] flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={onEnter}
    >
      {/* Floating Icon */}
      <motion.div
        animate={{ 
            y: [0, -15, 0],
            rotate: [0, 1, 0, -1, 0] 
        }}
        transition={{ 
            duration: 6, 
            repeat: Infinity, 
            ease: "easeInOut" 
        }}
        className="relative mb-12"
      >
        {/* The Icon SVG */}
        <svg width="280" height="280" viewBox="0 0 240 240" className="overflow-visible">
             <defs>
                {/* Chalky filter for the icon elements if desired, or smoother for ink */}
                <filter id="chalk-landing">
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
                </filter>
                
                {/* Smoother pen/ink style filter for text */}
                <filter id="pen-landing">
                    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" />
                </filter>
             </defs>
             
             {/* Icon Group - Keeping chalky texture for the art as implied by the image, or switching if 'icon' also needs to be smooth. 
                 The user said "Hush to Hues text ... change to hand-drawn". 
                 I'll keep the icon slightly textured but improve the face shape.
             */}
             <g style={{ filter: 'url(#chalk-landing)' }}>
                {/* 1. Profile Face (Facing Left) - Redrawn for better proportions */}
                <path 
                    d="M 130 60 
                       Q 110 60 100 80 
                       Q 95 90 85 95   
                       L 75 105        
                       L 85 110        
                       Q 80 115 80 120 
                       Q 80 135 95 140 
                       Q 115 145 140 130" 
                    fill="none" 
                    stroke="#1a1a1a" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                
                {/* Closed Eye (Simple curve) */}
                <path d="M 90 100 Q 100 105 110 98" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
                
                {/* REMOVED: The vertical finger line */}

                {/* 2. Hair / Thoughts (Flowing Right) */}
                
                {/* Strand 1 - Red */}
                <motion.path 
                    d="M 130 60 Q 160 40 190 70 T 230 60" 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.5 }}
                />
                
                {/* Strand 2 - Blue */}
                <motion.path 
                    d="M 140 130 Q 170 140 200 120 T 230 110" 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.7 }}
                />
                
                {/* Strand 3 - Yellow (Middle flow) */}
                <motion.path 
                    d="M 140 95 C 160 95, 170 80, 190 90 C 210 100, 220 80, 235 90" 
                    fill="none" 
                    stroke="#eab308" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.9 }}
                />
                
                {/* Abstract Cloud Elements */}
                 <motion.g
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    <path 
                        d="M 190 50 Q 220 30 240 60" 
                        fill="none" 
                        stroke="#1a1a1a" 
                        strokeWidth="2"
                        strokeDasharray="4, 6"
                        opacity="0.6"
                    />
                     <circle cx="210" cy="70" r="8" fill="#ef4444" opacity="0.4" />
                     <circle cx="230" cy="100" r="12" fill="#3b82f6" opacity="0.4" />
                </motion.g>
             </g>
        </svg>
      </motion.div>
      
      {/* Title Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="mt-4 text-center flex flex-col items-center"
      >
        <div className="relative">
            <h1 
                className="flex items-baseline justify-center gap-[4px] select-none text-[#1a1a1a] flex-wrap relative z-10 scale-150 origin-center font-black"
                style={{ filter: 'url(#pen-landing)' }} 
            >
                {/* Hush */}
                <span className="text-5xl handwritten -rotate-2 translate-y-0.5 opacity-100">H</span>
                <span className="text-5xl handwritten rotate-1 -translate-y-0.5 opacity-100">u</span>
                <span className="text-5xl handwritten -rotate-1 translate-y-1 opacity-100">s</span>
                <span className="text-5xl handwritten rotate-2 opacity-100">h</span>
                
                <span className="w-4"></span>

                {/* to */}
                <span className="text-3xl handwritten -rotate-3 translate-y-0.5 opacity-100">t</span>
                <span className="text-3xl handwritten rotate-3 -translate-y-1 opacity-100">o</span>

                <span className="w-4"></span>

                {/* Hues */}
                <span className="text-5xl handwritten rotate-1 translate-y-1 opacity-100">H</span>
                <span className="text-5xl handwritten -rotate-2 -translate-y-0.5 opacity-100">u</span>
                <span className="text-5xl handwritten rotate-1 translate-y-0.5 opacity-100">e</span>
                <span className="text-5xl handwritten -rotate-1 opacity-100">s</span>
            </h1>
        </div>

        <p className="mt-4 text-[#6d6d6d] handwritten text-2xl opacity-80 font-bold">where thoughts speak aloud</p>
      </motion.div>
    </motion.div>
  );
};