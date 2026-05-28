import { useState, useCallback, useRef } from "react"
import { FileText, User, MapPin, Wrench, Users, ShieldCheck, Car } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SearchableSelect } from "@/components/analysis/SearchableSelect"
import { useAppStore } from "@/store/useAppStore"

const oems = [
  "Acura", "Aisin", "Aito", "Alfa Romeo", "AMG", "APPLUS+IDIADA", "Aptiv",
  "Aston Martin", "Audi", "Bentley", "BMW", "Bosch", "Brembo", "Bridgestone",
  "Buick", "BYD", "CEVT", "Chery", "Chevrolet", "Continental", "Cupra",
  "Deepal", "Denso", "DFSK", "Dongfeng", "driveBUDDY AI", "EuroNCAP", "Exeed",
  "FAW", "FCA", "Ferrari", "Fiat", "Fisker", "Ford", "Ford Otosan", "Forvia",
  "Gaz", "Geely", "General Motors", "Goodyear", "Great Wall", "Hirige",
  "Hitachi", "Honda", "Hongqi", "Huawei", "Hyundai", "Hyundai Mobis", "INEOS",
  "Infiniti", "ISUZU", "JAC Motors", "JAECOO", "Jaguar", "JiXiang", "JLR",
  "KGM", "KIA", "Lamborghini", "Land Rover", "LeapMotor", "Lexus", "LG",
  "Lincoln", "Lotus", "Lucid", "Magna", "Mahindra", "Maserati", "Maxus",
  "Mazda", "McLaren", "Mercedes-AMG", "Mercedes-Benz", "MG", "Michelin",
  "Mini", "Mitsubishi", "NIO", "Nissan", "Novelic", "Nvidia", "OMODA", "Opel",
  "Peugeot", "Piaggio", "Pirelli", "Polestar", "Porsche", "Renault", "Rivian",
  "SAIC", "Saint Gobain", "Samsung", "SEAT", "Seeing Machines", "Seres",
  "Smart", "SmartEye", "Sony", "Stellantis", "Subaru", "Suzuki", "TATA", "TEQ",
  "Tesla", "Togg", "Toyota", "Valeo", "Vinfast", "Volkswagen", "Volvo",
  "Weichai", "Xiaomi", "XPENG", "Zeekr", "ZF",
]

const hqTracks = [
  "(0) Highway Loop",
  "(0A) Highway Loop A",
  "(0B) Highway Loop B",
  "(1) High-Speed Circuit",
  "(2) External Noise Track",
  "(3) Fatigue/Comfort A",
  "(4) Dynamic Platform A",
  "(5) Dry Handling Circuit",
  "(5B) Dynamic Platform C",
  "(6) Test Hills",
  "(7) Straight Line Braking",
  "(7B) Comfort B & Sim City",
  "(8) Urban Area ADAS/CAV 2",
  "(9) Dynamic Platform B",
  "(10) Off-Road Track",
  "(11) Wet Circle",
  "(12) Wet Handling Circuit",
  "(13) Misuse Area",
  "(14) ADAS/CAV 1",
  "(15) ADAS/CAV 3",
]

const icpgTracks = [
  "(1) High Speed Circuit",
  "(2) External Noise Track",
  "(3) Dynamic Platform",
  "(4) Straight Line Braking",
  "(4B) SLB Dry",
  "(5) NVH and Comfort",
  "(6) Multipurpose",
  "(7) Off-road",
  "(8) Dry Handling",
  "(9) Wet Handling",
  "(10) Wet Circle",
  "(11) Drift and pull",
  "(12) KERBS",
  "(13) Durability & Fatigue",
  "(14) General Road",
  "(15) Test Hills",
  "(16) SLB B",
  "(17) Bend Line Braking",
]

interface SVGPathInfo {
  viewBox: string
  paths: string[]
}

