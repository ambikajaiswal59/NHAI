// src/App.jsx
import { useState, useEffect } from "react";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import { ROUTES, getPageComponent } from "./router/routes";

function App() {
  const [activeNav, setActiveNav] = useState(ROUTES.DASHBOARD);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    const storedUser = sessionStorage.getItem("authUser");
    setIsAuthenticated(!!token);
    setUser(storedUser ? JSON.parse(storedUser) : null);
    setCheckingAuth(false);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    setIsAuthenticated(false);
    setUser(null);
    setActiveNav(ROUTES.HOME);
  };

  if (checkingAuth) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Login
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  const ActivePage = getPageComponent(activeNav);

  return (
    <MainLayout
      activeNav={activeNav}
      onNavChange={setActiveNav}
      onLogout={handleLogout}
      user={user}
    >
      <ActivePage />
    </MainLayout>
  );
}

export default App;