import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileText, User, Car, MapPin, ClipboardList, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";

export function ReportTab() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    oem: "Applus IDIADA",
    vehicle: "",
    track: "",
    engineer: "",
    analyst: "",
    euroNcap: true
  });

  const nextStep = () => setStep(prev => Math.min(prev + 1, 2));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Report Metadata</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Step {step} of 2</p>
          </div>
        </div>
        <div className="flex gap-1">
          <div className={`h-1 w-6 rounded-full ${step >= 1 ? 'bg-orange-500' : 'bg-surface-3'}`} />
          <div className={`h-1 w-6 rounded-full ${step >= 2 ? 'bg-orange-500' : 'bg-surface-3'}`} />
        </div>
      </div>

      <Card className="bg-surface-2 border-white/5 shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="relative overflow-hidden h-[240px]">
            {/* Step 1 */}
            <div className={`absolute inset-0 p-6 transition-all duration-500 ease-out ${step === 1 ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> OEM
                  </Label>
                  <Select value={formData.oem} onValueChange={(val) => setFormData({...formData, oem: val})}>
                    <SelectTrigger className="h-9 bg-surface-3 border-white/5 rounded-lg text-xs">
                      <SelectValue placeholder="Select OEM" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-3 border-white/5 text-xs">
                      <SelectItem value="Applus IDIADA">Applus IDIADA</SelectItem>
                      <SelectItem value="BMW">BMW</SelectItem>
                      <SelectItem value="Mercedes">Mercedes</SelectItem>
                      <SelectItem value="Volkswagen">Volkswagen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-2">
                    <Car className="w-3 h-3" /> Vehicle Model
                  </Label>
                  <Input 
                    placeholder="e.g. VW Golf 8" 
                    value={formData.vehicle}
                    onChange={(e) => setFormData({...formData, vehicle: e.target.value})}
                    className="h-9 bg-surface-3 border-white/5 rounded-lg text-xs" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-2">
                    <ClipboardList className="w-3 h-3" /> Track
                  </Label>
                  <Input 
                    placeholder="e.g. IDIADA High Speed Track" 
                    value={formData.track}
                    onChange={(e) => setFormData({...formData, track: e.target.value})}
                    className="h-9 bg-surface-3 border-white/5 rounded-lg text-xs" 
                  />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`absolute inset-0 p-6 transition-all duration-500 ease-out ${step === 2 ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-2">
                    <User className="w-3 h-3" /> Engineer
                  </Label>
                  <Input 
                    placeholder="Full Name" 
                    value={formData.engineer}
                    onChange={(e) => setFormData({...formData, engineer: e.target.value})}
                    className="h-9 bg-surface-3 border-white/5 rounded-lg text-xs" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-2">
                    <User className="w-3 h-3" /> Analyst
                  </Label>
                  <Input 
                    placeholder="Full Name" 
                    value={formData.analyst}
                    onChange={(e) => setFormData({...formData, analyst: e.target.value})}
                    className="h-9 bg-surface-3 border-white/5 rounded-lg text-xs" 
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-3 border border-white/5 mt-2">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-xs font-bold">Euro NCAP Protocol</p>
                      <p className="text-[9px] text-muted-foreground">Compliance verification</p>
                    </div>
                  </div>
                  <Switch 
                    checked={formData.euroNcap}
                    onCheckedChange={(val) => setFormData({...formData, euroNcap: val})}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-3 mt-2">
        <Button 
          variant="outline" 
          onClick={prevStep} 
          disabled={step === 1}
          className="flex-1 h-10 text-[11px] font-bold uppercase tracking-widest border-white/10 hover:bg-surface-3"
        >
          <ArrowLeft className="w-3 h-3 mr-2" /> Back
        </Button>
        {step === 1 ? (
          <Button 
            onClick={nextStep}
            className="flex-1 h-10 text-[11px] font-bold uppercase tracking-widest bg-orange-500 text-white hover:bg-orange-600"
          >
            Next <ArrowRight className="w-3 h-3 ml-2" />
          </Button>
        ) : (
          <Button 
            className="flex-1 h-10 text-[11px] font-bold uppercase tracking-widest bg-[#2da44e] text-white hover:bg-[#2da44e]/90"
          >
            Save Metadata <ShieldCheck className="w-3 h-3 ml-2" />
          </Button>
        )}
      </div>

      <div className="mt-4 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <ClipboardList className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-orange-500">Metadata Sync</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              These details will be included in the generated report header and used for automated sorting of results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
