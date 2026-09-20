"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncInspection =
  exports.startInspection =
  exports.getInspection =
  exports.listInspections =
  exports.getSyncStatus =
    void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const crypto_1 = __importDefault(require("crypto"));
const supabaseClient_1 = require("../utils/supabaseClient");
const notifications_1 = require("../utils/notifications");
const schemas_1 = require("../validation/schemas");
const getSyncStatus = async (req, res) => {
  const parsed = schemas_1.syncStatusSchema.safeParse({
    clientSyncId: req.query.clientSyncId,
  });
  if (!parsed.success)
    return res
      .status(400)
      .json({ success: false, message: "A valid clientSyncId is required." });
  const inspection = await prisma_1.default.inspection.findUnique({
    where: { clientSyncId: parsed.data.clientSyncId },
    include: { evidence: true },
  });
  if (!inspection)
    return res.json({
      success: true,
      syncStatus: "NOT_FOUND",
      clientSyncId: parsed.data.clientSyncId,
    });
  if (inspection.lmoId !== req.user.id)
    return res
      .status(403)
      .json({
        success: false,
        message: "This sync identifier belongs to another officer.",
      });
  return res.json({
    success: true,
    syncStatus: "SYNCED",
    clientSyncId: inspection.clientSyncId,
    inspection,
  });
};
exports.getSyncStatus = getSyncStatus;
const listInspections = async (req, res) => {
  const assignments = await prisma_1.default.assignment.findMany({
    where: { lmoId: req.user.id },
    include: {
      application: {
        include: {
          instrument: true,
          business: {
            select: { id: true, name: true, email: true, role: true },
          },
          inspections: {
            include: { evidence: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: { scheduledDate: "asc" },
  });
  return res.json({ success: true, assignments });
};
exports.listInspections = listInspections;
const getInspection = async (req, res) => {
  const assignment = await prisma_1.default.assignment.findUnique({
    where: { id: req.params.id },
    include: {
      application: {
        include: {
          instrument: true,
          business: {
            select: { id: true, name: true, email: true, role: true },
          },
          inspections: {
            include: { evidence: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      lmo: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!assignment)
    return res
      .status(404)
      .json({ success: false, message: "Inspection assignment not found." });
  if (req.user.role === "LMO" && assignment.lmoId !== req.user.id)
    return res
      .status(403)
      .json({
        success: false,
        message: "Inspection is not assigned to this officer.",
      });
  return res.json({ success: true, assignment });
};
exports.getInspection = getInspection;
const startInspection = async (req, res) => {
  const assignment = await prisma_1.default.assignment.findUnique({
    where: { id: req.params.id },
    include: { application: true },
  });
  if (!assignment)
    return res
      .status(404)
      .json({ success: false, message: "Inspection assignment not found." });
  if (assignment.lmoId !== req.user.id)
    return res
      .status(403)
      .json({
        success: false,
        message: "Inspection is not assigned to this officer.",
      });
  if (
    !["ASSIGNED", "SCHEDULED", "REINSPECTION_REQUIRED"].includes(
      assignment.application.status,
    )
  )
    return res
      .status(409)
      .json({
        success: false,
        message: `Inspection cannot start from ${assignment.application.status}.`,
      });
  const updated = await prisma_1.default.$transaction(async (tx) => {
    const application = await tx.application.update({
      where: { id: assignment.applicationId },
      data: { status: "INSPECTION_IN_PROGRESS" },
    });
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: assignment.applicationId,
        fromStatus: assignment.application.status,
        toStatus: "INSPECTION_IN_PROGRESS",
        changedById: req.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: "INSPECTION_STARTED",
        entityType: "APPLICATION",
        entityId: assignment.applicationId,
        oldValue: { status: assignment.application.status },
        newValue: { status: application.status },
      },
    });
    return application;
  });
  return res.json({ success: true, application: updated });
};
exports.startInspection = startInspection;
const syncInspection = async (req, res) => {
  let syncIdForError;
  try {
    let payload = req.body;
    if (typeof req.body.payload === "string") {
      try {
        payload = JSON.parse(req.body.payload);
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid sync payload." });
      }
    }
    const parsedPayload = schemas_1.syncSchema.safeParse(payload);
    if (!parsedPayload.success)
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid inspection sync payload.",
          errors: parsedPayload.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        });
    payload = parsedPayload.data;
    const {
      clientSyncId,
      assignmentId,
      result,
      remarks,
      failureReason,
      latitude,
      longitude,
      startedAt,
      completedAt,
      evidence = [],
      checklistResults = [],
    } = payload;
    syncIdForError = clientSyncId;
    if (
      !clientSyncId ||
      typeof clientSyncId !== "string" ||
      !assignmentId ||
      typeof assignmentId !== "string" ||
      !["PASS", "FAIL"].includes(result)
    )
      return res
        .status(400)
        .json({
          success: false,
          message:
            "clientSyncId, assignmentId and PASS/FAIL result are required.",
        });
    if (
      ![latitude, longitude].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      ) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    )
      return res
        .status(400)
        .json({
          success: false,
          message: "Valid GPS coordinates are required.",
        });
    if (
      !startedAt ||
      !completedAt ||
      Number.isNaN(Date.parse(startedAt)) ||
      Number.isNaN(Date.parse(completedAt)) ||
      Date.parse(completedAt) < Date.parse(startedAt)
    )
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Valid inspection start and completion timestamps are required.",
        });
    if (!Array.isArray(evidence))
      return res
        .status(400)
        .json({ success: false, message: "Evidence must be an array." });
    if (!Array.isArray(checklistResults) || !checklistResults.length)
      return res
        .status(400)
        .json({
          success: false,
          message: "Inspection checklist results are required.",
        });
    if (
      result === "PASS" &&
      (!remarks ||
        !evidence.length ||
        checklistResults.some((item) => item.passed !== true))
    )
      return res
        .status(400)
        .json({
          success: false,
          message:
            "A passing inspection requires remarks, evidence, and all checklist items passed.",
        });
    if (
      result === "FAIL" &&
      (!failureReason ||
        !remarks ||
        !evidence.length ||
        !checklistResults.some((item) => item.passed === false))
    )
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Failed inspections require remarks, a failure reason, evidence, and at least one failed checklist item.",
        });
    const existing = await prisma_1.default.inspection.findUnique({
      where: { clientSyncId },
      include: { evidence: true },
    });
    if (existing) {
      if (existing.lmoId !== req.user.id)
        return res
          .status(403)
          .json({
            success: false,
            message: "This sync identifier belongs to another officer.",
          });
      return res.json({
        success: true,
        syncStatus: "SYNCED",
        duplicate: true,
        inspection: existing,
      });
    }
    const assignment = await prisma_1.default.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        application: { include: { instrument: { select: { type: true } } } },
      },
    });
    if (!assignment || assignment.lmoId !== req.user.id)
      return res
        .status(403)
        .json({
          success: false,
          message: "Inspection is not assigned to this officer.",
        });
    if (
      ![
        "ASSIGNED",
        "SCHEDULED",
        "INSPECTION_IN_PROGRESS",
        "REINSPECTION_REQUIRED",
      ].includes(assignment.application.status)
    )
      return res
        .status(400)
        .json({
          success: false,
          message: "Application is not ready for inspection.",
        });
    const files = req.files || [];
    if (files.length !== evidence.length)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Every inspection evidence record must include one uploaded evidence file.",
        });
    const checklistItemIds = checklistResults.map(
      (item) => item.checklistItemId,
    );
    if (
      checklistItemIds.some((id) => typeof id !== "string") ||
      new Set(checklistItemIds).size !== checklistItemIds.length
    )
      return res
        .status(400)
        .json({
          success: false,
          message: "Checklist item identifiers must be unique and valid.",
        });
    const configuredTemplate =
      await prisma_1.default.checklistTemplate.findFirst({
        where: {
          active: true,
          OR: [
            { instrumentType: assignment.application.instrument.type },
            { instrumentType: null },
          ],
        },
        include: { items: { select: { id: true, required: true } } },
        orderBy: { createdAt: "desc" },
      });
    const configuredItems = configuredTemplate?.items || [];
    const configuredIds = new Set(configuredItems.map((item) => item.id));
    if (
      !configuredTemplate ||
      configuredItems.some(
        (item) =>
          item.required &&
          !checklistResults.some(
            (result) => result.checklistItemId === item.id,
          ),
      ) ||
      checklistItemIds.some((id) => !configuredIds.has(id))
    )
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Checklist results must include every required item from the active instrument checklist.",
        });
    if (
      evidence.some(
        (item) =>
          typeof item?.fileUrl !== "string" ||
          !item.fileUrl.trim() ||
          ![
            "instrument overview",
            "serial/nameplate",
            "seal/marking",
            "observation",
            "other",
          ].includes(item.evidenceType || "other"),
      )
    )
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Each evidence record requires a file URL and valid evidence type.",
        });
    const uploadedEvidence = [...evidence];
    if (files.length) {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const extension =
          (file.originalname.split(".").pop() || "bin")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 8) || "bin";
        const storagePath = `inspections/${assignmentId}/${clientSyncId}-${index}.${extension}`;
        const { error } = await supabaseClient_1.supabase.storage
          .from("evidence")
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
          });
        if (error)
          return res
            .status(502)
            .json({
              success: false,
              syncStatus: "FAILED",
              message: "Evidence upload failed; inspection was not finalized.",
            });
        const { data } = supabaseClient_1.supabase.storage
          .from("evidence")
          .getPublicUrl(storagePath);
        const metadata = evidence[index] || {};
        uploadedEvidence[index] = {
          ...metadata,
          evidenceType: metadata.evidenceType || "other",
          fileUrl: data.publicUrl,
          fileHash: crypto_1.default
            .createHash("sha256")
            .update(file.buffer)
            .digest("hex"),
        };
      }
    }
    const inspection = await prisma_1.default.$transaction(async (tx) => {
      const created = await tx.inspection.create({
        data: {
          clientSyncId,
          result,
          remarks,
          failureReason,
          latitude: Number(latitude),
          longitude: Number(longitude),
          startedAt: new Date(startedAt),
          completedAt: new Date(completedAt),
          applicationId: assignment.applicationId,
          lmoId: req.user.id,
          evidence: {
            create: uploadedEvidence.map((item) => ({
              evidenceType: item.evidenceType || "other",
              fileUrl: item.fileUrl,
              fileHash: item.fileHash || "",
              latitude: Number(item.latitude ?? latitude),
              longitude: Number(item.longitude ?? longitude),
              capturedAt: new Date(item.capturedAt || completedAt),
            })),
          },
          checklistResults: {
            create: checklistResults.map((item) => ({
              checklistItemId: item.checklistItemId,
              observedValue: item.observedValue,
              passed: item.passed === true,
              remarks: item.remarks,
            })),
          },
        },
        include: { evidence: true },
      });
      await tx.application.update({
        where: { id: assignment.applicationId },
        data: {
          status: result === "PASS" ? "PASSED" : "REINSPECTION_REQUIRED",
          remarks,
        },
      });
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: assignment.applicationId,
          fromStatus: assignment.application.status,
          toStatus: result === "PASS" ? "PASSED" : "REINSPECTION_REQUIRED",
          changedById: req.user.id,
          metadata: { inspectionId: created.id, result },
        },
      });
      await tx.instrument.update({
        where: { id: assignment.application.instrumentId },
        data: { status: result === "PASS" ? "VERIFIED" : "REJECTED" },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: result === "PASS" ? "INSPECTION_PASSED" : "INSPECTION_FAILED",
          entityType: "INSPECTION",
          entityId: created.id,
          newValue: { clientSyncId, result },
        },
      });
      await (0, notifications_1.createNotification)(
        tx,
        assignment.application.businessId,
        result === "PASS" ? "INSPECTION_COMPLETED" : "REINSPECTION_REQUIRED",
        result === "PASS" ? "Inspection passed" : "Reinspection required",
        result === "PASS"
          ? "Your inspection passed and is eligible for certificate issuance."
          : "Your inspection failed and requires reinspection.",
      );
      return created;
    });
    return res
      .status(201)
      .json({ success: true, syncStatus: "SYNCED", inspection });
  } catch (error) {
    if (error?.code === "P2002") {
      const existing = syncIdForError
        ? await prisma_1.default.inspection.findUnique({
            where: { clientSyncId: syncIdForError },
            include: { evidence: true },
          })
        : null;
      if (existing)
        return res.json({
          success: true,
          syncStatus: "SYNCED",
          duplicate: true,
          inspection: existing,
        });
    }
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Inspection sync failed.",
      });
  }
};
exports.syncInspection = syncInspection;
