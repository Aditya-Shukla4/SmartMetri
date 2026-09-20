import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiServices } from "../services/api";
import { apiErrorMessage } from "../types";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Backend pe hit maar rahe hain
      const response = await apiServices.login({ email, password });

      if (response.data.success) {
        // Token save kar aur Dashboard pe nikal
        localStorage.setItem("token", response.data.token);
        navigate("/dashboard");
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "SYSTEM_ERROR: AUTHENTICATION FAILED"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-industrial-bg text-industrial-border font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-md border-2 border-industrial-border bg-industrial-surface p-6 md:p-8">
        <div className="border-b-2 border-industrial-border pb-4 mb-6 text-center">
          <h1 className="text-2xl font-bold uppercase font-sans tracking-tight">
            System Login
          </h1>
          <p className="text-xs mt-1 bg-industrial-border text-industrial-bg inline-block px-2 py-0.5 uppercase">
            Dept. of Legal Metrology
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-industrial-accent text-industrial-surface p-3 text-sm font-bold animate-pulse">
            [!] {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-bold uppercase">
              Authorized Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-2 border-industrial-border bg-transparent p-3 focus:outline-none focus:border-industrial-accent transition-none"
              placeholder="e.g. business@test.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm font-bold uppercase">Passkey</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-2 border-industrial-border bg-transparent p-3 focus:outline-none focus:border-industrial-accent transition-none"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 border-2 border-industrial-border bg-industrial-border text-industrial-bg font-bold py-3 uppercase hover:bg-industrial-accent hover:border-industrial-accent hover:text-white transition-none disabled:opacity-50"
          >
            {loading ? "[ AUTHENTICATING... ]" : "[ INITIATE LOGIN ]"}
          </button>
        </form>
      </div>
    </div>
  );
}
