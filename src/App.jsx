// src/App.jsx
import { useState } from "react";
import MainLayout from "./layouts/MainLayout";
import { ROUTES, getPageComponent } from "./router/routes";

function App() {
  const [activeNav, setActiveNav] = useState(ROUTES.HOME);
  const ActivePage = getPageComponent(activeNav);

  return (
    <MainLayout activeNav={activeNav} onNavChange={setActiveNav}>
      <ActivePage />
    </MainLayout>
  );
}

export default App;