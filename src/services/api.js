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

// --- Mock auth block — remove once the real /auth/login endpoint exists ---
const MOCK_CREDENTIALS = {
  username: "admin",
  password: "nhai@2026",
};

export const loginUser = async ({ username, password }) => {
  try {
    // Simulate network latency so loading states behave realistically
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (
      username === MOCK_CREDENTIALS.username &&
      password === MOCK_CREDENTIALS.password
    ) {
      return { token: "mock-token" };
    }

    throw new Error("Invalid username or password.");
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
};
