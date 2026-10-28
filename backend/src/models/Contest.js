import mongoose from "mongoose"

const contestSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 160 },
        description: { type: String, trim: true, maxlength: 2000 },
        prize: { type: String, trim: true, maxlength: 200 },
        rules: [{ type: String, trim: true }],
        coverImage: { type: String, trim: true },
        startsAt: { type: Date, required: true },
        endsAt: { type: Date, required: true },
        maxWinners: { type: Number, default: 1, min: 1 },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true },
)

export const Contest = mongoose.models.Contest || mongoose.model("Contest", contestSchema)

const contestEntrySchema = new mongoose.Schema(
    {
        contest: { type: mongoose.Schema.Types.ObjectId, ref: "Contest", required: true, index: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        answer: { type: String, trim: true, maxlength: 500 },
        status: { type: String, enum: ["ENTERED", "WINNER"], default: "ENTERED" },
    },
    { timestamps: true },
)

contestEntrySchema.index({ contest: 1, user: 1 }, { unique: true })

export const ContestEntry = mongoose.models.ContestEntry || mongoose.model("ContestEntry", contestEntrySchema)

export default Contest