const backgroundSVGs: Record<string, SVGPathInfo> = {
  oem: {
    viewBox: "0 0 100 100",
    paths: [
      // Shield outline
      "M 50 15 L 80 25 L 80 55 C 80 75 50 88 50 88 C 50 88 20 75 20 55 L 20 25 Z",
      // Wrench/Industrial Emblem
      "M 35 35 H 65",
      "M 35 45 H 65",
      "M 42 55 L 50 63 L 58 55",
      "M 50 30 V 72"
    ]
  },
  vehicle: {
    viewBox: "0 0 100 100",
    paths: [
      // Sleek outline of a modern sports car profile
      "M 15 65 H 85 L 82 56 L 68 53 C 60 48, 55 35, 45 35 C 32 35, 28 48, 22 52 L 18 56 Z",
      // Front wheel
      "M 32 65 A 6.5 6.5 0 1 1 32 64.9",
      // Rear wheel
      "M 68 65 A 6.5 6.5 0 1 1 68 64.9",
      // Center lines / highlights
      "M 25 58 H 75",
      "M 38 52 C 48 50, 52 50, 62 52"
    ]
  },
  track: {
    viewBox: "0 0 100 100",
    paths: [
      // Double lane winding circuit track
      "M 25 45 C 10 20, 30 15, 45 35 C 55 50, 75 20, 85 45 C 95 70, 75 85, 60 70 C 45 55, 30 80, 20 70 C 10 60, 15 50, 25 45 Z",
      "M 28 48 C 14 24, 32 19, 43 37 C 53 52, 73 24, 83 47 C 91 68, 73 81, 62 68 C 47 55, 32 76, 22 68 C 14 60, 18 52, 28 48"
    ]
  },
  engineer: {
    viewBox: "0 0 100 100",
    paths: [
      // Compass / Caliper design
      "M 30 20 H 70 V 30 H 30 Z",
      "M 35 30 V 85 H 45 V 30 Z",
      "M 45 40 H 52",
      "M 45 48 H 50",
      "M 45 56 H 52",
      "M 45 64 H 50",
      "M 45 72 H 52",
      "M 39 85 V 95",
      "M 60 20 L 60 15",
      "M 65 20 L 65 15"
    ]
  },
  analyst: {
    viewBox: "0 0 100 100",
    paths: [
      // Data analyst node chart
      "M 15 85 H 85 V 15",
      "M 20 75 L 35 55 L 50 65 L 68 35 L 80 45",
      "M 20 75 A 2.5 2.5 0 1 1 20 74.9",
      "M 35 55 A 2.5 2.5 0 1 1 35 54.9",
      "M 50 65 A 2.5 2.5 0 1 1 50 64.9",
      "M 68 35 A 2.5 2.5 0 1 1 68 34.9",
      "M 80 45 A 2.5 2.5 0 1 1 80 44.9",
      "M 68 25 V 45",
      "M 58 35 H 78"
    ]
  },
  euroNcap: {
    viewBox: "0 0 100 100",
    paths: [
      // Double circle safety shield
      "M 50 15 A 35 35 0 1 1 50 85 A 35 35 0 1 1 50 15 Z",
      "M 50 20 A 30 30 0 1 1 50 80 A 30 30 0 1 1 50 20 Z",
      "M 50 35 L 54 44 H 64 L 56 50 L 59 59 L 50 53 L 41 59 L 44 50 L 36 44 H 46 Z",
      "M 25 50 H 35",
      "M 65 50 H 75"
    ]
  }
}

type ActiveFieldType = "oem" | "vehicle" | "track" | "engineer" | "analyst" | "euroNcap"

