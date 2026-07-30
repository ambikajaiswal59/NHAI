// data/mockData.js
// export const flyovers = [
//     {
//         id: 1,
//         highway: "NH 150",
//         riskStatus: "low",
//         image: "/images/flyover1.png",
//         center: [28.6129, 77.2295],
//         zoom: 15,
//         path: [
//             [28.6129, 77.2295],
//             [28.6180, 77.2350],
//             [28.6230, 77.2420],
//             [28.6280, 77.2480],
//         ],
//         points: [
//             { lat: 28.6129, lng: 77.2295, status: "normal" },
//             { lat: 28.6150, lng: 77.2320, status: "normal" },
//             { lat: 28.6180, lng: 77.2350, status: "normal" },
//             { lat: 28.6200, lng: 77.2380, status: "alert" },
//             { lat: 28.6230, lng: 77.2420, status: "normal" },
//             { lat: 28.6280, lng: 77.2480, status: "normal" },
//         ]
//     },
//     {
//         id: 2,
//         highway: "NH 152",
//         riskStatus: "high",
//         image: "/images/flyover2.png",
//         center: [28.6229, 77.2495],
//         zoom: 15,
//         path: [
//             [28.6229, 77.2495],
//             [28.6280, 77.2550],
//             [28.6330, 77.2620],
//             [28.6380, 77.2680],
//         ],
//         points: [
//             { lat: 28.6229, lng: 77.2495, status: "normal" },
//             { lat: 28.6250, lng: 77.2520, status: "critical" },
//             { lat: 28.6280, lng: 77.2550, status: "alert" },
//             { lat: 28.6300, lng: 77.2580, status: "critical" },
//             { lat: 28.6330, lng: 77.2620, status: "alert" },
//             { lat: 28.6380, lng: 77.2680, status: "normal" },
//         ]
//     },
//     {
//         id: 3,
//         highway: "NH 155",
//         riskStatus: "low",
//         image: "/images/flyover3.png",
//         center: [28.6329, 77.2695],
//         zoom: 15,
//         path: [
//             [28.6329, 77.2695],
//             [28.6380, 77.2750],
//             [28.6430, 77.2820],
//             [28.6480, 77.2880],
//         ],
//         points: [
//             { lat: 28.6329, lng: 77.2695, status: "normal" },
//             { lat: 28.6350, lng: 77.2720, status: "normal" },
//             { lat: 28.6380, lng: 77.2750, status: "normal" },
//             { lat: 28.6400, lng: 77.2780, status: "normal" },
//             { lat: 28.6430, lng: 77.2820, status: "alert" },
//             { lat: 28.6480, lng: 77.2880, status: "normal" },
//         ]
//     },
//     {
//         id: 4,
//         highway: "NH 162",
//         riskStatus: "moderate",
//         image: "/images/flyover4.png",
//         center: [28.6429, 77.2895],
//         zoom: 15,
//         path: [
//             [28.6429, 77.2895],
//             [28.6480, 77.2950],
//             [28.6530, 77.3020],
//             [28.6580, 77.3080],
//         ],
//         points: [
//             { lat: 28.6429, lng: 77.2895, status: "normal" },
//             { lat: 28.6450, lng: 77.2920, status: "alert" },
//             { lat: 28.6480, lng: 77.2950, status: "alert" },
//             { lat: 28.6500, lng: 77.2980, status: "normal" },
//             { lat: 28.6530, lng: 77.3020, status: "critical" },
//             { lat: 28.6580, lng: 77.3080, status: "normal" },
//         ]
//     },
// ];

export const weatherHeader = {
    temp: 29,
    condition: "Cloudy",
};

// export const getStats = (flyovers) => {
//     const total = flyovers.length;
//     const low = flyovers.filter((f) => f.riskStatus === "low").length;
//     const moderate = flyovers.filter((f) => f.riskStatus === "moderate").length;
//     const high = flyovers.filter((f) => f.riskStatus === "high").length;
//     return { total, low, moderate, high };
// };

export const weather = {
    location: "NH 152",
    temp: 29,
    condition: "Cloudy",
    conditionCode: "cloudy",
    wind: 18,
    humidity: 72,
    rainfall: 0.6,
    visibility: 8,
    forecast: [
        { time: "Now", temp: 29, rain: 0.6, condition: "cloudy" },
        { time: "3 PM", temp: 28, rain: 0.4, condition: "cloudy" },
        { time: "6 PM", temp: 27, rain: 1.2, condition: "rain" },
        { time: "9 PM", temp: 26, rain: 0.8, condition: "cloudy" },
        { time: "12 AM", temp: 25, rain: 0.3, condition: "cloudy" },
    ],
    rainfallIntensity: [
        { time: "12PM", mm: 0.4 },
        { time: "3PM", mm: 0.6 },
        { time: "6PM", mm: 1.5 },
        { time: "9PM", mm: 1.1 },
        { time: "12AM", mm: 0.5 },
        { time: "3AM", mm: 0.3 },
        { time: "6AM", mm: 0.4 },
        { time: "9AM", mm: 0.6 },
    ],
};