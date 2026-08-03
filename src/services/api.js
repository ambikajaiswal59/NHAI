const BASE_URL = "http://192.168.1.16:8000/api"; // change according to your backend URL


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
  console.log(data);

  return data;
};


// fetch weather IDW data for a specific date 
export const fetchIDWWeatherData = async (date) => {
  try {
    const response = await fetch(`${BASE_URL}/weather/idw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: date, // Format: "2026-08-03"
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("IDW Weather Data:", data);
    return data;
  } catch (error) {
    console.error("Error fetching IDW weather data:", error);
    throw error;
  }
};