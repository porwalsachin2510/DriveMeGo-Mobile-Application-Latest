/**
 * Seeds starter FAQ entries and a welcome article so the mobile Help and News
 * screens have real content on a fresh database. Idempotent: skips a collection
 * that already has documents. Admins manage everything afterwards through the
 * /api/engagement admin endpoints.
 *
 *   node src/scripts/seedEngagementContent.js
 */
import mongoose from "mongoose"
import dotenv from "dotenv"
import Faq from "../models/Faq.js"
import BlogPost from "../models/BlogPost.js"

dotenv.config()

const FAQS = [
    ["Booking", "How do I book a route?", "Open the Routes tab, pick a route that matches your journey and tap Book This Route. Choose your dates and payment method to confirm."],
    ["Booking", "Can I cancel a booking?", "Yes. Open Cancel Booking from the More tab, choose the booking and confirm. Refund eligibility depends on how close the trip is."],
    ["Booking", "What if my route is not listed?", "Send a route request from the Routes tab. Partners can then show interest and offer the route."],
    ["Payments", "Which payment methods are accepted?", "You can pay by card or wallet balance. Available methods depend on your country and are shown at checkout."],
    ["Payments", "How do refunds work?", "Approved refunds are returned to your wallet or original payment method. Wallet refunds are instant."],
    ["Account", "How do I change my city?", "Open the More tab and tap Change next to your current city. You can switch between cities in your country."],
    ["Account", "How do I reset my password?", "Open Settings, enter your current password, then your new password and confirm it. Use Forgot password on the login screen if you are signed out."],
    ["Safety", "How do emergency contacts work?", "Save up to five people under Emergency Contacts. Mark one as primary so they are the first to be reached when you need help."],
    ["Safety", "What does trip protection cover?", "Trip protection lets you claim a refund if you cannot travel because of illness, an emergency or a schedule change. Plans are shown under Secure your trip."],
]

async function run() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL
    if (!uri) {
        console.error("[seedEngagementContent] No Mongo connection string found in env.")
        process.exit(1)
    }
    await mongoose.connect(uri)

    if ((await Faq.countDocuments()) === 0) {
        await Faq.insertMany(FAQS.map(([category, question, answer], i) => ({ category, question, answer, order: i })))
        console.log(`[seedEngagementContent] Inserted ${FAQS.length} FAQs`)
    } else {
        console.log("[seedEngagementContent] FAQs already present, skipped")
    }

    if ((await BlogPost.countDocuments()) === 0) {
        await BlogPost.create({
            type: "NEWS",
            title: "Welcome to the DriveMeGo mobile app",
            slug: "welcome-to-the-drivemego-mobile-app",
            excerpt: "Book routes, track trips and manage your commute from your phone.",
            content:
                "Your commute now fits in your pocket. Browse verified routes, book in a few taps, follow your trips and manage your subscription from the DriveMeGo mobile app.\n\nWe will share route launches, service updates and travel tips here.",
            tags: ["announcement"],
        })
        console.log("[seedEngagementContent] Inserted welcome article")
    } else {
        console.log("[seedEngagementContent] Articles already present, skipped")
    }

    await mongoose.disconnect()
}

run().catch((error) => {
    console.error("[seedEngagementContent] Failed:", error)
    process.exit(1)
})
