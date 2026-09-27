import {
  db,
  isFirebaseConfigured,
  collection,
  getDocs,
  doc,
  setDoc
} from './firebase';
import { getDistanceInMeters, formatDistance } from '../utils/distance';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';

// Show campuses within 50 km (covers full Ahmedabad metro + Gandhinagar + Nadiad)
const MAX_NEARBY_RADIUS_METERS = 50000;

// Track if we've already seeded this session to avoid repeated writes
let _seededThisSession = false;

/**
 * Seed DEFAULT_UNIVERSITIES into Firestore `universities` collection.
 * Uses merge:true so it never overwrites custom Firestore data (e.g., canteensCount).
 * Only runs once per app session.
 */
async function seedUniversitiesToFirestore() {
  if (_seededThisSession || !isFirebaseConfigured || !db) return;
  _seededThisSession = true;

  try {
    for (const u of DEFAULT_UNIVERSITIES) {
      const ref = doc(db, 'universities', u.id);
      await setDoc(ref, {
        name: u.name,
        shortName: u.shortName,
        type: u.type,
        city: u.city,
        address: u.address,
        lat: u.lat,
        lng: u.lng,
        isFeatured: u.isFeatured ?? false
        // Note: canteensCount is intentionally NOT seeded here
        // so Firestore's live canteen count is preserved
      }, { merge: true });
    }
    console.log('[campusService] Seeded', DEFAULT_UNIVERSITIES.length, 'universities to Firestore');
  } catch (e) {
    console.log('[campusService] Seed error (non-fatal):', e.message);
  }
}

/**
 * Fetch all universities registered in Firestore's `universities` collection.
 * Falls back to DEFAULT_UNIVERSITIES if Firestore is unavailable or empty.
 */
export async function fetchAllUniversitiesFromFirestore() {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const snap = await getDocs(collection(db, 'universities'));
    if (snap.empty) return null;

    const results = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.lat && data.lng) {
        results.push({
          id: docSnap.id,
          name: data.name || docSnap.id,
          shortName: data.shortName || data.name || docSnap.id,
          type: data.type || 'University Campus',
          city: data.city || '',
          address: data.address || '',
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lng),
          canteensCount: data.canteensCount || 0,
          isFeatured: data.isFeatured || false
        });
      }
    });

    return results.length > 0 ? results : null;
  } catch (e) {
    console.log('[campusService] Firestore fetch error:', e.message);
    return null;
  }
}

/**
 * Get universities sorted by distance from user's coordinates.
 * - Fetches from Firestore (and seeds defaults if not yet present)
 * - Filters to campuses within MAX_NEARBY_RADIUS_METERS (50 km)
 * - Always returns at least 1 campus (the nearest) even if all are beyond radius
 * - Falls back fully to DEFAULT_UNIVERSITIES if offline
 *
 * @param {number|null} userLat
 * @param {number|null} userLng
 * @returns {Promise<Array>} Sorted campuses with distanceMeters & distanceFormatted
 */
export async function fetchNearbyCampuses(userLat, userLng) {
  // Seed local university data into Firestore (once per session, non-blocking)
  seedUniversitiesToFirestore().catch(() => {});

  // Fetch from Firestore
  let allUniversities = await fetchAllUniversitiesFromFirestore();

  // Merge: Firestore records take precedence; add any local defaults not in Firestore
  if (allUniversities && allUniversities.length > 0) {
    const firestoreIds = new Set(allUniversities.map(u => u.id));
    DEFAULT_UNIVERSITIES.forEach(u => {
      if (!firestoreIds.has(u.id)) {
        allUniversities.push(u);
      }
    });
  } else {
    // Offline or Firestore empty — use local defaults
    allUniversities = [...DEFAULT_UNIVERSITIES];
  }

  // Attach distance metrics
  const withDistance = allUniversities.map(u => {
    if (userLat && userLng && u.lat && u.lng) {
      const distMeters = getDistanceInMeters(userLat, userLng, u.lat, u.lng);
      return {
        ...u,
        distanceMeters: distMeters,
        distanceFormatted: formatDistance(distMeters)
      };
    }
    return {
      ...u,
      distanceMeters: null,
      distanceFormatted: 'Location pending'
    };
  });

  // Filter to campuses within radius (if GPS available)
  let filtered = withDistance;
  if (userLat && userLng) {
    const nearbyOnly = withDistance.filter(
      u => u.distanceMeters !== null && u.distanceMeters <= MAX_NEARBY_RADIUS_METERS
    );
    // Always show at least the nearest campus even if it's beyond radius
    filtered = nearbyOnly.length > 0 ? nearbyOnly : withDistance;
  }

  // Sort by distance ascending
  filtered.sort((a, b) => {
    if (a.distanceMeters === null) return 1;
    if (b.distanceMeters === null) return -1;
    return a.distanceMeters - b.distanceMeters;
  });

  // Mark the closest
  return filtered.map((u, idx) => ({ ...u, isClosest: idx === 0 }));
}
