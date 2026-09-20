import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiServices } from "../services/api";
import { Link } from "react-router-dom";
import { apiErrorMessage } from "../types";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await apiServices.login({ email, password });

      if (res.data.success) {
        // 1. Token aur Role ko LocalStorage me daba de
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("role", res.data.user.role);

        // 2. Traffic Police: Role ke hisaab se sahi raaste bhej
        if (res.data.user.role === "ADMIN") navigate("/admin");
        else if (res.data.user.role === "LMO") navigate("/lmo");
        else navigate("/business");
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Login failed! System rejected."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-industrial-bg text-industrial-border font-sans flex items-center justify-center p-4">
      <div className="border-2 border-industrial-border bg-industrial-surface p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold tracking-tight uppercase mb-2 border-b-2 border-industrial-border pb-2">
          System Login
        </h1>
        <p className="font-mono text-sm mb-6 text-industrial-accent">
          [ AUTHENTICATION REQUIRED ]
        </p>

        {error && (
          <div className="bg-red-900/20 border-2 border-red-500 text-red-500 p-2 font-mono text-sm font-bold mb-4 uppercase">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4 font-mono">
          <div className="flex flex-col">
            <label className="mb-1 font-bold">USER ID (EMAIL)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-2 border-industrial-border bg-transparent p-2 focus:outline-none focus:border-industrial-accent transition-none"
              placeholder="admin@metrology.gov.in"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 font-bold">ACCESS KEY (PASSWORD)</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-2 border-industrial-border bg-transparent p-2 focus:outline-none focus:border-industrial-accent transition-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 border-2 border-industrial-border bg-industrial-border text-industrial-bg font-bold py-3 uppercase hover:bg-industrial-accent hover:border-industrial-accent hover:text-white transition-none disabled:opacity-50"
          >
            {loading ? "[ VERIFYING... ]" : "[ ENTER SYSTEM ]"}
          </button>
        </form>
        <p className="font-mono text-sm mt-6">Need business access? <Link className="text-industrial-accent font-bold underline" to="/register">Register here</Link></p>
      </div>
    </div>
  );
}
