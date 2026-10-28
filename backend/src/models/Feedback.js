import mongoose from "mongoose"

export const FEEDBACK_CATEGORIES = ["GENERAL", "APP", "DRIVER", "ROUTE", "PAYMENT", "SUGGESTION", "COMPLAINT"]

const feedbackSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        role: { type: String, trim: true },
        category: { type: String, enum: FEEDBACK_CATEGORIES, default: "GENERAL" },
        rating: { type: Number, min: 1, max: 5, required: true },
        subject: { type: String, trim: true, maxlength: 120, required: true },
        message: { type: String, trim: true, maxlength: 2000, required: true },
        status: { type: String, enum: ["OPEN", "REVIEWED", "RESOLVED"], default: "OPEN", index: true },
        adminResponse: { type: String, trim: true, maxlength: 2000 },
        respondedAt: { type: Date },
    },
    { timestamps: true },
)

export default mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema)
