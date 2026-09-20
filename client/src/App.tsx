import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import BusinessDashboard from "./pages/BusinessDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/SystemLogin";
import PublicVerify from "./pages/PublicVerify";
import LMODashboard from "./pages/LMODashboard";
import BusinessRegister from "./pages/BusinessRegister";
import type { ReactNode } from "react";

function ProtectedRoute({
  roles,
  children,
}: {
  roles: string[];
  children: ReactNode;
}) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" replace />;
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
// Agar tera Login page bana hua hai toh usko bhi import kar lena, e.g.:
// import Login from "./pages/Login";

export default function App() {
  // NOTE: Hackathon logic ke liye. Production mein hum context/redux se role uthate hain.
  // Abhi ke liye hum assume kar rahe hain login ke baad role localStorage me save hota hai.

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<BusinessRegister />} />
        <Route path="/verify/:certificateNumber" element={<PublicVerify />} />
        <Route path="/verify" element={<PublicVerify />} />

        {/* BUSINESS PORTAL. The MVP uses one consolidated dashboard with these
            stable URLs so deep links from the workflow do not become 404s. */}
        {[
          "/business",
          "/business/dashboard",
          "/business/instruments",
          "/business/instruments/new",
          "/business/applications",
          "/business/applications/new",
          "/business/applications/:id",
          "/business/inspections",
          "/business/certificates",
          "/business/profile",
          "/business/notifications",
        ].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute roles={["BUSINESS"]}>
                <BusinessDashboard />
              </ProtectedRoute>
            }
          />
        ))}

        {/* ADMIN PORTAL */}
        {[
          "/admin",
          "/admin/dashboard",
          "/admin/applications",
          "/admin/applications/:id",
          "/admin/assignments",
          "/admin/inspections",
          "/admin/instruments",
          "/admin/certificates",
          "/admin/users",
          "/admin/audit",
          "/admin/reports",
          "/admin/settings",
        ].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        ))}

        {/* LMO FIELD PORTAL */}
        {[
          "/lmo",
          "/lmo/dashboard",
          "/lmo/today",
          "/lmo/upcoming",
          "/lmo/inspections",
          "/lmo/inspections/:id",
          "/lmo/sync",
        ].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute roles={["LMO"]}>
                <LMODashboard />
              </ProtectedRoute>
            }
          />
        ))}

        {/* 404 Route */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-industrial-bg text-industrial-accent font-mono p-10 text-2xl font-bold">
              [!] 404 - SYSTEM NOT FOUND
            </div>
          }
        />
      </Routes>
    </Router>
  );
}
