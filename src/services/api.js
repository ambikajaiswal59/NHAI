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