import L from "leaflet";

// Leaflet's default marker images don't resolve cleanly through Vite's bundler;
// use a small inline SVG pin in the brand color instead of importing the png assets.
const pinSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26c0-8.8-7.2-16-16-16z" fill="#0F7C82"/>
  <circle cx="16" cy="16" r="6.5" fill="#FFFFFF"/>
</svg>
`);

const markerIcon = L.icon({
  iconUrl: `data:image/svg+xml,${pinSvg}`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -38],
});

export default markerIcon;
