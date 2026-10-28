import mongoose from "mongoose"

const blogPostSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ["NEWS", "BLOG"], default: "BLOG", index: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
        excerpt: { type: String, trim: true, maxlength: 400 },
        content: { type: String, required: true },
        coverImage: { type: String, trim: true },
        author: { type: String, trim: true, default: "DriveMeGo Team" },
        tags: [{ type: String, trim: true }],
        isPublished: { type: Boolean, default: true, index: true },
        publishedAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true },
)

export default mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema)
