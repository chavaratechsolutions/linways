"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";

export default function LeaveRequestPage() {
    const { user } = useAuth();
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);

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
