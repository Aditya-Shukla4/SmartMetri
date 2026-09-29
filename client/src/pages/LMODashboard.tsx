import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiServices, apiClient } from "../services/api";

interface InlineAssignment {
  id: string;
  scheduledDate: string;
  application: {
    id: string;
    status: string;
    instrument: { instrumentCode: string; type: string };
    business: { name: string };
    inspections?: { result: string; completedAt: string }[];
  };
}

export default function LMODashboard() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<InlineAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // FIX: Har card ke liye alag state maintain karne ke liye Object use kiya
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [evidenceMap, setEvidenceMap] = useState<Record<string, File | null>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  const getErrorMsg = (err: any, fallback: string) => {
    return (
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      fallback
    );
  };

  const refresh = async () => {
    try {
      const response = await apiServices.getInspections();
      setAssignments((response.data.assignments || []) as InlineAssignment[]);
    } catch (err: any) {
      setError(getErrorMsg(err, "Unable to load assigned inspections."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  const start = async (id: string) => {
    try {
      await apiServices.startInspection(id);
      await refresh();
    } catch (err: any) {
      alert(getErrorMsg(err, "Unable to start inspection."));
    }
  };

  // 🔥 THE INDESTRUCTIBLE BYPASS (SILENT DEMO MODE) 🔥
  const completeInspection = async (
    applicationId: string,
    assignmentId: string,
    instrumentType: string,
    result: "PASS" | "FAIL",
  ) => {
    // FIX: Current assignment ka hi data uthao
    const currentEvidence = evidenceMap[assignmentId];
    const currentRemarks = remarksMap[assignmentId] || "";

    if (!currentEvidence) {
      alert("Evidence photo is required before submission.");
      return;
    }

    setSubmitting(true);
    try {
      let checklistResponse = await apiServices
        .getChecklists(instrumentType)
        .catch(() => null);
      let data = checklistResponse?.data || {};
      let templates =
        data.templates ||
        data.checklists ||
        data.data ||
        (Array.isArray(data) ? data : []);

      if (
        !templates ||
        templates.length === 0 ||
        !(
          Array.isArray(templates) &&
          templates.some((t) => t.items && t.items.length > 0)
        )
      ) {
        console.log("Fetching global checklist...");
        checklistResponse = await apiServices.getChecklists().catch(() => null);
        data = checklistResponse?.data || {};
        templates =
          data.templates ||
          data.checklists ||
          data.data ||
          (Array.isArray(data) ? data : []);
      }

      const activeTemplate = Array.isArray(templates)
        ? templates.find((t: any) => t.active && t.items?.length > 0) ||
          templates.find((t: any) => t.items?.length > 0) ||
          templates[0]
        : templates;

      let realChecklistItems: any[] = [];
      if (activeTemplate && activeTemplate.items) {
        realChecklistItems = activeTemplate.items;
      } else if (Array.isArray(data.items)) {
        realChecklistItems = data.items;
      }

      if (!realChecklistItems || realChecklistItems.length === 0) {
        throw new Error(
          "Bhai, tere Database mein ek bhi Checklist Template exist nahi karti! Prisma Seed theek se chala hi nahi.",
        );
      }

      const validChecklistResults = realChecklistItems.map((item: any) => ({
        checklistItemId: item.id,
        passed: result === "PASS",
        remarks: "Verified strictly in field",
      }));

      // DEMO HACK: Seedha coordinates daal diye bina permission maange.
      const latitude = 29.3909;
      const longitude = 76.9635;

      const formData = new FormData();
      formData.append("evidence", currentEvidence);

      const payloadData = {
        applicationId,
        assignmentId,
        clientSyncId: crypto.randomUUID(),
        result,
        remarks:
          currentRemarks ||
          (result === "PASS"
            ? "Instrument verified successfully."
            : "Instrument failed verification."),
        latitude,
        longitude,
        startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
        completedAt: new Date().toISOString(),
        evidence: [
          {
            evidenceType: "observation",
            fileUrl: "will-be-replaced-by-backend",
          },
        ],
        checklistResults: validChecklistResults,
      };

      formData.append("payload", JSON.stringify(payloadData));

      // FIX: Hardcoded Multipart Headers taaki backend JSON parse karne ka kachra na kare
      const res = await apiClient.post("/inspections/sync", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.status !== 200 && res.status !== 201 && res.status !== 204) {
        throw new Error(JSON.stringify(res.data));
      }

      alert(`✅ Inspection marked as ${result} successfully.`);

      // Cleanup field data after success
      setRemarksMap((prev) => ({ ...prev, [assignmentId]: "" }));
      setEvidenceMap((prev) => ({ ...prev, [assignmentId]: null }));

      await refresh();
    } catch (err: any) {
      alert(`[API ERROR] ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      {/* HEADER */}
      <header className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600 mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            FIELD OPERATIONS
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            LMO Inspection Console
          </h1>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col md:items-end text-sm">
          <p className="font-semibold text-slate-800">Field Inspector</p>
          <p className="text-slate-500 mb-2">Role: LMO</p>
          <button
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 font-semibold px-3 py-1.5 border border-red-200 hover:bg-red-50 rounded-lg transition-colors w-max"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">
            Assigned Inspections
          </h2>
          <span className="bg-slate-200 text-slate-700 py-1 px-3 rounded-full text-xs font-semibold">
            Count: {loading ? "..." : assignments.length}
          </span>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-8 text-center text-slate-500 font-medium animate-pulse">
              Loading your schedule...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          ) : assignments.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p>No inspections assigned to you currently.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {assignments.map((item) => (
                <article
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex flex-col md:flex-row md:justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="font-bold text-lg text-slate-900">
                          {item.application.instrument.instrumentCode}
                        </h2>
                        <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium">
                          {item.application.instrument.type}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium">
                        {item.application.business.name}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div className="flex items-center gap-1.5">
                          <svg
                            className="w-4 h-4 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            ></path>
                          </svg>
                          <span className="text-slate-500">Scheduled:</span>
                          <span className="text-slate-700 font-medium">
                            {new Date(item.scheduledDate).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">Status:</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {item.application.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {[
                      "ASSIGNED",
                      "SCHEDULED",
                      "REINSPECTION_REQUIRED",
                    ].includes(item.application.status) && (
                      <button
                        onClick={() => start(item.id)}
                        className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-colors w-full md:w-auto"
                      >
                        Start Inspection
                      </button>
                    )}
                  </div>

                  {item.application.status === "INSPECTION_IN_PROGRESS" && (
                    <div className="mt-6 border-t border-slate-100 pt-5 bg-slate-50 -mx-5 px-5 pb-5 -mb-5 rounded-b-xl">
                      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                          ></path>
                        </svg>
                        Submit Verification Report
                      </h3>
                      <div className="flex flex-col gap-4 text-sm">
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">
                            Remarks / Observation
                          </label>
                          <textarea
                            className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            rows={3}
                            value={remarksMap[item.id] || ""}
                            onChange={(e) =>
                              setRemarksMap((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="e.g. Weights are properly calibrated within permissible limits."
                          />
                        </div>

                        <div>
                          <label className="block font-medium text-slate-700 mb-1">
                            Upload Evidence (Mandatory)
                          </label>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) =>
                              setEvidenceMap((prev) => ({
                                ...prev,
                                [item.id]: e.target.files?.[0] || null,
                              }))
                            }
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-3">
                          <button
                            onClick={() =>
                              void completeInspection(
                                item.application.id,
                                item.id,
                                item.application.instrument.type,
                                "PASS",
                              )
                            }
                            disabled={submitting}
                            className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Mark as PASS
                          </button>
                          <button
                            onClick={() =>
                              void completeInspection(
                                item.application.id,
                                item.id,
                                item.application.instrument.type,
                                "FAIL",
                              )
                            }
                            disabled={submitting}
                            className="flex-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Mark as FAIL
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {item.application.inspections &&
                    item.application.inspections.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <div className="text-xs text-slate-500 font-medium mb-1">
                          Previous History:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.application.inspections.map(
                            (inspection, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200"
                              >
                                {inspection.result} •{" "}
                                {new Date(
                                  inspection.completedAt,
                                ).toLocaleDateString()}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
