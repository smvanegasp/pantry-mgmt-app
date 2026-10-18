import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [status, setStatus] = useState("checking…");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { status: string }) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Hello from Pantry 🥫</h1>
      <p>API status: {status}</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
