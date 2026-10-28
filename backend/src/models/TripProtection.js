import mongoose from "mongoose"

const tripProtectionSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: "B2CPassengerBooking", required: true, index: true },
        plan: { type: String, enum: ["BASIC", "PLUS"], required: true },
        premium: { type: Number, required: true, min: 0 },
        currency: { type: String, enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"], required: true },
        refundPercent: { type: Number, min: 0, max: 100, required: true },
        status: { type: String, enum: ["PENDING", "ACTIVE", "CLAIMED"], default: "PENDING", index: true },
        claim: {
            reason: { type: String, trim: true, maxlength: 1000 },
            status: { type: String, enum: ["SUBMITTED", "APPROVED", "REJECTED"] },
            submittedAt: { type: Date },
            decidedAt: { type: Date },
            adminNote: { type: String, trim: true, maxlength: 1000 },
        },
    },
    { timestamps: true },
)

// One live protection per booking.
tripProtectionSchema.index(
    { booking: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ["PENDING", "ACTIVE", "CLAIMED"] } } },
)

export default mongoose.models.TripProtection || mongoose.model("TripProtection", tripProtectionSchema)
