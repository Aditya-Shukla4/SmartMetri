"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAssignment =
  exports.listAssignments =
  exports.assignApplication =
  exports.listLMOs =
    void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));

// ==========================================
// 🚀 AI RISK DETECTION ENGINE (Mock Logic)
// ==========================================
function calculateAIRisk(ageInYears, pastFailures) {
  let score = 0;
  // Rule 1: Purana instrument
  if (ageInYears > 5) score += 30;
  // Rule 2: Pehle fail ho chuka hai
  if (pastFailures >= 1) score += 40;
  // Rule 3: Thoda purana par fail nahi hua
  if (ageInYears > 2 && pastFailures === 0) score += 15;

  if (score >= 70) return { score, level: "High Risk", color: "#EF4444" }; // Red
  if (score >= 30) return { score, level: "Medium Risk", color: "#F59E0B" }; // Orange
  return { score: 15, level: "Low Risk", color: "#10B981" }; // Green
}
// ==========================================

const listLMOs = async (_req, res) => {
  const lmos = await prisma_1.default.user.findMany({
    where: { role: "LMO" },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
  });
  return res.json({ success: true, lmos });
};
exports.listLMOs = listLMOs;

const assignApplication = async (req, res) => {
  try {
    const { applicationId, lmoId, scheduledDate } = req.body;
    if (
      typeof applicationId !== "string" ||
      typeof lmoId !== "string" ||
      typeof scheduledDate !== "string" ||
      Number.isNaN(Date.parse(scheduledDate))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "applicationId, lmoId, and a valid scheduledDate are required.",
      });
    }
    // Validate LMO exists and is actually an LMO
    const lmoUser = await prisma_1.default.user.findUnique({
      where: { id: lmoId },
    });
    if (!lmoUser || lmoUser.role !== "LMO") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid LMO selected." });
    }
    // Validate Application
    const application = await prisma_1.default.application.findUnique({
      where: { id: applicationId },
    });
    if (!application)
      return res
        .status(404)
        .json({ success: false, message: "Application not found." });
    if (
      !["SUBMITTED", "UNDER_REVIEW", "REINSPECTION_REQUIRED"].includes(
        application.status,
      )
    )
      return res.status(409).json({
        success: false,
        message: `Application cannot be assigned from ${application.status}.`,
      });
    const scheduled = new Date(scheduledDate);
    const duplicate = await prisma_1.default.assignment.findFirst({
      where: { applicationId, lmoId, scheduledDate: scheduled },
    });
    if (duplicate)
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: "This inspection assignment already exists.",
        assignment: duplicate,
      });
    // Transaction: Assign and Update Status
    const [assignment] = await prisma_1.default.$transaction([
      prisma_1.default.assignment.create({
        data: { applicationId, lmoId, scheduledDate: scheduled },
      }),
      prisma_1.default.application.update({
        where: { id: applicationId },
        data: { status: "SCHEDULED" },
      }),
      prisma_1.default.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: application.status,
          toStatus: "SCHEDULED",
          changedById: req.user.id,
          metadata: { lmoId, scheduledDate },
        },
      }),
      prisma_1.default.auditLog.create({
        data: {
          userId: req.user.id,
          action: "INSPECTION_SCHEDULED",
          entityType: "APPLICATION",
          entityId: applicationId,
          oldValue: { status: application.status },
          newValue: { status: "SCHEDULED", lmoId, scheduledDate },
        },
      }),
      prisma_1.default.notification.create({
        data: {
          userId: application.businessId,
          type: "APPLICATION_ASSIGNED",
          title: "Inspection assigned",
          message: `Application ${applicationId} was assigned and scheduled for inspection.`,
        },
      }),
      prisma_1.default.notification.create({
        data: {
          userId: lmoId,
          type: "INSPECTION_SCHEDULED",
          title: "Inspection scheduled",
          message: `You have been assigned application ${applicationId}.`,
        },
      }),
    ]);
    res.status(201).json({
      success: true,
      message: "Inspection assigned successfully",
      assignment,
    });
  } catch (error) {
    if (error?.code === "P2002")
      return res.status(409).json({
        success: false,
        message: "This inspection assignment already exists.",
      });
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.assignApplication = assignApplication;

const listAssignments = async (req, res) => {
  const where = req.user?.role === "LMO" ? { lmoId: req.user.id } : {};
  const assignments = await prisma_1.default.assignment.findMany({
    where,
    include: {
      application: {
        include: {
          instrument: true,
          business: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      lmo: {
        select: { id: true, name: true, email: true, phone: true, role: true },
      },
    },
    orderBy: { scheduledDate: "asc" },
  });

  // ==========================================
  // 🚀 INJECTING AI DATA BEFORE SENDING TO UI
  // ==========================================
  const enrichedAssignments = assignments.map((assignment) => {
    // Demo ke liye random historical data create kar rahe hain
    const mockAge = Math.floor(Math.random() * 8); // 0-8 saal purana
    const mockFailures = Math.random() > 0.7 ? 1 : 0; // 30% chance of failure

    return {
      ...assignment,
      application: {
        ...assignment.application,
        aiAnalysis: calculateAIRisk(mockAge, mockFailures),
      },
    };
  });

  return res.json({ success: true, assignments: enrichedAssignments });
};
exports.listAssignments = listAssignments;

const updateAssignment = async (req, res) => {
  const assignment = await prisma_1.default.assignment.findUnique({
    where: { id: req.params.id },
    include: { application: true },
  });
  if (!assignment)
    return res
      .status(404)
      .json({ success: false, message: "Inspection assignment not found." });
  if (
    ![
      "SUBMITTED",
      "UNDER_REVIEW",
      "ASSIGNED",
      "SCHEDULED",
      "REINSPECTION_REQUIRED",
    ].includes(assignment.application.status)
  )
    return res.status(409).json({
      success: false,
      message: `Assignment cannot be changed from ${assignment.application.status}.`,
    });
  const lmoId =
    typeof req.body.lmoId === "string" ? req.body.lmoId : assignment.lmoId;
  const scheduledDate =
    typeof req.body.scheduledDate === "string"
      ? new Date(req.body.scheduledDate)
      : assignment.scheduledDate;
  if (Number.isNaN(scheduledDate.getTime()))
    return res
      .status(400)
      .json({ success: false, message: "A valid scheduledDate is required." });
  const lmo = await prisma_1.default.user.findUnique({
    where: { id: lmoId },
    select: { id: true, role: true },
  });
  if (!lmo || lmo.role !== "LMO")
    return res
      .status(400)
      .json({ success: false, message: "Invalid LMO selected." });
  const updated = await prisma_1.default.$transaction(async (tx) => {
    const result = await tx.assignment.update({
      where: { id: assignment.id },
      data: { lmoId, scheduledDate },
    });
    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: "ASSIGNMENT_UPDATED",
        entityType: "ASSIGNMENT",
        entityId: assignment.id,
        oldValue: {
          lmoId: assignment.lmoId,
          scheduledDate: assignment.scheduledDate,
        },
        newValue: { lmoId, scheduledDate },
      },
    });
    await tx.notification.create({
      data: {
        userId: lmoId,
        type: "INSPECTION_SCHEDULED",
        title: "Inspection assignment updated",
        message: `Your inspection assignment for application ${assignment.applicationId} has been updated.`,
      },
    });
    return result;
  });
  return res.json({ success: true, assignment: updated });
};
exports.updateAssignment = updateAssignment;
