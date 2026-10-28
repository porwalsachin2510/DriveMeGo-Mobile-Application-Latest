import mongoose from "mongoose"

const emergencyContactSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 80 },
        phone: { type: String, required: true, trim: true },
        relationship: { type: String, trim: true, maxlength: 40, default: "Family" },
        isPrimary: { type: Boolean, default: false },
        notifyOnTrip: { type: Boolean, default: true },
    },
    { timestamps: true },
)

emergencyContactSchema.index({ user: 1, phone: 1 }, { unique: true })

export default mongoose.models.EmergencyContact || mongoose.model("EmergencyContact", emergencyContactSchema)
