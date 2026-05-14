import { useState } from "react"
import { FileText, User, MapPin, Wrench, Users, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SearchableSelect } from "@/components/analysis/SearchableSelect"

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

export function MetadataTab() {
  const [oem, setOem] = useState("")
  const [vehicle, setVehicle] = useState("")
  const [track, setTrack] = useState("")
  const [engineer, setEngineer] = useState("")
  const [analyst, setAnalyst] = useState("")
  const [euroNcap, setEuroNcap] = useState(false)

  return (
    <div className="flex items-start justify-center h-full p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Metadata</h3>
            <p className="text-sm text-muted-foreground tracking-tight">Project information</p>
          </div>
        </div>

        {/* All fields in a single frame */}
        <div className="flex flex-col gap-5 rounded-xl bg-surface-2 border border-white/5 p-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="oem" className="text-sm font-medium text-foreground flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-muted-foreground" /> OEM
            </Label>
            <SearchableSelect
              value={oem}
              onChange={setOem}
              placeholder="Select OEM"
              items={oems}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="vehicle" className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" /> Vehicle
            </Label>
            <Input
              id="vehicle"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="VW Golf 8"
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="track" className="text-sm font-medium text-foreground flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Track
            </Label>
            <SearchableSelect
              value={track}
              onChange={setTrack}
              placeholder="Select track"
              groups={[
                { label: "HQ", items: hqTracks },
                { label: "ICPG", items: icpgTracks },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="engineer" className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground" /> Engineer
            </Label>
            <Input
              id="engineer"
              value={engineer}
              onChange={(e) => setEngineer(e.target.value)}
              placeholder="Firstname Lastname"
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="analyst" className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" /> Analyst
            </Label>
            <Input
              id="analyst"
              value={analyst}
              onChange={(e) => setAnalyst(e.target.value)}
              placeholder="Firstname Lastname"
              className="h-9"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="euro-ncap" className="text-sm font-medium text-foreground flex items-center gap-2 cursor-pointer">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> Euro NCAP
            </Label>
            <Switch
              id="euro-ncap"
              checked={euroNcap}
              onCheckedChange={setEuroNcap}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
