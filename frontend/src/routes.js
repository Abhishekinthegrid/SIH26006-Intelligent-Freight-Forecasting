// Water-first maritime planning corridors for the SIH26006 prototype.
// IMPORTANT: these are planning corridors, not navigation-grade tracks.
// The curated routes below are intentionally shaped through open water and
// major maritime gateways instead of using straight lines over land.

import { PORT_COORDS } from './portData'

const r = (lat, lng) => [lat, lng]

const CURATED = {
  // Indonesia -> India: Makassar / Lombok -> Indian Ocean -> Bay of Bengal
  "Balikpapan|Paradip": [
    r(-1.27,116.83),
    r(-2.50,117.80),
    r(-5.50,118.40),
    r(-8.40,116.00), // Lombok Strait / Indian Ocean exit
    r(-11.50,109.50),
    r(-13.50,100.00),
    r(-11.00,91.00),
    r(-6.00,84.00),
    r(1.00,80.00),
    r(8.00,80.50),
    r(13.00,82.20),
    r(17.00,84.40),
    r(20.30,86.70)
  ],

  // India -> Indonesia reverse of the same offshore corridor.
  "Paradip|Balikpapan": [
    r(20.30,86.70),
    r(17.00,84.40),
    r(13.00,82.20),
    r(8.00,80.50),
    r(1.00,80.00),
    r(-6.00,84.00),
    r(-11.00,91.00),
    r(-13.50,100.00),
    r(-11.50,109.50),
    r(-8.40,116.00),
    r(-5.50,118.40),
    r(-2.50,117.80),
    r(-1.27,116.83)
  ],

  // Argentina -> Brazil Atlantic coast
  "Buenos Aires|Santos": [
    r(-34.60,-58.40),
    r(-35.20,-56.80),
    r(-35.10,-54.80),
    r(-34.20,-53.00),
    r(-31.00,-50.80),
    r(-27.20,-48.80),
    r(-24.50,-46.90),
    r(-23.96,-46.30)
  ],

  // Argentina -> Malaysia: South Atlantic -> Cape -> Indian Ocean -> Malacca
  "Buenos Aires|Tanjung Pelepas": [
    r(-34.60,-58.40),
    r(-35.00,-52.00),
    r(-35.00,-45.00),
    r(-35.00,-35.00),
    r(-35.00,-25.00),
    r(-34.00,-15.00),
    r(-32.00,-5.00),
    r(-30.00,8.00),
    r(-27.00,20.00),
    r(-25.00,30.00),
    r(-20.00,40.00),
    r(-13.00,50.00),
    r(-5.00,60.00),
    r(2.00,68.00),
    r(6.00,76.00),
    r(7.00,83.00),
    r(4.00,91.00),
    r(2.00,98.00),
    r(1.30,103.55)
  ],

  // Argentina -> India: Atlantic -> Cape -> Indian Ocean
  "Rosario|Paradip": [
    r(-32.95,-60.64),
    r(-35.00,-55.00),
    r(-35.00,-40.00),
    r(-34.00,-25.00),
    r(-33.00,-10.00),
    r(-31.00,5.00),
    r(-28.00,20.00),
    r(-25.00,32.00),
    r(-19.00,42.00),
    r(-10.00,52.00),
    r(0.00,61.00),
    r(7.00,70.00),
    r(12.00,78.00),
    r(16.00,83.00),
    r(20.30,86.70)
  ],

  // Morocco -> India: around Cape -> Indian Ocean -> Bay of Bengal
  "Jorf Lasfar|Paradip": [
    r(33.10,-8.60),
    r(27.00,-14.00),
    r(18.00,-18.00),
    r(7.00,-15.00),
    r(-5.00,-5.00),
    r(-18.00,8.00),
    r(-30.00,18.00),
    r(-34.00,28.00),
    r(-30.00,38.00),
    r(-21.00,48.00),
    r(-10.00,58.00),
    r(0.00,66.00),
    r(8.00,73.00),
    r(14.00,79.00),
    r(18.00,84.00),
    r(20.30,86.70)
  ],

  // Chennai -> Veracruz: around Cape of Good Hope -> South Atlantic -> Gulf of Mexico
  "Chennai|Veracruz": [
    r(13.08,80.29),
    r(8.00,75.00),
    r(-2.00,65.00),
    r(-12.00,54.00),
    r(-22.00,42.00),
    r(-31.00,28.00),
    r(-35.00,18.00),
    r(-35.00,7.00),
    r(-31.00,-5.00),
    r(-24.00,-16.00),
    r(-16.00,-27.00),
    r(-7.00,-40.00),
    r(2.00,-52.00),
    r(10.00,-64.00),
    r(16.00,-76.00),
    r(20.00,-84.00),
    r(20.50,-90.00),
    r(19.18,-96.13)
  ]
}

