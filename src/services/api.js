const BASE_URL = import.meta.env.VITE_API_BASE;

// ---------------------------------------------------------
// Shared authenticated fetch wrapper
// Attaches the Bearer token (stored in sessionStorage) to
// every protected API call. If the server responds 401
// (token invalid / session revoked by force_logout or a
// login from another device), clears the stored session
// and redirects to the login page.
// ---------------------------------------------------------
const authFetch = async (url, options = {}) => {
  const token = sessionStorage.getItem("authToken");

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    window.location.href = "/login"; // adjust to your actual login route
  }

  return response;
};

// Send clicked map location to backend
export const sendLocationToAPI = async ({ flyoverId, lat, lng }) => {
  const response = await authFetch(`${BASE_URL}/weather/data`, {
    method: "POST",
    body: JSON.stringify({
      id: flyoverId,
      lat: lat,
      lon: lng,
    }),
  });

  const data = await response.json();
  return data;
};

// fetch weather IDW data for a specific date
// export const fetchIDWWeatherData = async (date) => {
//   try {
//     const response = await authFetch(`${BASE_URL}/weather/idw`, {
//       method: "POST",
//       body: JSON.stringify({
//         date: date, // Format: "2026-08-03"
//       }),
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const data = await response.json();

//     return data;
//   } catch (error) {
//     console.error("Error fetching IDW weather data:", error);
//     throw error;
//   }
// };

// api.js - Add new function

export const fetchMonthlyWeatherData = async () => {
  try {
    const response = await authFetch(`${BASE_URL}/rainfall/history`, {
      method: "GET",
    });

    if (!response.ok) {
      const err = new Error(`HTTP error! status: ${response.status}`);
      err.status = response.status; // ← added
      throw err;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching monthly weather data:", error);
    throw error;
  }
};

// Fetch traffic data for a specific flyover with optional date filter
export const fetchTrafficData = async (flyoverName, selectedDate = null) => {
  try {
    const response = await authFetch(`${BASE_URL}/traffic/data`, {
      method: "POST",
      body: JSON.stringify({
        name: flyoverName,
        date: selectedDate, // Add date field (null for last 24 hours)
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error response:", errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching traffic data:", error);
    throw error;
  }
};

// NEW: Fetch available dates for a flyover
export const fetchTrafficDates = async (flyoverName) => {
  try {
    const response = await authFetch(
      `${BASE_URL}/traffic/dates/${flyoverName}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.available_dates || [];
  } catch (error) {
    console.error("Error fetching traffic dates:", error);
    return [];
  }
};

// ============================================================
// 🆕 MOVEMENT POINTS APIs (Only these two endpoints)
// ============================================================

/**
 * GET /points/data
 * Fetch all movement points (lightweight - NO timeseries)
 * Used for map display
 */
export const fetchMovementPoints = async () => {
  try {
    const response = await authFetch(`${BASE_URL}/points/data`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching movement points:", error);
    throw error;
  }
};

/**
 * GET /points/data/{point_id}
 * Fetch single point with timeseries (detailed data)
 * Used when user clicks on a point
 */
export const fetchMovementPointById = async (pointId) => {
  try {
    const response = await authFetch(`${BASE_URL}/points/data/${pointId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching point ${pointId}:`, error);
    throw error;
  }
};

// ============================================================
// 🆕 FLYOVER SEGMENT APIs
// ============================================================

/**
 * POST /get_live_segment
 * Fetch live segment data (GeoJSON with LineString geometry)
 * Used for displaying road segments on the map
 */
export const fetchLiveSegments = async () => {
  try {
    const response = await authFetch(`${BASE_URL}/get_live_segment`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching live segments:", error);
    throw error;
  }
};

/**
 * POST /get_polygon_segment
 * Fetch polygon segment data (GeoJSON with Polygon geometry)
 * Can query by ID or location
 *
 * @param {Object} params
 * @param {string} params.type - 'id' or 'location'
 * @param {string} [params.id] - Object ID when type is 'id'
 * @param {number} [params.latitude] - Latitude when type is 'location'
 * @param {number} [params.longitude] - Longitude when type is 'location'
 */
export const fetchPolygonSegment = async ({
  type,
  id = null,
  latitude = null,
  longitude = null,
}) => {
  try {
    let url = `${BASE_URL}/get_polygon_segment?type=${type}`;

    if (type === "id" && id !== null) {
      url += `&id=${id}`;
    } else if (type === "location" && latitude !== null && longitude !== null) {
      url += `&latitude=${latitude}&longitude=${longitude}`;
    }

    const response = await authFetch(url, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching polygon segment:", error);
    throw error;
  }
};

/**
 * POST /get_live_segment_stats
 * Fetch live segment statistics (NO geometry)
 * Useful for tables, charts, or data grids
 * Returns: id, name, avg_velocity, point_count
 */
export const fetchLiveSegmentStats = async () => {
  try {
    const response = await authFetch(`${BASE_URL}/get_live_segment_stats`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching live segment stats:", error);
    throw error;
  }
};

// --- Mock auth block — remove once the real /auth/login endpoint exists ---
// const MOCK_CREDENTIALS = {
//   username: "admin",
//   password: "nhai@2026",
// };

// NOTE: login must stay unauthenticated — no token exists yet at this point
export const loginUser = async ({ username, password }) => {
  try {
    const params = new URLSearchParams({ username, password });

    const response = await fetch(`${BASE_URL}/login?${params.toString()}`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(
        body.detail || `HTTP error! status: ${response.status}`,
      );
      error.status = response.status;
      error.detail = body.detail;
      throw error;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  const token = sessionStorage.getItem("authToken"); // ✅ matches Login.jsx

  try {
    const response = await fetch(`${BASE_URL}/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json().catch(() => ({}));
  } finally {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
  }
};

// NOTE: not currently protected by get_current_user on the backend
// (change_password lives in auth_routes, which is public). Left as-is.
export const changePassword = async ({ username, newPassword }) => {
  try {
    const params = new URLSearchParams({
      username,
      new_password: newPassword,
    });

    const response = await fetch(
      `${BASE_URL}/change_password?${params.toString()}`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error changing password:", error);
    throw error;
  }
};

// NOTE: not currently protected by get_current_user on the backend
// (force_logout lives in auth_routes, which is public). Left as-is.
export const forceLogoutUser = async (username) => {
  try {
    const params = new URLSearchParams({ username });

    const response = await fetch(
      `${BASE_URL}/force_logout?${params.toString()}`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error("Error force logging out:", error);
    throw error;
  }
};
