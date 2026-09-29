// Haversine formula to compute distance in meters between two GPS coordinates
export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function findClosestUniversity(userLat, userLng, universities) {
  if (!universities || universities.length === 0) return null;
  let closest = universities[0];
  let minDistance = Infinity;

  universities.forEach(u => {
    const dist = getDistanceInMeters(userLat, userLng, u.lat, u.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = u;
    }
  });

  return { university: closest, distanceMeters: minDistance };
}

export function sortUniversitiesByDistance(userLat, userLng, universities) {
  if (!universities || universities.length === 0) return [];
  if (!userLat || !userLng) {
    return universities.map((u, idx) => ({
      ...u,
      distanceMeters: null,
      distanceFormatted: 'Location pending',
      isClosest: idx === 0
    }));
  }

  const mapped = universities.map(u => {
    const dist = getDistanceInMeters(userLat, userLng, u.lat, u.lng);
    return {
      ...u,
      distanceMeters: dist,
      distanceFormatted: formatDistance(dist)
    };
  });

  mapped.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return mapped.map((u, idx) => ({ ...u, isClosest: idx === 0 }));
}

// Campus pedestrian perimeter radius (in meters) with tolerance for indoor GPS drift
export const MAX_ORDER_DISTANCE_METERS = 500;

/**
 * Checks if user is within ordering distance with GPS accuracy tolerance buffer
 * @param {number} distMeters - Computed distance to canteen
 * @param {number} [locAccuracy=0] - GPS accuracy in meters (e.g. from expo-location coords.accuracy)
 * @returns {boolean}
 */
export function isWithinOrderingPerimeter(distMeters, locAccuracy = 0) {
  // Allow up to 50m of indoor GPS drift tolerance
  const driftBuffer = Math.min(50, Math.max(0, locAccuracy));
  return (distMeters - driftBuffer) <= MAX_ORDER_DISTANCE_METERS;
}
