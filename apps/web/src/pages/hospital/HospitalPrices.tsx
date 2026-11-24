import * as React from "react";
import { Info, Loader2, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHospitalPrices, useRemovePrice, useSavePrice } from "@/hooks/useHospitalAdmin";
import type { HospitalPricesResponse, MarketStat } from "@/types/api";
import { cn, formatCompactCurrency } from "@/lib/utils";

export function HospitalPrices() {
  const { data, isLoading } = useHospitalPrices();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Treatment prices"
        description="Indicative prices patients see when searching and comparing. The doctor confirms the final estimate on the call."
      />

      <div className="flex items-start gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Search sorts by price and the compare page highlights the lowest price per treatment. The market range shows other
          verified hospitals' prices for the same treatment.
        </p>
      </div>

      {isLoading && <Skeleton className="h-80 rounded-xl" />}
      {data && <AddPrice data={data} />}

      {data && data.prices.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="No prices listed yet"
          description="Hospitals with prices appear in budget searches and comparisons. Add your most-requested procedures first."
        />
      )}

      {data && data.prices.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_170px_minmax(0,1.6fr)_120px] gap-4 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-medium uppercase text-muted-foreground md:grid">
            <span>Treatment</span>
            <span>Your price</span>
            <span>Market (other hospitals)</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {data.prices.map((p) => (
              <PriceRow
                key={p.id}
                treatmentId={p.treatmentId}
                name={p.treatment.name}
                category={p.treatment.category}
                price={p.indicativePrice}
                market={data.market[p.treatmentId]}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AddPrice({ data }: { data: HospitalPricesResponse }) {
  const save = useSavePrice();
  const priced = new Set(data.prices.map((p) => p.treatmentId));
  const options = data.catalogue.filter((t) => !priced.has(t.id));
  const [treatmentId, setTreatmentId] = React.useState("");
  const [price, setPrice] = React.useState("");
  const market = treatmentId ? data.market[treatmentId] : undefined;

  if (options.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <div className="flex-1 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Add a treatment</p>
          <Select value={treatmentId} onValueChange={setTreatmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose from the treatment catalogue" />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} · {t.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:w-48">
          <p className="text-xs font-medium text-muted-foreground">Indicative price (₹)</p>
          <Input type="number" min={1000} step={500} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 185000" />
        </div>
        <Button
          disabled={!treatmentId || Number(price) < 1000 || save.isPending}
          onClick={() =>
            save.mutate(
              { treatmentId, indicativePrice: Number(price) },
              {
                onSuccess: () => {
                  setTreatmentId("");
                  setPrice("");
                },
              },
            )
          }
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </Button>
      </CardContent>
      {market && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Other hospitals charge {formatCompactCurrency(market.min)}–{formatCompactCurrency(market.max)} (average{" "}
          {formatCompactCurrency(market.avg)}) across {market.hospitals} {market.hospitals === 1 ? "hospital" : "hospitals"}.
        </p>
      )}
    </Card>
  );
}

function PriceRow({
  treatmentId,
  name,
  category,
  price,
  market,
}: {
  treatmentId: string;
  name: string;
  category: string;
  price: number;
  market?: MarketStat;
}) {
  const save = useSavePrice();
  const remove = useRemovePrice();
  const [draft, setDraft] = React.useState(String(Math.round(price)));
  React.useEffect(() => setDraft(String(Math.round(price))), [price]);
  const dirty = Number(draft) !== Math.round(price);
  const valid = Number(draft) >= 1000;

  const current = dirty && valid ? Number(draft) : price;
  const vsAvg = market ? Math.round(((current - market.avg) / market.avg) * 100) : null;
  // Position of this price on the market's min–max track (clamped), for the mini bar.
  const pos = market && market.max > market.min ? Math.min(100, Math.max(0, ((current - market.min) / (market.max - market.min)) * 100)) : 50;

  return (
    <li className="grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1.4fr)_170px_minmax(0,1.6fr)_120px] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{category}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">₹</span>
        <Input
          type="number"
          min={1000}
          step={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && dirty && valid && save.mutate({ treatmentId, indicativePrice: Number(draft) })}
          className={cn("h-9", dirty && "border-primary-400 ring-1 ring-primary-200")}
          aria-label={`Price for ${name}`}
        />
      </div>
      <div className="min-w-0">
        {market ? (
          <>
            <div className="relative h-1.5 rounded-full bg-gradient-to-r from-green-200 via-muted to-amber-200">
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary-600 shadow-soft"
                style={{ left: `${pos}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{formatCompactCurrency(market.min)}</span>
              {vsAvg !== null && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-semibold",
                    vsAvg <= -5 ? "text-green-700" : vsAvg >= 15 ? "text-amber-700" : "text-muted-foreground",
                  )}
                >
                  {vsAvg < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {vsAvg === 0 ? "At average" : `${Math.abs(vsAvg)}% ${vsAvg < 0 ? "below" : "above"} avg`}
                </span>
              )}
              <span>{formatCompactCurrency(market.max)}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">You're the only hospital listing this — no comparison yet.</p>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        {dirty ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setDraft(String(Math.round(price)))}>
              Undo
            </Button>
            <Button size="sm" disabled={!valid || save.isPending} onClick={() => save.mutate({ treatmentId, indicativePrice: Number(draft) })}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${name}`}
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Remove ${name} from your price list? Patients will no longer find you for it in budget searches.`)) {
                  remove.mutate(treatmentId);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
