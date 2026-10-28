import mongoose from "mongoose"

const referralSchema = new mongoose.Schema(
    {
        referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        // A user can only ever be referred once.
        referee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        code: { type: String, required: true, uppercase: true, trim: true },
        status: { type: String, enum: ["JOINED", "FIRST_BOOKING", "REWARDED"], default: "JOINED" },
    },
    { timestamps: true },
)

export default mongoose.models.Referral || mongoose.model("Referral", referralSchema)
