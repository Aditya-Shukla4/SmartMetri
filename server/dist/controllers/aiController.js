"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.processApplicationImage = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));

const processApplicationImage = async (req, res) => {
  try {
    const { applicationId } = req.body;

    // 1. Check if application exists
    const application = await prisma_1.default.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res
        .status(400)
        .json({ success: false, message: "Application not found." });
    }

    // 2. Simulate AI Processing Time (2 seconds) - UI mein loading spinner dikhane ke liye
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. Randomly decide if AI flags a risk (30% chance of flag)
    const isFlagged = Math.random() < 0.3;
    const aiRiskStatus = isFlagged ? "FLAGGED" : "SAFE";
    const aiFlags = isFlagged
      ? [
          "Blurry serial number",
          "Seal appears broken",
          "Date tampering suspected",
        ]
      : [];

    // 4. Mock OCR Data extraction
    const extractedData = {
      extractedSerial: "SN-MEERUT-" + Math.floor(Math.random() * 99999),
      confidence: (Math.random() * (99 - 85) + 85).toFixed(1) + "%", // Random confidence between 85% to 99%
      brandDetected: "Avery Weigh-Tronix",
    };

    // Note: Hum Prisma update hata rahe hain taaki DB schema error na aaye.
    // Data seedha frontend ko bhej rahe hain.

    res.status(200).json({
      success: true,
      message: "AI Processing Complete",
      aiResult: {
        status: aiRiskStatus,
        flags: aiFlags,
        ocr: extractedData,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "AI Processing failed" });
  }
};
exports.processApplicationImage = processApplicationImage;
