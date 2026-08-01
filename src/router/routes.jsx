// src/router/routes.jsx
import HomeMap from "../pages/Home";
import DashboardPage from "../pages/DashboardPage";
import WeatherMapPage from "../pages/WeatherMapPage";
import ReportsPage from "../pages/ReportsPage";

// Route definitions
export const ROUTES = {
    HOME: "home",
    DASHBOARD: "dashboard",
    WEATHER: "weather",
    REPORTS: "reports",
};

// Page component mapping
export const PAGE_COMPONENTS = {
    [ROUTES.HOME]: HomeMap,
    [ROUTES.DASHBOARD]: DashboardPage,
    [ROUTES.WEATHER]: WeatherMapPage,
    [ROUTES.REPORTS]: ReportsPage,
};

// Helper to get page component by route
export const getPageComponent = (route) => {
    return PAGE_COMPONENTS[route] || PAGE_COMPONENTS[ROUTES.HOME];
};