const BASE_URL = import.meta.env.VITE_API_BASE;


// Send clicked map location to backend
export const sendLocationToAPI = async ({ flyoverId, lat, lng }) => {
  const response = await fetch(`${BASE_URL}/weather/data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
//     const response = await fetch(`${BASE_URL}/weather/idw`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
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
    const response = await fetch(`${BASE_URL}/rainfall/history`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching monthly weather data:", error);
    throw error;
  }
};


// Fetch traffic data for a specific flyover
export const fetchTrafficData = async (flyoverName) => {
  try {
    const response = await fetch(`${BASE_URL}/traffic/data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: flyoverName,
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
    const response = await fetch(`${BASE_URL}/points/data`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
    const response = await fetch(`${BASE_URL}/points/data/${pointId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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