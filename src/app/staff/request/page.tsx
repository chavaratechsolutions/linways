"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";

export default function LeaveRequestPage() {
    const { user, userData } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: "Casual Leave",
        fromDate: "",
        toDate: "",
        session: "Full Day",
        reason: "",
        description: "",
    });
    const [compLeaveBalance, setCompLeaveBalance] = useState<{
        granted: number;
        used: number;
        nearestExpiryMs: number | null;
        grantsList: { id: string; days: number; expiresAt: number; available: number }[];
    } | null>(null);
    const isCompLeave = formData.type === "Compensatory Leave";

    // Fetch compensatory leave balance when type changes
    useEffect(() => {
        if (!user || !isCompLeave) { setCompLeaveBalance(null); return; }

        const COMP_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
        const now = Date.now();

        const fetchBalance = async () => {
            try {
                // Fetch all approved grants
                const grantsQ = query(
                    collection(db, "compLeaveGrants"),
                    where("staffId", "==", user.uid),
                    where("status", "==", "Approved")
                );
                const grantsSnap = await getDocs(grantsQ);

                // Only count grants still within 90-day validity window
                const validGrants = grantsSnap.docs.filter(d => {
                    const data = d.data();
                    const workDateMs = data.date ? new Date(data.date).getTime() : (data.createdAt?.seconds ?? 0) * 1000;
                    return (workDateMs + COMP_VALIDITY_MS) >= now;
                });

                const totalGranted = validGrants.reduce((sum, d) => sum + (d.data().grantedDays || 0), 0);

                // Count comp leaves taken from 25 March 2026 onwards
                const usedQ = query(
                    collection(db, "leaves"),
                    where("userId", "==", user.uid),
                    where("type", "==", "Compensatory Leave"),
                    where("status", "==", "Approved")
                );
                const usedSnap = await getDocs(usedQ);
                const totalUsed = usedSnap.docs
                    .filter(d => (d.data().fromDate || "") >= "2026-03-25")
                    .reduce((sum, d) => sum + (d.data().leaveValue || 0), 0);

                // Build detailed list of individual grants for the UI
                let remainingUsed = totalUsed;
                const sortedValidGrants = validGrants
                    .map(d => {
                        const data = d.data();
                        const days = data.grantedDays || 0;
                        const workDateMs = data.date ? new Date(data.date).getTime() : (data.createdAt?.seconds ?? 0) * 1000;
                        const expiresAt = workDateMs + COMP_VALIDITY_MS;
                        return { id: d.id, days, expiresAt };
                    })
                    .sort((a, b) => a.expiresAt - b.expiresAt); // Oldest expiry first

                const grantsList = sortedValidGrants.map(g => {
                    // Deduct used leaves proportionally from older grants first
                    const deduct = Math.min(g.days, remainingUsed);
                    remainingUsed -= deduct;
                    return { ...g, available: g.days - deduct };
                }).filter(g => g.available > 0); // Only keep grants that still have available days

                const nearestExpiryMs = grantsList.length > 0 ? grantsList[0].expiresAt : null;

                setCompLeaveBalance({ granted: totalGranted, used: totalUsed, nearestExpiryMs, grantsList });
            } catch (err) {
                console.error("Failed to fetch comp leave balance:", err);
            }
        };

        fetchBalance();
    }, [user, isCompLeave]);

    // Helper to check if a date is today
    const isToday = (dateString: string) => {
        if (!dateString) return false;
        const today = new Date();
        const date = new Date(dateString);
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const getAvailableSessions = (dateString: string) => {
        const allSessions = ["Full Day", "Forenoon", "Afternoon"];
        if (!dateString) return allSessions;

        if (isToday(dateString)) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const limit830 = 8 * 60 + 30;  // 8:30 AM
            const limit1230 = 12 * 60 + 30; // 12:30 PM

            // If time > 12:30 PM, restrict ALL sessions (Day blocked)
            if (currentMinutes > limit1230) {
                return [];
            }

            // If time > 8:30 AM, restrict Full Day and Forenoon -> Only Afternoon allowed
            if (currentMinutes > limit830) {
                return ["Afternoon"];
            }
        }
        return allSessions;
    };

    const getMinDate = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const limit1230 = 12 * 60 + 30; // 12:30 PM

        // If after 12:30 PM, add 1 day to minimum date
        if (currentMinutes > limit1230) {
            now.setDate(now.getDate() + 1);
        }

        return now.toISOString().split('T')[0];
    };

    const calculateLeaveValue = () => {
        if (formData.session === "Forenoon" || formData.session === "Afternoon") {
            return 0.5;
        }
        if (formData.fromDate && formData.toDate) {
            const start = parseISO(formData.fromDate);
            const end = parseISO(formData.toDate);
            const days = differenceInDays(end, start) + 1;
            return days > 0 ? days : 0;
        }
        return 0;
    };

    const checkDuplicateLeave = async (start: Date, end: Date) => {
        // Create query for overlapping dates
        // We need to check if there are any leaves where:
        // (existingStart <= newEnd) AND (existingEnd >= newStart)
        // AND status is not "Rejected"

        const leavesRef = collection(db, "leaves");
        const q = query(
            leavesRef,
            where("userId", "==", user?.uid),
            where("status", "!=", "Rejected")
        );

        const querySnapshot = await getDocs(q);

        for (const doc of querySnapshot.docs) {
            const data = doc.data();
            const existingStart = parseISO(data.fromDate);
            const existingEnd = parseISO(data.toDate);

            // Check overlap
            if (existingStart <= end && existingEnd >= start) {
                console.log("Overlap found with doc:", doc.id);
                console.log("Existing Session (DB):", data.session);
                console.log("New Session (Form):", formData.session);

                // If either is Full Day, it's an overlap
                if (data.session === "Full Day" || formData.session === "Full Day") {
                    console.log("Blocking: Full Day conflict");
                    return true;
                }

                // If both are exact same session (e.g. Forenoon & Forenoon), it's an overlap
                if (data.session === formData.session) {
                    console.log("Blocking: Same session conflict");
                    return true;
                }

                console.log("Allowing: Complementary sessions");
                // If we get here:
                // One is Forenoon, one is Afternoon -> ALLOW (return false for this doc)
                // Continue checking other docs just in case
            }
        }
        return false;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);

        // Compensatory Leave balance validation
        if (isCompLeave && compLeaveBalance !== null) {
            const available = compLeaveBalance.granted - compLeaveBalance.used;
            const requested = calculateLeaveValue();
            if (available <= 0) {
                alert("You have no Compensatory Leave balance. Please contact your HOD.");
                setLoading(false);
                return;
            }
            if (requested > available) {
                alert(`You can only apply for ${available} day(s) of Compensatory Leave. You have requested ${requested} day(s).`);
                setLoading(false);
                return;
            }
        }

        // Validation
        if (formData.fromDate && formData.toDate) {
            const start = parseISO(formData.fromDate);
            const end = parseISO(formData.toDate);

            // Basic date validation
            if (differenceInDays(end, start) < 0) {
                alert("End date cannot be before start date.");
                setLoading(false);
                return;
            }

            // Prevent past dates
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (start < today) {
                alert("Cannot apply for leave in the past.");
                setLoading(false);
                return;
            }

            // Time-based validation for current day
            if (isToday(formData.fromDate)) {
                const availableSessions = getAvailableSessions(formData.fromDate);
                if (!availableSessions.includes(formData.session)) {
                    alert(`Cannot apply for ${formData.session} at this time.`);
                    setLoading(false);
                    return;
                }
            }

            // Check for duplicate leave
            try {
                const isDuplicate = await checkDuplicateLeave(start, end);
                if (isDuplicate) {
                    alert("You have already applied for leave on these dates.");
                    setLoading(false);
                    return;
                }
            } catch (error: any) {
                if (error.code === 'failed-precondition' && error.message.includes('index')) {
                    console.error("Firestore Index Required. Please create it here:", error.message);
                    alert("System configuration required. Please check the browser console for a link to fix this.");
                } else {
                    console.error("Error checking for duplicate leave:", error);
                    alert("Failed to check for duplicate leave. Please try again.");
                }
                setLoading(false);
                return;
            }
        }

        const leaveValue = calculateLeaveValue();

        try {
            const dataToSave = {
                ...formData,
                userId: user.uid,
                userEmail: user.email,
                leaveValue,
                status: "Pending",
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, "leaves"), dataToSave);
            router.push("/staff/history");
        } catch (error) {
            console.error("Error submitting leave:", error);
            alert("Failed to submit request.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout allowedRole="staff">
            <div className="max-w-2xl mx-auto pb-10">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 px-1">Request Leave</h1>

                <form onSubmit={handleSubmit} className="space-y-6 bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
                            <select
                                required
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-shadow outline-none text-gray-900"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option>Casual Leave</option>
                                <option>Duty Leave</option>
                                <option>Vacation Leave</option>
                                {userData?.gender === "Female" && <option>Maternity Leave</option>}
                                <option>Compensatory Leave</option>
                            </select>
                            {isCompLeave && compLeaveBalance !== null && (() => {
                                const available = Math.max(0, compLeaveBalance.granted - compLeaveBalance.used);
                                const allExpired = available === 0;

                                return (
                                    <div className={`mt-2 px-3 py-2.5 rounded-lg text-xs font-medium border space-y-2 ${allExpired
                                        ? "bg-red-50 border-red-200 text-red-700"
                                        : "bg-indigo-50 border-indigo-200 text-indigo-700"
                                        }`}>
                                        <div className="flex flex-wrap justify-between items-center gap-1">
                                            <span>{allExpired ? "No comp leave available" : "Comp Leave Balance"}</span>
                                            {!allExpired && (
                                                <span className="font-bold">
                                                    {available} day(s) available
                                                    <span className="font-normal ml-1 opacity-70">
                                                        ({compLeaveBalance.used} used / {compLeaveBalance.granted} granted)
                                                    </span>
                                                </span>
                                            )}
                                        </div>

                                        {!allExpired && compLeaveBalance.grantsList.length > 0 && (
                                            <div className="flex flex-col gap-1 mt-2 border-t border-indigo-200/50 pt-2">
                                                <span className="opacity-70 text-[10px] uppercase tracking-wider">Available Grants:</span>
                                                {compLeaveBalance.grantsList.map(g => {
                                                    const daysUntilExpiry = Math.ceil((g.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
                                                    const isExpiringSoon = daysUntilExpiry <= 30;
                                                    const dateStr = new Date(g.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

                                                    return (
                                                        <div key={g.id} className="flex justify-between items-center bg-white/40 px-2 py-1 rounded">
                                                            <span className="font-semibold">{g.available} day(s)</span>
                                                            <span className={isExpiringSoon ? "text-yellow-700 font-bold" : "opacity-80"}>
                                                                {isExpiringSoon ? `⚠ Expires in ${daysUntilExpiry}d (${dateStr})` : `Valid until ${dateStr}`}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {isCompLeave && compLeaveBalance === null && (
                                <p className="mt-1.5 text-xs text-gray-400 italic">Loading your comp leave balance…</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Session</label>
                            <select
                                required
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-shadow outline-none text-gray-900"
                                value={formData.session}
                                onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                            >
                                {getAvailableSessions(formData.fromDate).map(session => (
                                    <option key={session} value={session}>{session}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Date</label>
                            <input
                                type="date"
                                required
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-shadow outline-none text-gray-900"
                                min={getMinDate()}
                                value={formData.fromDate}
                                onChange={(e) => {
                                    const newDate = e.target.value;
                                    // Check if current session is valid for new date, if not reset to first available
                                    const available = getAvailableSessions(newDate);
                                    const newSession = available.includes(formData.session) ? formData.session : available[0];

                                    setFormData({
                                        ...formData,
                                        fromDate: newDate,
                                        session: newSession,
                                        toDate: newSession !== "Full Day" ? newDate : formData.toDate
                                    });
                                }}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">To Date</label>
                            <input
                                type="date"
                                required
                                min={formData.fromDate || getMinDate()}
                                disabled={formData.session !== "Full Day"}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-shadow outline-none text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                                value={formData.session !== "Full Day" ? formData.fromDate : formData.toDate}
                                onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g., Medical checkup"
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-shadow outline-none text-gray-900"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description (Optional)</label>
                        <textarea
                            rows={3}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-shadow outline-none text-gray-900"
                            placeholder="Briefly describe the reason for your leave..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="bg-blue-50 p-5 rounded-2xl flex justify-between items-center border border-blue-100 shadow-inner">
                        <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Days:</span>
                        <span className="text-2xl font-black text-blue-800">{calculateLeaveValue()}</span>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Submitting...
                            </span>
                        ) : "Submit Leave Request"}
                    </button>
                </form>
            </div>
        </DashboardLayout>
    );
}
