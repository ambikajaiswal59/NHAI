// src/router/routes.jsx
import HomeMap from "../pages/Home";
import DashboardPage from "../pages/DashboardPage";
import WeatherMapPage from "../pages/WeatherMapPage";
import ReportsPage from "../pages/ReportsPage";
import Alertspage from "../pages/AlertsPage";

import TopographyPage from "../pages/TopographyPage";
import TrafficPage from "../pages/TrafiicPage";

// Route definitions
export const ROUTES = {
    HOME: "home",
    DASHBOARD: "dashboard",
    WEATHER: "weather",
    Topography: "topography",
    TRAFFIC: "traffic",
    REPORTS: "reports",
    ALERTS: "alerts",

};

// Page component mapping
export const PAGE_COMPONENTS = {
    [ROUTES.HOME]: HomeMap,
    [ROUTES.DASHBOARD]: DashboardPage,
    [ROUTES.WEATHER]: WeatherMapPage,
    [ROUTES.Topography]: TopographyPage,
    [ROUTES.TRAFFIC]: TrafficPage,
    [ROUTES.REPORTS]: ReportsPage,
    [ROUTES.ALERTS]: Alertspage,


};

// Helper to get page component by route
export const getPageComponent = (route) => {
    return PAGE_COMPONENTS[route] || PAGE_COMPONENTS[ROUTES.HOME];
};