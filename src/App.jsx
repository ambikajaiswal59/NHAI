import { useState, useEffect } from "react";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import { ROUTES, getPageComponent } from "./router/routes";

function App() {
  const [activeNav, setActiveNav] = useState(ROUTES.HOME);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    setIsAuthenticated(!!token);
    setCheckingAuth(false);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("authToken");
    setIsAuthenticated(false);
    setActiveNav(ROUTES.HOME);
  };

  if (checkingAuth) {
    return null;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const ActivePage = getPageComponent(activeNav);

  return (
    <MainLayout activeNav={activeNav} onNavChange={setActiveNav} onLogout={handleLogout}>
      <ActivePage />
    </MainLayout>
  );
}

export default App;