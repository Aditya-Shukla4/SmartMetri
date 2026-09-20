import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/AuthLogin";
import BusinessDashboard from "../pages/BusinessDashboard";

export default function AppRoutes() {
  // Basic check: Agar token nahi hai, toh dashboard pe mat jaane do
  const isAuthenticated = !!localStorage.getItem("token");

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? <BusinessDashboard /> : <Navigate to="/login" />
        }
      />
      {/* Default redirect to login */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