function key(a, b) {
  return `${a || ''}|${b || ''}`
}

function actualPort(name, fallback) {
  const p = PORT_COORDS[name]
  return Array.isArray(p) && p.length === 2 ? p : fallback
}

function dedupe(points) {
  const out = []
  for (const p of points || []) {
    if (!Array.isArray(p) || p.length !== 2) continue
    const last = out[out.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
  }
  return out
}

// Fallback: create a gently southward ocean arc rather than a great-circle line.
// This is deliberately only a planning fallback for ports not yet covered by
// the curated corridor table above.
function fallbackOceanRoute(origin, destination) {
  const [olat, olng] = origin
  const [dlat, dlng] = destination

  const lonMid = olng + (dlng - olng) * 0.5
  const south = Math.min(-18, Math.min(olat, dlat) - 8)

  const points = [
    origin,
    r(olat + (south - olat) * 0.35, olng + (dlng - olng) * 0.18),
    r(south, lonMid - 8),
    r(south, lonMid + 8),
    r(dlat + (south - dlat) * 0.35, dlng - (dlng - olng) * 0.18),
    destination
  ]

  return dedupe(points)
}

export function routeFor(
  originCountry,
  destinationCountry,
  originPort,
  destinationPort
) {
  const fallbackOrigin = actualPort(originPort, [0, 0])
  const fallbackDestination = actualPort(destinationPort, [0, 0])

  const exact = CURATED[key(originPort, destinationPort)]

  if (exact) {
    return dedupe([
      fallbackOrigin,
      ...exact.slice(1, -1),
      fallbackDestination
    ])
  }

  // A few country-level corridors reuse the nearest large maritime gateway.
  const o = originCountry || ''
  const d = destinationCountry || ''

  if (
    o === 'Indonesia' &&
    d === 'India'
  ) {
    return dedupe([
      fallbackOrigin,
      r(-6.5,118.0),
      r(-12.5,105.0),
      r(-10.0,90.0),
      r(-3.0,82.0),
      r(7.0,80.0),
      r(15.0,83.5),
      fallbackDestination
    ])
  }

  if (
    o === 'India' &&
    d === 'Indonesia'
  ) {
    return routeFor(
      destinationCountry,
      originCountry,
      destinationPort,
      originPort
    ).reverse()
  }

  return fallbackOceanRoute(
    fallbackOrigin,
    fallbackDestination
  )
}

export function routeDistanceNm(points = []) {
  const toRad = x => x * Math.PI / 180
  let total = 0

  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = points[i - 1]
    const [lat2, lon2] = points[i]

    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2

    const c =
      2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      )

    // Earth mean radius expressed in nautical miles.
    total += 3440.065 * c
  }

  return Math.round(total)
}

export function routeLabel(originCountry, destinationCountry) {
  const o = typeof originCountry === 'string'
    ? originCountry
    : originCountry?.country || ''

  const d = typeof destinationCountry === 'string'
    ? destinationCountry
    : destinationCountry?.country || ''

  const labels = {
    'Indonesia|India':
      'Makassar / Lombok corridor → Indian Ocean → Bay of Bengal → East Coast India',

    'India|Indonesia':
      'Bay of Bengal → Indian Ocean → Lombok corridor → Indonesia',

    'Argentina|Brazil':
      'South Atlantic coastal corridor → Brazil east coast',

    'Argentina|Malaysia':
      'South Atlantic → Cape of Good Hope → Indian Ocean → Malacca Strait',

    'Argentina|India':
      'South Atlantic → Cape of Good Hope → Indian Ocean → Bay of Bengal',

    'Morocco|India':
      'Atlantic → Cape of Good Hope → Indian Ocean → Bay of Bengal',

    'India|Mexico':
      'Indian Ocean → Cape of Good Hope → South Atlantic → Gulf of Mexico',

    'China|India':
      'South China Sea → Malacca Strait → Indian Ocean → Bay of Bengal'
  }

  return labels[`${o}|${d}`] ||
    `Offshore maritime corridor from ${o} to ${d}`
}
