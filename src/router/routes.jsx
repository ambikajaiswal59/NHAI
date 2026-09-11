import DashboardPage from "../pages/DashboardPage";
import WeatherMapPage from "../pages/WeatherMapPage";
import ReportsPage from "../pages/ReportsPage";
import Alertspage from "../pages/AlertsPage";
import TopographyPage from "../pages/TopographyPage";
import TrafficPage from "../pages/TrafiicPage";

export const ROUTES = {
  DASHBOARD: "dashboard",
  WEATHER: "weather",
  Topography: "topography",
  TRAFFIC: "traffic",
  REPORTS: "reports",
  ALERTS: "alerts",
};

export const PAGE_COMPONENTS = {
  [ROUTES.DASHBOARD]: DashboardPage,
  [ROUTES.WEATHER]: WeatherMapPage,
  [ROUTES.Topography]: TopographyPage,
  [ROUTES.TRAFFIC]: TrafficPage,
  [ROUTES.REPORTS]: ReportsPage,
  [ROUTES.ALERTS]: Alertspage,
};

export const getPageComponent = (route) => {
  return PAGE_COMPONENTS[route] || PAGE_COMPONENTS[ROUTES.DASHBOARD];
};