const pool = require('../config/db');

function pointInPolygon(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]; const yi = ring[i][1];
    const xj = ring[j][0]; const yj = ring[j][1];
    const cross = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (cross) inside = !inside;
  }
  return inside;
}

async function geocodeAddress(adresse) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse.trim())}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Quartio/1.0 contact@quartio.fr' } });
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function findQuartierForPoint(lat, lng) {
  const { rows } = await pool.query(
    'SELECT id_quartier, nom, geometrie FROM quartier WHERE geometrie IS NOT NULL'
  );
  for (const q of rows) {
    try {
      const ring = JSON.parse(q.geometrie).geometry.coordinates[0];
      if (pointInPolygon(lat, lng, ring)) return { id_quartier: q.id_quartier, nom: q.nom };
    } catch { /* géométrie invalide : on ignore */ }
  }
  return null;
}

// status: 'found' (adresse dans un quartier) | 'no_quartier' (localisée mais hors zone) | 'not_found' (adresse introuvable)
async function resolveQuartier(adresse) {
  if (!adresse || !adresse.trim()) return { status: 'not_found', quartier: null, coordinates: null };
  const coordinates = await geocodeAddress(adresse);
  if (!coordinates) return { status: 'not_found', quartier: null, coordinates: null };
  const quartier = await findQuartierForPoint(coordinates.lat, coordinates.lng);
  return { status: quartier ? 'found' : 'no_quartier', quartier, coordinates };
}

module.exports = { pointInPolygon, geocodeAddress, findQuartierForPoint, resolveQuartier };
