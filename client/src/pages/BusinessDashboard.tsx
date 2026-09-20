import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { apiServices } from "../services/api";
import { useNavigate } from "react-router-dom";
import {
  apiErrorMessage,
  type Application,
  type Certificate,
  type Instrument,
  type Notification,
} from "../types";

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [applicationInstrumentId, setApplicationInstrumentId] = useState("");
  const [applicationType, setApplicationType] = useState<
    "VERIFICATION" | "REVERIFICATION"
  >("VERIFICATION");
  const [applicationEvidence, setApplicationEvidence] = useState<File | null>(
    null,
  );
  const [applicationSubmitting, setApplicationSubmitting] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    email: string;
    phone?: string | null;
    stateId?: string | null;
    districtId?: string | null;
  } | null>(null);

  const [formData, setFormData] = useState({
    type: "",
    manufacturer: "",
    capacity: "",
    model: "",
    serialNumber: "",
    state: "Uttar Pradesh",
    district: "Meerut",
    location: "Main Branch",
  });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  const fetchInstruments = async () => {
    try {
      const response = await apiServices.getInstruments();
      const fetchedData =
        response.data.instruments || response.data.data || response.data || [];
      setInstruments(fetchedData);
    } catch (error: unknown) {
      console.error("[API ERROR] Fetching failed:", error);
      setInstruments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchInstruments();
      void apiServices
        .getApplications()
        .then((res) => setApplications(res.data.applications || []))
        .catch(() => setApplications([]));
      void apiServices
        .getCertificates()
        .then((res) => setCertificates(res.data.certificates || []))
        .catch(() => setCertificates([]));
      void apiServices
        .getNotifications()
        .then((res) => setNotifications(res.data.notifications || []))
        .catch(() => setNotifications([]));
      void apiServices
        .getMe()
        .then((res) => setProfile(res.data.user))
        .catch(() => setProfile(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const downloadCertificate = async (id: string, code: string) => {
    try {
      const response = await apiServices.getCertificatePdf(id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${code}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Certificate download failed.");
    }
  };

  const downloadQR = async (id: string, code: string) => {
    try {
      const response = await apiServices.getCertificateQr(id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${code}-QR.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("QR download failed.");
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await apiServices.markNotificationRead(id);
      setNotifications((current) =>
        current.map((note) =>
          note.id === id ? { ...note, readAt: new Date().toISOString() } : note,
        ),
      );
    } catch {
      alert("Notification update failed.");
    }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    try {
      const response = await apiServices.updateMe({
        name: profile.name,
        phone: profile.phone || undefined,
        stateId: profile.stateId || undefined,
        districtId: profile.districtId || undefined,
      });
      setProfile(response.data.user);
    } catch (error: unknown) {
      alert(apiErrorMessage(error, "Profile update failed."));
    }
  };

  const submitApplication = async (
    instrumentId: string,
    evidence?: File | null,
  ) => {
    try {
      const data = new FormData();
      data.append("instrumentId", instrumentId);
      data.append("applicationType", applicationType);
      data.append(
        "remarks",
        `${applicationType === "REVERIFICATION" ? "Re-verification" : "Verification"} application submitted from portal.`,
      );
      if (evidence) data.append("evidence", evidence);
      await apiServices.submitApplication(data);
      const res = await apiServices.getApplications();
      setApplications(res.data.applications || []);
    } catch (error: unknown) {
      alert(apiErrorMessage(error, "Application submission failed."));
    }
  };

  const handleApplicationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!applicationInstrumentId || !applicationEvidence) {
      alert("Select an instrument and attach evidence before submitting.");
      return;
    }
    setApplicationSubmitting(true);
    try {
      await submitApplication(applicationInstrumentId, applicationEvidence);
      setApplicationInstrumentId("");
      setApplicationType("VERIFICATION");
      setApplicationEvidence(null);
      const input = document.getElementById(
        "application-evidence",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
    } finally {
      setApplicationSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const submitData = { ...formData };
      const res = await apiServices.registerInstrument(submitData);

      if (res.data.success) {
        setFormData({
          ...formData,
          type: "",
          manufacturer: "",
          capacity: "",
          model: "",
          serialNumber: "",
        });
        fetchInstruments();
      }
    } catch (error: unknown) {
      alert("ERROR: " + apiErrorMessage(error, "Registration Failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      {/* HEADER - Clean & Crisp */}
      <header className="max-w-7xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Legal Metrology Portal
          </h1>
          <p className="text-sm font-medium text-blue-600 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            System Online
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col md:items-end text-sm">
          <p className="font-semibold text-slate-800">
            {profile?.name || "Business User"}
          </p>
          <p className="text-slate-500 mb-2">
            Role: {profile?.role || "Business"}
          </p>
          <button
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 font-semibold px-3 py-1.5 border border-red-200 hover:bg-red-50 rounded-lg transition-colors w-max"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT PANE: ACTION CENTER */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          {/* PROFILE CARD */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-5 border-b border-slate-100 pb-3">
              Business Profile
            </h2>
            {profile ? (
              <form
                onSubmit={saveProfile}
                className="flex flex-col gap-4 text-sm"
              >
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Name
                  </label>
                  <input
                    required
                    value={profile.name}
                    onChange={(e) =>
                      setProfile((c) =>
                        c ? { ...c, name: e.target.value } : c,
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="text-slate-500 text-xs">
                  Registered Email: {profile.email}
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    value={profile.phone || ""}
                    onChange={(e) =>
                      setProfile((c) =>
                        c ? { ...c, phone: e.target.value } : c,
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      State
                    </label>
                    <input
                      value={profile.stateId || ""}
                      onChange={(e) =>
                        setProfile((c) =>
                          c ? { ...c, stateId: e.target.value } : c,
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      District
                    </label>
                    <input
                      value={profile.districtId || ""}
                      onChange={(e) =>
                        setProfile((c) =>
                          c ? { ...c, districtId: e.target.value } : c,
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <button className="mt-2 w-full bg-slate-800 text-white rounded-lg py-2.5 font-medium hover:bg-slate-700 transition-colors">
                  Save Changes
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">Loading profile data...</p>
            )}
          </div>

          {/* REGISTER INSTRUMENT */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-5 border-b border-slate-100 pb-3">
              Register New Instrument
            </h2>
            <form
              className="flex flex-col gap-4 text-sm"
              onSubmit={handleRegister}
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Instrument Type
                </label>
                <input
                  type="text"
                  required
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Electronic Scale"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Capacity
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Serial No.
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.serialNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, serialNumber: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                {submitting ? "Registering..." : "Submit Registration"}
              </button>
            </form>
          </div>

          {/* VERIFICATION APPLICATION */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-5 border-b border-slate-100 pb-3">
              Apply for Verification
            </h2>
            <form
              onSubmit={handleApplicationSubmit}
              className="flex flex-col gap-4 text-sm"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Select Instrument
                </label>
                <select
                  required
                  value={applicationInstrumentId}
                  onChange={(e) => setApplicationInstrumentId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Choose registered instrument</option>
                  {instruments
                    .filter(
                      (inst) =>
                        !applications.some(
                          (app) =>
                            app.instrumentId === inst.id &&
                            !["FAILED", "CERTIFICATE_ISSUED"].includes(
                              app.status,
                            ),
                        ),
                    )
                    .map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.instrumentCode} — {inst.serialNumber}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Application Type
                </label>
                <select
                  value={applicationType}
                  onChange={(e) =>
                    setApplicationType(
                      e.target.value as "VERIFICATION" | "REVERIFICATION",
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="VERIFICATION">Verification</option>
                  <option value="REVERIFICATION">Re-verification</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Evidence (Image/PDF)
                </label>
                <input
                  id="application-evidence"
                  required
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    setApplicationEvidence(e.target.files?.[0] || null)
                  }
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={applicationSubmitting}
                className="mt-2 w-full bg-slate-800 text-white rounded-lg py-2.5 font-medium hover:bg-slate-700 transition-colors disabled:bg-slate-400"
              >
                {applicationSubmitting ? "Submitting..." : "Submit Application"}
              </button>
            </form>
          </div>
        </aside>

        {/* RIGHT PANE: DATA CENTER */}
        <main className="lg:col-span-8 flex flex-col gap-6">
          {/* DATABASE TABLE */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                Instrument Database
              </h2>
              <span className="bg-slate-200 text-slate-700 py-1 px-3 rounded-full text-xs font-semibold">
                Total: {loading ? "..." : instruments.length}
              </span>
            </div>

            <div className="p-0">
              {loading ? (
                <div className="p-8 text-center text-slate-500 font-medium animate-pulse">
                  Loading data securely...
                </div>
              ) : instruments.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <div className="mx-auto h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <svg
                      className="h-6 w-6 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>
                  <p>No instruments registered yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                      <tr>
                        <th className="px-6 py-4">Code / Serial</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Capacity</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {instruments.map((inst, idx) => {
                        const canApply = !applications.some(
                          (a) =>
                            a.instrumentId === inst.id &&
                            !["FAILED", "CERTIFICATE_ISSUED"].includes(
                              a.status,
                            ),
                        );
                        return (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-900">
                                {inst.instrumentCode || "N/A"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {inst.serialNumber}
                              </p>
                            </td>
                            <td className="px-6 py-4">{inst.type || "N/A"}</td>
                            <td className="px-6 py-4">
                              {inst.capacity || "N/A"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                  inst.status === "VERIFIED"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {inst.status === "VERIFIED"
                                  ? "Verified"
                                  : "Pending"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => submitApplication(inst.id)}
                                disabled={!canApply}
                                className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                                  canApply
                                    ? "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
                                    : "text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed"
                                }`}
                              >
                                Apply
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TIMELINE */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-3">
                Application Status
              </h2>
              <div className="space-y-4 text-sm">
                {applications.length === 0 ? (
                  <p className="text-slate-500">No active applications.</p>
                ) : (
                  applications.map((app) => (
                    <div
                      key={app.id}
                      className="border border-slate-100 rounded-lg p-4 shadow-sm bg-slate-50/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {app.applicationCode}
                          </p>
                          <p className="text-xs text-slate-500">
                            SN: {app.instrument?.serialNumber}
                          </p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {app.status}
                        </span>
                      </div>
                      {app.statusHistory?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                          {app.statusHistory.map((history) => (
                            <span
                              key={history.id}
                              className="text-[11px] font-medium bg-white border border-slate-200 px-2 py-1 rounded text-slate-600"
                            >
                              {history.toStatus} •{" "}
                              {new Date(history.createdAt).toLocaleDateString()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CERTIFICATES & NOTIFICATIONS */}
            <div className="flex flex-col gap-6">
              {/* CERTIFICATES */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-3">
                  Digital Certificates
                </h2>
                {certificates.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No certificates issued yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {certificates.map((cert) => (
                      <div
                        key={cert.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {cert.certificateCode}
                          </p>
                          <p className="text-xs text-slate-500">
                            Valid till:{" "}
                            {new Date(cert.validUntil).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 mt-2 sm:mt-0">
                          <button
                            onClick={() =>
                              downloadCertificate(cert.id, cert.certificateCode)
                            }
                            className="text-xs font-medium bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-50"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() =>
                              downloadQR(cert.id, cert.certificateCode)
                            }
                            className="text-xs font-medium bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-50"
                          >
                            QR
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* NOTIFICATIONS */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-3">
                  Notifications
                </h2>
                {notifications.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No new notifications.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notifications.slice(0, 5).map((note) => (
                      <div
                        key={note.id}
                        className={`p-3 rounded-lg border text-sm ${note.readAt ? "bg-white border-slate-100 opacity-70" : "bg-blue-50/50 border-blue-100"}`}
                      >
                        <div className="flex justify-between items-start">
                          <p
                            className={`font-semibold ${note.readAt ? "text-slate-700" : "text-blue-900"}`}
                          >
                            {note.title}
                          </p>
                          {!note.readAt && (
                            <button
                              onClick={() => markNotificationRead(note.id)}
                              className="text-[10px] uppercase font-bold tracking-wider text-blue-600 hover:text-blue-800"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                        <p className="text-slate-600 mt-1">{note.message}</p>
                        <p className="text-[11px] text-slate-400 mt-2">
                          {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
