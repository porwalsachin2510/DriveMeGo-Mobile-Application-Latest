import express from "express"
import { verifyToken, checkAdminRole } from "../middleware/auth.js"
import {
    getCityPreference,
    setCityPreference,
    listEmergencyContacts,
    createEmergencyContact,
    updateEmergencyContact,
    deleteEmergencyContact,
    submitFeedback,
    myFeedback,
    adminListFeedback,
    adminRespondFeedback,
    listFaqs,
    adminCreateFaq,
    adminUpdateFaq,
    adminDeleteFaq,
    listPosts,
    getPost,
    adminCreatePost,
    adminUpdatePost,
    adminDeletePost,
    listContests,
    joinContest,
    adminCreateContest,
    adminUpdateContest,
    adminPickContestWinners,
    getMyReferrals,
    applyReferralCode,
    getProtectionPlans,
    getProtectionOverview,
    purchaseProtection,
    claimProtection,
    adminDecideClaim,
} from "../controllers/engagementController.js"

const router = express.Router()

// City
router.get("/city", verifyToken, getCityPreference)
router.put("/city", verifyToken, setCityPreference)

// Emergency contacts
router.get("/emergency-contacts", verifyToken, listEmergencyContacts)
router.post("/emergency-contacts", verifyToken, createEmergencyContact)
router.put("/emergency-contacts/:id", verifyToken, updateEmergencyContact)
router.delete("/emergency-contacts/:id", verifyToken, deleteEmergencyContact)

// Feedback
router.post("/feedback", verifyToken, submitFeedback)
router.get("/feedback/mine", verifyToken, myFeedback)
router.get("/feedback/admin", verifyToken, checkAdminRole, adminListFeedback)
router.put("/feedback/admin/:id", verifyToken, checkAdminRole, adminRespondFeedback)

// FAQs
router.get("/faqs", verifyToken, listFaqs)
router.post("/faqs", verifyToken, checkAdminRole, adminCreateFaq)
router.put("/faqs/:id", verifyToken, checkAdminRole, adminUpdateFaq)
router.delete("/faqs/:id", verifyToken, checkAdminRole, adminDeleteFaq)

// News & blog
router.get("/posts", verifyToken, listPosts)
router.get("/posts/:idOrSlug", verifyToken, getPost)
router.post("/posts", verifyToken, checkAdminRole, adminCreatePost)
router.put("/posts/:id", verifyToken, checkAdminRole, adminUpdatePost)
router.delete("/posts/:id", verifyToken, checkAdminRole, adminDeletePost)

// Contests
router.get("/contests", verifyToken, listContests)
router.post("/contests", verifyToken, checkAdminRole, adminCreateContest)
router.put("/contests/:id", verifyToken, checkAdminRole, adminUpdateContest)
router.post("/contests/:id/join", verifyToken, joinContest)
router.post("/contests/:id/winners", verifyToken, checkAdminRole, adminPickContestWinners)

// Referrals
router.get("/referrals", verifyToken, getMyReferrals)
router.post("/referrals/apply", verifyToken, applyReferralCode)

// Trip protection
router.get("/trip-protection/plans", verifyToken, getProtectionPlans)
router.get("/trip-protection", verifyToken, getProtectionOverview)
router.post("/trip-protection", verifyToken, purchaseProtection)
router.post("/trip-protection/:id/claim", verifyToken, claimProtection)
router.put("/trip-protection/:id/claim/admin", verifyToken, checkAdminRole, adminDecideClaim)

export default router
