import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import markerIcon from "@/lib/leaflet-marker";

L.Marker.prototype.options.icon = markerIcon;

export function HospitalMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  // `isolate` (isolation: isolate) is the important bit: Leaflet hard-codes high
  // z-indexes internally (panes 400, controls 1000) which would otherwise sit on
  // top of the sticky header. Making this wrapper its own stacking context
  // confines those values here, so the header's z-index wins outside it.
  return (
    <div className="relative z-0 h-64 w-full isolate overflow-hidden rounded-xl border border-border">
      <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>{name}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