export function MetadataTab() {
  const {
    analysisOem,
    setAnalysisOem,
    analysisVehicle,
    setAnalysisVehicle,
    analysisTrack,
    setAnalysisTrack,
    analysisEngineer,
    setAnalysisEngineer,
    analysisAnalyst,
    setAnalysisAnalyst,
    analysisEuroNcap,
    setAnalysisEuroNcap,
  } = useAppStore()
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeField, setActiveField] = useState<ActiveFieldType>("oem")
  const setActiveFieldDebounced = useCallback((field: ActiveFieldType) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setActiveField(field), 150);
  }, []);

  return (
    <div className="relative flex items-center justify-center h-full min-h-0 overflow-y-auto p-8 bg-background">
      
      {/* Background Grid & Animation Layer */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {/* Pulsing Grid Backdrop - centered to align coordinates mathematically */}
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          style={{ 
            maskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, #000 70%, transparent 100%)', 
            WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, #000 70%, transparent 100%)' 
          }}
        >
          {/* Base faint grid — pure CSS, dynamic border references */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
          {/* Pulsing brighter grid layer */}
          <div
            className="absolute inset-0 pointer-events-none animate-pulse-sync opacity-80"
            style={{
              backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Soft orange glowing core — pure CSS breathing animation (compositor thread, zero rAF) */}
        <style>{`
          @keyframes glowBreathe {
            0%, 100% { transform: scale(0.9); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 1.0; }
          }
          .glow-breathe { animation: glowBreathe 4s ease-in-out infinite; }
        `}</style>
        <div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.05) 0%, rgba(249, 115, 22, 0) 70%)'
          }}
        />

        <AnimatePresence mode="wait">
          {activeField && (
            <motion.div
              key={activeField}
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 0.25, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-[340px] h-[340px] flex items-center justify-center"
            >
              <svg
                viewBox={backgroundSVGs[activeField].viewBox}
                className="w-full h-full text-orange-500 filter drop-shadow-[0_0_15px_rgba(255,107,0,0.3)]"
                fill="none"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <defs>
                  <linearGradient id="corporate-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff6b00" />
                    <stop offset="100%" stopColor="#ffa600" />
                  </linearGradient>
                </defs>
                {backgroundSVGs[activeField].paths.map((d, index) => (
                  <motion.path
                    key={index}
                    d={d}
                    stroke="url(#corporate-orange)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 1.2,
                      ease: "easeInOut",
                      delay: index * 0.08,
                    }}
                  />
                ))}
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-lg space-y-6 relative z-10">
        <div className="flex items-center gap-3">
          {/* Metadata Icon Container with backdrop-blur for grid masking consistency */}
          <div className="w-8 h-8 rounded-lg bg-surface-2/40 border border-white/5 backdrop-blur-md flex items-center justify-center shadow-md">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Metadata</h3>
            <p className="text-sm text-muted-foreground tracking-tight">Project information</p>
          </div>
        </div>

        {/* Glassmorphic blur frame container */}
        <div className="flex flex-col gap-5 rounded-2xl bg-surface-2/20 border border-white/5 p-6 shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300">
          
          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('oem')}
            onClickCapture={() => setActiveFieldDebounced('oem')}
          >
            <Label htmlFor="oem" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <Wrench className="w-3.5 h-3.5 text-muted-foreground" /> OEM
            </Label>
            <SearchableSelect
              value={analysisOem}
              onChange={setAnalysisOem}
              placeholder="Select OEM"
              items={oems}
            />
          </div>

          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('vehicle')}
          >
            <Label htmlFor="vehicle" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <Car className="w-3.5 h-3.5 text-muted-foreground" /> Vehicle
            </Label>
            <Input
              id="vehicle"
              value={analysisVehicle}
              onChange={(e) => setAnalysisVehicle(e.target.value)}
              placeholder="VW Golf 8"
              className="h-9 focus-visible:ring-orange-500"
            />
          </div>

          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('track')}
            onClickCapture={() => setActiveFieldDebounced('track')}
          >
            <Label htmlFor="track" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Track
            </Label>
            <SearchableSelect
              value={analysisTrack}
              onChange={setAnalysisTrack}
              placeholder="Select track"
              allowCustom={true}
              groups={[
                { label: "HQ", items: hqTracks },
                { label: "ICPG", items: icpgTracks },
              ]}
            />
          </div>

          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('engineer')}
          >
            <Label htmlFor="engineer" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <User className="w-3.5 h-3.5 text-muted-foreground" /> Engineer
            </Label>
            <Input
              id="engineer"
              value={analysisEngineer}
              onChange={(e) => setAnalysisEngineer(e.target.value)}
              placeholder="Firstname Lastname"
              className="h-9 focus-visible:ring-orange-500"
            />
          </div>

          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('analyst')}
          >
            <Label htmlFor="analyst" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <Users className="w-3.5 h-3.5 text-muted-foreground" /> Analyst
            </Label>
            <Input
              id="analyst"
              value={analysisAnalyst}
              onChange={(e) => setAnalysisAnalyst(e.target.value)}
              placeholder="Firstname Lastname"
              className="h-9 focus-visible:ring-orange-500"
            />
          </div>

          <div 
            className="flex items-center justify-between group/field py-1"
            onClickCapture={() => setActiveFieldDebounced('euroNcap')}
          >
            <Label htmlFor="euro-ncap" className="text-sm font-medium text-foreground flex items-center gap-2 cursor-pointer select-none">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> Euro NCAP
            </Label>
            <Switch
              id="euro-ncap"
              checked={analysisEuroNcap}
              onCheckedChange={setAnalysisEuroNcap}
              onFocus={() => setActiveField('euroNcap')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
