import mongoose from "mongoose"

const faqSchema = new mongoose.Schema(
    {
        question: { type: String, required: true, trim: true, maxlength: 240 },
        answer: { type: String, required: true, trim: true, maxlength: 4000 },
        category: { type: String, trim: true, default: "General", index: true },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true },
)

export default mongoose.models.Faq || mongoose.model("Faq", faqSchema)
