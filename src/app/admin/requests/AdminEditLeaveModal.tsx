import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { parseISO, differenceInDays } from "date-fns";

interface LeaveRequest {
    id: string;
    userId: string;
    userEmail: string;
    type: string;
    status: "Pending" | "Approved" | "Rejected" | "Recommended";
    reason: string;
    description: string;
    fromDate: string;
    toDate: string;
    leaveValue: number;
    session: string;
}

interface AdminEditLeaveModalProps {
    leave: LeaveRequest;
    onClose: () => void;
}

export default function AdminEditLeaveModal({ leave, onClose }: AdminEditLeaveModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: leave.type,
        status: leave.status,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        session: leave.session,
        reason: leave.reason,
        description: leave.description || "",
    });

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
        
        // Validation
        if (formData.fromDate && formData.toDate) {
            const start = parseISO(formData.fromDate);
            const end = parseISO(formData.toDate);
            if (differenceInDays(end, start) < 0) {
                alert("End date cannot be before start date.");
                return;
            }
        }

        setLoading(true);
        const leaveValue = calculateLeaveValue();

        try {
            const leaveRef = doc(db, "leaves", leave.id);
            const updateData: any = {
                ...formData,
                leaveValue,
                updatedAt: serverTimestamp()
            };

            // If status changed to Approved and wasn't Approved before
            if (formData.status === "Approved" && leave.status !== "Approved") {
                updateData.approvedBy = "Admin";
                updateData.approvedAt = serverTimestamp();
            }

            await updateDoc(leaveRef, updateData);
            onClose();
        } catch (error) {
            console.error("Error updating leave:", error);
            alert("Failed to update leave request.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 md:p-6 bg-white border-b border-gray-100 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Edit Leave Request</h2>
                        <p className="text-sm text-gray-500 mt-1">{leave.userEmail}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Status */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                            <select
                                required
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="Pending">Pending</option>
                                <option value="Recommended">Recommended</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>

                        {/* Leave Type */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
                            <select
                                required
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option>Casual Leave</option>
                                <option>Duty Leave</option>
                                <option>Vacation Leave</option>
                                <option>Maternity Leave</option>
                                <option>Compensatory Leave</option>
                                <option>Loss of Pay Leave</option>
                            </select>
                        </div>

                        {/* Session */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Session</label>
                            <select
                                required
                                value={formData.session}
                                onChange={(e) => {
                                    const newSession = e.target.value;
                                    setFormData({
                                        ...formData,
                                        session: newSession,
                                        toDate: newSession !== "Full Day" ? formData.fromDate : formData.toDate
                                    });
                                }}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="Full Day">Full Day</option>
                                <option value="Forenoon">Forenoon</option>
                                <option value="Afternoon">Afternoon</option>
                            </select>
                        </div>

                        {/* From Date */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Date</label>
                            <input
                                type="date"
                                required
                                value={formData.fromDate}
                                onChange={(e) => {
                                    const newDate = e.target.value;
                                    setFormData({
                                        ...formData,
                                        fromDate: newDate,
                                        toDate: formData.session !== "Full Day" ? newDate : formData.toDate
                                    });
                                }}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* To Date */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">To Date</label>
                            <input
                                type="date"
                                required
                                min={formData.fromDate}
                                disabled={formData.session !== "Full Day"}
                                value={formData.session !== "Full Day" ? formData.fromDate : formData.toDate}
                                onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
                        <input
                            type="text"
                            required
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                        <textarea
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                        />
                    </div>

                    {/* Total Days */}
                    <div className="bg-blue-50 p-4 rounded-xl flex justify-between items-center border border-blue-100">
                        <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Days:</span>
                        <span className="text-xl font-black text-blue-800">{calculateLeaveValue()}</span>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors flex justify-center items-center"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
