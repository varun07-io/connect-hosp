import { Link } from "react-router-dom";
import { MapPin, Star, ShieldCheck, Stethoscope, PhoneCall, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HospitalSummary } from "@/types/api";
import { formatCurrency } from "@/lib/utils";

/** The primary conversion unit of the whole product: every element here exists
 *  to answer "can I trust it, what will it cost, what happens if I click". */
export function HospitalCard({ hospital }: { hospital: HospitalSummary }) {
  const to = `/hospitals/${hospital.slug}`;
  const isVerified = hospital.accreditations.length > 0;

  return (
    <Card className="group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={to} className="flex flex-1 flex-col">
        <div className="relative h-36 w-full shrink-0 overflow-hidden bg-muted">
          {hospital.photos[0] && (
            <img
              src={hospital.photos[0]}
              alt={hospital.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          )}
          {isVerified && (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-green-700 shadow-soft backdrop-blur">
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          )}
          {hospital.avgRating !== null && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-amber-700 shadow-soft backdrop-blur">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              {hospital.avgRating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-[15px] font-semibold leading-snug transition-colors group-hover:text-primary-700">
            {hospital.name}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {hospital.city}
            <span className="mx-1 text-border">·</span>
            <Stethoscope className="h-3.5 w-3.5 shrink-0" /> {hospital.doctorCount} doctors
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {hospital.specialities.slice(0, 2).map((s) => (
              <Badge key={s} variant="muted">{s}</Badge>
            ))}
            {hospital.specialities.length > 2 && (
              <Badge variant="outline">+{hospital.specialities.length - 2}</Badge>
            )}
          </div>

          <div className="mt-auto pt-3">
            {hospital.startingPrice !== null ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">from</span>
                <span className="font-display text-lg font-bold text-primary-700">
                  {formatCurrency(hospital.startingPrice, hospital.currency)}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Pricing on request</span>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {hospital.reviewCount > 0 ? `${hospital.reviewCount} patient reviews` : "Newly listed"}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Button asChild size="sm" className="flex-1">
          <Link to={to}>
            <PhoneCall className="h-3.5 w-3.5" /> Get free callback
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={to} aria-label={`View ${hospital.name} details`}>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
