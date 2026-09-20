import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiServices } from "../services/api";
import {
  apiErrorMessage,
  type Application,
  type AuditLog,
  type DashboardMetrics,
  type Instrument,
} from "../types";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [lmos, setLmos] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [users, setUsers] = useState<
    {
      id: string;
      name: string;
      email: string;
      role: string;
      stateId?: string | null;
      districtId?: string | null;
    }[]
  >([]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  const fetchAllInstruments = async () => {
    try {
      const response = await apiServices.getAllInstruments();
      const fetchedData = response.data.instruments || response.data.data || [];
      setInstruments(fetchedData);
    } catch (error: unknown) {
      console.error("[API ERROR] Fetching ALL instruments failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshApplications = async () => {
    try {
      const response = await apiServices.getApplications();
      setApplications(response.data.applications || []);
    } catch {
      setApplications([]);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAllInstruments();
      void refreshApplications();
      void apiServices
        .getAdminDashboard()
        .then((res) => setMetrics(res.data.metrics))
        .catch(() => setMetrics(null));
      void apiServices
        .getAuditLogs()
        .then((res) => setAuditLogs(res.data.logs || []))
        .catch(() => setAuditLogs([]));
      void apiServices
        .getLMOs()
        .then((res) => setLmos(res.data.lmos || []))
        .catch(() => setLmos([]));
      void apiServices
        .getUsers()
        .then((res) => setUsers(res.data.users || []))
        .catch(() => setUsers([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const advance = async (id: string, status: string) => {
    try {
      await apiServices.updateApplicationStatus(id, status);
      await refreshApplications();
    } catch (error: unknown) {
      alert(apiErrorMessage(error, "Status update failed."));
    }
  };

  const assign = async (applicationId: string) => {
    const roster = lmos
      .map((lmo, index) => `[ ${index + 1} ] - ${lmo.name} (${lmo.email})`)
      .join("\n");

    const selection = window.prompt(
      `Enter the NUMBER of the LMO from the list:\n\n${roster}`,
    );
    if (!selection) return;

    const selectedIndex = parseInt(selection, 10) - 1;

    if (
      isNaN(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= lmos.length
    ) {
      alert("[!] Invalid selection. Please enter a valid number.");
      return;
    }

    const lmoId = lmos[selectedIndex].id;
    const today = new Date().toISOString().split("T")[0];
    const dateInput = window.prompt("Scheduled Date (YYYY-MM-DD):", today);
    if (!dateInput) return;

    try {
      const scheduledDate = new Date(dateInput).toISOString();
      await apiServices.assignApplication(applicationId, lmoId, scheduledDate);
      await refreshApplications();
      alert("✅ LMO Assigned Successfully!");
    } catch (error: unknown) {
      alert(apiErrorMessage(error, "Assignment failed."));
    }
  };

  const issue = async (applicationId: string) => {
    const validUntil = window.prompt(
      "Valid until (ISO date, per applicable departmental rule):",
    );
    if (!validUntil) return;
    try {
      await apiServices.issueCertificate(applicationId, validUntil);
      await refreshApplications();
    } catch (error: unknown) {
      alert(apiErrorMessage(error, "Certificate issuance failed."));
    }
  };

  const reschedule = async (application: Application) => {
    const assignment = application.assignments?.[0];
    if (!assignment) return alert("No assignment exists for this application.");
    const scheduledDate = window.prompt(
      "New scheduled date/time (ISO):",
      new Date(assignment.scheduledDate).toISOString(),
    );
    if (!scheduledDate) return;
    const lmoId =
      window.prompt(
        "New LMO ID (leave blank to keep current):",
        assignment.lmoId,
      ) || undefined;
    try {
      await apiServices.updateAssignment(assignment.id, {
        scheduledDate,
        lmoId,
      });
      await refreshApplications();
    } catch (error: unknown) {
      alert(apiErrorMessage(error, "Assignment update failed."));
    }
  };

  const exportApplications = async () => {
    try {
      const response = await apiServices.exportApplications();
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "smartmetri-applications.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Report export failed.");
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    const previousInstruments = [...instruments];
    setInstruments(
      instruments.map((inst) =>
        inst.id === id ? { ...inst, status: newStatus } : inst,
      ),
    );

    try {
      await apiServices.updateInstrumentStatus(id, newStatus);
    } catch {
      alert("[!] ERROR: Failed to update status.");
      setInstruments(previousInstruments);
    }
  };

  // Helper for Status Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
      case "PASSED":
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold">
            {status}
          </span>
        );
      case "REJECTED":
      case "FAILED":
        return (
          <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full text-xs font-semibold">
            {status}
          </span>
        );
      case "SCHEDULED":
      case "ASSIGNED":
      case "UNDER_REVIEW":
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold">
            {status.replace("_", " ")}
          </span>
        );
      default:
        return (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-semibold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      {/* HEADER */}
      <header className="max-w-7xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Legal Metrology Portal
          </h1>
          <p className="text-sm font-medium text-emerald-600 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            ADMIN CONTROL CENTER
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col md:items-end text-sm">
          <p className="font-semibold text-slate-800">System Administrator</p>
          <p className="text-slate-500 mb-2">Role: Admin</p>
          <button
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 font-semibold px-4 py-1.5 border border-red-200 hover:bg-red-50 rounded-lg transition-colors w-max"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* METRICS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Instruments", value: metrics?.totalInstruments },
            { label: "Pending Apps", value: metrics?.pendingApplications },
            { label: "Today's Inspections", value: metrics?.todaysInspections },
            { label: "Failed Inspections", value: metrics?.failedInspections },
            { label: "Reinspections", value: metrics?.reinspectionCases },
            { label: "Expiring Certs", value: metrics?.expiringCertificates },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-center"
            >
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {stat.label}
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {stat.value ?? "—"}
              </div>
            </div>
          ))}
        </div>

        {/* APPLICATION REVIEW & WORKFLOW */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between bg-slate-50">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Application Review & Workflow
              </h2>
              <p className="text-sm text-slate-500">
                Manage verification requests and assign LMOs
              </p>
            </div>
            <button
              onClick={exportApplications}
              className="mt-3 md:mt-0 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
            >
              Export Report (CSV)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Application</th>
                  <th className="px-6 py-4">Business</th>
                  <th className="px-6 py-4">Evidence</th>
                  <th className="px-6 py-4">AI Risk Assessment</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => {
                  const inspectionEvidence =
                    app.inspections?.flatMap((i) => i.evidence || []) || [];
                  // Demo AI fallback if backend hasn't provided aiAnalysis
                  const aiData = (app as any).aiAnalysis || {
                    level: "Standard Review",
                    score: 15,
                    color: "#10B981",
                  };

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {app.applicationCode}
                        </div>
                        <div className="text-xs text-slate-500">
                          S/N: {app.instrument?.serialNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {app.business?.name || app.businessId.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {app.evidenceUrls?.map((url, i) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200"
                            >
                              APP FILE {i + 1}
                            </a>
                          ))}
                          {inspectionEvidence.map((ev, i) => (
                            <a
                              key={ev.id}
                              href={ev.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200"
                            >
                              LMO FILE {i + 1}
                            </a>
                          ))}
                          {!app.evidenceUrls?.length &&
                            !inspectionEvidence.length && (
                              <span className="text-xs text-slate-400">
                                No Evidence
                              </span>
                            )}
                        </div>
                      </td>

                      {/* 🚀 AI RISK BADGE */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide w-max"
                            style={{
                              backgroundColor: `${aiData.color}15`,
                              color: aiData.color,
                              border: `1px solid ${aiData.color}40`,
                            }}
                          >
                            {aiData.level}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Anomaly Score: {aiData.score}/100
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {getStatusBadge(app.status)}
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        {app.status === "SUBMITTED" && (
                          <button
                            onClick={() => advance(app.id, "UNDER_REVIEW")}
                            className="bg-slate-800 text-white hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            Review
                          </button>
                        )}
                        {app.status === "UNDER_REVIEW" && (
                          <button
                            onClick={() => assign(app.id)}
                            className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            Assign LMO
                          </button>
                        )}
                        {app.status === "PASSED" && (
                          <button
                            onClick={() => issue(app.id)}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            Issue Cert
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {applications.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No applications found in the queue.
              </div>
            )}
          </div>
        </div>

        {/* TWO COLUMN LAYOUT: SCHEDULE & DIRECTORY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* SCHEDULED ASSIGNMENTS */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-3">
              Scheduled Assignments
            </h2>
            {applications.filter((app) => app.assignments?.length).length ===
            0 ? (
              <p className="text-sm text-slate-500">
                No active assignments scheduled.
              </p>
            ) : (
              <div className="space-y-3">
                {applications
                  .filter((app) => app.assignments?.length)
                  .map((app) => {
                    const assignment = app.assignments![0];
                    return (
                      <div
                        key={assignment.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {app.applicationCode}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(
                              assignment.scheduledDate,
                            ).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => reschedule(app)}
                          className="mt-2 sm:mt-0 text-xs font-medium bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors"
                        >
                          Reschedule
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* STAKEHOLDER DIRECTORY */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-3">
              Stakeholder Directory
            </h2>
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No users found.</p>
            ) : (
              <div className="overflow-y-auto max-h-[300px] pr-2">
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {user.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {user.email}
                        </div>
                      </div>
                      <div className="mt-1 sm:mt-0 text-right">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          {user.role}
                        </span>
                        <div className="text-xs text-slate-400 mt-1">
                          {user.stateId || "N/A"} - {user.districtId || "N/A"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* REGISTRY & AUDIT (BOTTOM SECTIONS) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* AUDIT TRAIL */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-3">
              Recent Audit Trail
            </h2>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity.</p>
            ) : (
              <div className="space-y-4">
                {auditLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="relative pl-4 border-l-2 border-slate-200"
                  >
                    <div className="absolute w-2 h-2 bg-slate-400 rounded-full -left-[5px] top-1.5"></div>
                    <p className="text-xs font-semibold text-slate-800">
                      {log.action}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      By: {log.user?.name || "System"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GLOBAL INSTRUMENT REGISTRY */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-900">
                Global Instrument Registry
              </h2>
              <span className="bg-slate-200 text-slate-700 py-1 px-3 rounded-full text-xs font-semibold">
                Total: {instruments.length}
              </span>
            </div>
            <div className="p-0">
              {loading ? (
                <div className="p-8 text-center text-slate-500 animate-pulse">
                  Loading registry...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                      <tr>
                        <th className="px-6 py-4">Instrument</th>
                        <th className="px-6 py-4">Details</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {instruments.map((inst) => (
                        <tr
                          key={inst.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">
                              {inst.instrumentCode}
                            </div>
                            <div className="text-xs text-slate-500">
                              S/N: {inst.serialNumber}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase">
                              ID: {inst.businessId.substring(0, 6)}...
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-700">
                              {inst.type}
                            </div>
                            <div className="text-xs text-slate-500">
                              {inst.manufacturer} - {inst.model}
                            </div>
                            <div className="text-xs text-slate-500">
                              Cap: {inst.capacity}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(inst.status)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {inst.status !== "VERIFIED" && (
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(inst.id, "VERIFIED")
                                  }
                                  className="bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded font-medium text-xs transition-colors"
                                >
                                  Approve 
                                </button>
                              )}
                              {inst.status !== "REJECTED" && (
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(inst.id, "REJECTED")
                                  }
                                  className="bg-white border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1.5 rounded font-medium text-xs transition-colors"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {instruments.length === 0 && (
                    <div className="p-8 text-center text-slate-400">
                      No instruments registered globally.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
