"use client";

import { useEffect, useState, use } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";

export default function EditLeavePage({ params }: { params: Promise<{ id: string }> }) {
    const { user } = useAuth();
    const router = useRouter();
    // Unwrap params using use() hook
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        type: "Casual Leave",
        fromDate: "",
        toDate: "",
        session: "Full Day",
        reason: "",
        description: "",
    });

    useEffect(() => {
        const fetchLeave = async () => {
            if (!user || !id) return;

            try {
                const docRef = doc(db, "leaves", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.userId !== user.uid) {
                        alert("Unauthorized access.");
                        router.push("/staff/history");
                        return;
                    }
                    if (data.status !== "Pending") {
                        alert("Cannot edit leave requests that are not Pending.");
                        router.push("/staff/history");
                        return;
                    }
                    setFormData({
                        type: data.type,
                        fromDate: data.fromDate,
                        toDate: data.toDate,
                        session: data.session,
                        reason: data.reason,
                        description: data.description || "",
                    });
                } else {
                    alert("Leave request not found.");
                    router.push("/staff/history");
                }
            } catch (error) {
                console.error("Error fetching leave:", error);
                alert("Failed to load leave details.");
            } finally {
                setLoading(false);
            }
        };

        fetchLeave();
    }, [user, id, router]);

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
        const leavesRef = collection(db, "leaves");
        const q = query(
            leavesRef,
            where("userId", "==", user?.uid),
            where("status", "!=", "Rejected")
        );

        const querySnapshot = await getDocs(q);

        for (const doc of querySnapshot.docs) {
            // Exclude current document from check
            if (doc.id === id) continue;

            const data = doc.data();
            const existingStart = parseISO(data.fromDate);
            const existingEnd = parseISO(data.toDate);

            // Check overlap
            if (existingStart <= end && existingEnd >= start) {
                // If either is Full Day, it's an overlap
                if (data.session === "Full Day" || formData.session === "Full Day") {
                    return true;
                }

                // If both are exact same session (e.g. Forenoon & Forenoon), it's an overlap
                if (data.session === formData.session) {
                    return true;
                }
            }
        }
        return false;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submitting update for ID:", id);
        console.log("User ID:", user?.uid);

        if (!user || !id) {
            console.error("Missing user or ID");
            return;
        }

        setSubmitting(true);

        // Validation
        if (formData.fromDate && formData.toDate) {
            const start = parseISO(formData.fromDate);
            const end = parseISO(formData.toDate);

            if (differenceInDays(end, start) < 0) {
                alert("End date cannot be before start date.");
                setSubmitting(false);
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (start < today) {
                alert("Cannot apply for leave in the past.");
                setSubmitting(false);
                return;
            }

            if (isToday(formData.fromDate)) {
                const availableSessions = getAvailableSessions(formData.fromDate);
                if (!availableSessions.includes(formData.session)) {
                    alert(`Cannot apply for ${formData.session} at this time.`);
                    setSubmitting(false);
                    return;
                }
            }

            try {
                const isDuplicate = await checkDuplicateLeave(start, end);
                if (isDuplicate) {
                    alert("You have already applied for leave on these dates.");
                    setSubmitting(false);
                    return;
                }
            } catch (error: any) {
                if (error.code === 'failed-precondition' && error.message.includes('index')) {
                    console.error("Firestore Index Required:", error.message);
                    alert("System configuration required. Please check console.");
                } else {
                    console.error("Error checking duplicate:", error);
                    alert("Failed to check duplicate leave.");
                }
                setSubmitting(false);
                return;
            }
        }

        const leaveValue = calculateLeaveValue();

        try {
            const docRef = doc(db, "leaves", id);
            await updateDoc(docRef, {
                ...formData,
                leaveValue,
                updatedAt: serverTimestamp(),
            });
            router.push("/staff/history");
        } catch (error) {
            console.error("Error updating leave:", error);
            alert("Failed to update request.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <DashboardLayout allowedRole="staff"><div className="p-10 text-center">Loading...</div></DashboardLayout>;
    }

    return (
        <DashboardLayout allowedRole="staff">
            <div className="max-w-2xl mx-auto pb-10">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 px-1">Edit Leave Request</h1>

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
                                <option>Maternity Leave</option>
                                <option>Compensatory Leave</option>
                            </select>
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

                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="w-1/3 py-3.5 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-2/3 flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                        >
                            {submitting ? (
                                <span className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Updating...
                                </span>
                            ) : "Update Request"}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
