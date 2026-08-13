import { Eye, Bone, Activity, PersonStanding, Scissors, HeartPulse, Brain, Stethoscope, type LucideIcon } from "lucide-react";

export interface SurgeryCategory {
  name: string;
  icon: LucideIcon;
}

// Matches the treatment `category` values in apps/api/prisma/seed.ts, and the
// "browse by surgery" pattern on the reference site (connecthospital.in).
export const SURGERY_CATEGORIES: SurgeryCategory[] = [
  { name: "Cataract", icon: Eye },
  { name: "Knee", icon: Bone },
  { name: "Hernia", icon: Activity },
  { name: "Hip", icon: PersonStanding },
  { name: "Appendectomy", icon: Scissors },
  { name: "Heart", icon: HeartPulse },
  { name: "Neuro", icon: Brain },
  { name: "General", icon: Stethoscope },
];
