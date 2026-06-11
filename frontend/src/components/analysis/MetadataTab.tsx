import { useMemo } from "react"
import { User, MapPin, Wrench, Users, ShieldCheck, Car } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SearchableSelect } from "@/components/analysis/SearchableSelect"
import { useAppStore } from "@/store/useAppStore"
import { LogoLoop } from "@/components/ui/LogoLoop"

// Dynamically scan the frontend/public/assets/logos folder using Vite's glob import
const logoModules = import.meta.glob(
  "/public/assets/logos/*.{png,jpeg,jpg,webp,svg}",
  { eager: true }
);

// Map paths to OEM names and URLs
const oemData = Object.keys(logoModules).map((path) => {
  const filename = path.split("/").pop() || "";
  const dotIndex = filename.lastIndexOf(".");
  const name = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
  
  // Convert public path (e.g. "/public/assets/logos/Acura.png") to served URL (e.g. "/assets/logos/Acura.png")
  const url = path.replace(/^\/public/, "");
  
  return { name, url };
});

// Sort OEMs alphabetically
oemData.sort((a, b) => a.name.localeCompare(b.name));

const oems = oemData.map((item) => item.name);
const oemMap = new Map(oemData.map((item) => [item.name, item.url]));

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
  "(18) Winding Road",
]

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
  
  const getOemLogoUrl = (oem: string) => {
    return oemMap.get(oem) || "";
  };

  const allLogoItems = useMemo(() => {
    return oems.map(oem => ({
      src: getOemLogoUrl(oem),
      alt: oem,
      title: oem
    }));
  }, []);

  const row1 = useMemo(() => allLogoItems.slice(0, 24), [allLogoItems]);
  const row2 = useMemo(() => allLogoItems.slice(24, 48), [allLogoItems]);
  const row3 = useMemo(() => allLogoItems.slice(48, 72), [allLogoItems]);
  const row4 = useMemo(() => allLogoItems.slice(72, 96), [allLogoItems]);
  const row5 = useMemo(() => allLogoItems.slice(96), [allLogoItems]);

  return (
    <div className="relative flex items-center justify-center h-full min-h-0 overflow-y-auto p-8 bg-background">
      
      {/* Background Logo Mosaic Layer */}
      <div className="absolute inset-0 z-0 flex flex-col justify-around pointer-events-none overflow-hidden opacity-[0.16] dark:opacity-[0.32] select-none py-8">
        <LogoLoop logos={row1} speed={10} direction="left" logoHeight={32} gap={48} />
        <LogoLoop logos={row2} speed={8} direction="right" logoHeight={32} gap={48} />
        <LogoLoop logos={row3} speed={12} direction="left" logoHeight={32} gap={48} />
        <LogoLoop logos={row4} speed={7} direction="right" logoHeight={32} gap={48} />
        <LogoLoop logos={row5} speed={9} direction="left" logoHeight={32} gap={48} />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Glassmorphic blur frame container */}
        <div className="flex flex-col gap-5 rounded-2xl bg-surface-2/20 border border-white/5 p-6 shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300">
          
          <div className="flex flex-col gap-2 group/field">
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

          <div className="flex flex-col gap-2 group/field">
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

          <div className="flex flex-col gap-2 group/field">
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

          <div className="flex flex-col gap-2 group/field">
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

          <div className="flex flex-col gap-2 group/field">
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

          <div className="flex items-center justify-between group/field py-1">
            <Label htmlFor="euro-ncap" className="text-sm font-medium text-foreground flex items-center gap-2 cursor-pointer select-none">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> Euro NCAP
            </Label>
            <Switch
              id="euro-ncap"
              checked={analysisEuroNcap}
              onCheckedChange={setAnalysisEuroNcap}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
