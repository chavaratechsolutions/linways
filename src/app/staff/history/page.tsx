"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";

interface LeaveRequest {
    id: string;
    userId: string;
    type: string;
    status: "Pending" | "Approved" | "Rejected";
    reason: string;
    description: string;
    fromDate: string;
    toDate: string;
    leaveValue: number;
    session: string;
    createdAt?: Timestamp;
}
import { AlertCircle } from "lucide-react";

export default function StaffHistoryPage() {
    const { user } = useAuth();
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !db) return;

        const q = query(
            collection(db, "leaves"),
            where("userId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leavesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as LeaveRequest[];

            leavesData.sort((a, b) => {
                const timeA = a.createdAt?.seconds || new Date(a.fromDate || 0).getTime();
                const timeB = b.createdAt?.seconds || new Date(b.fromDate || 0).getTime();
                return timeB - timeA;
            });

            setLeaves(leavesData);
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Firestore Error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "Approved": return "bg-green-100 text-green-800 border-green-200";
            case "Rejected": return "bg-red-100 text-red-800 border-red-200";
            default: return "bg-yellow-100 text-yellow-800 border-yellow-200";
        }
    };

    return (
        <DashboardLayout allowedRole="staff">
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Leave History</h1>
                    <p className="text-sm text-gray-500">Track your submitted leave requests.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">Error: {error}</p>
                    </div>
                )}

                {/* Mobile View: Cards */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400">Loading history...</div>
                    ) : leaves.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic bg-white rounded-xl border border-gray-100">
                            No leave requests found.
                        </div>
                    ) : (
                        leaves.map((leave) => (
                            <div key={leave.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{leave.type}</h3>
                                        <p className="text-xs text-gray-500">{leave.session}</p>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(leave.status)}`}>
                                        {leave.status}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    <p className="line-clamp-2">{leave.reason}</p>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                    <span className="text-xs text-gray-400">
                                        {leave.fromDate && format(new Date(leave.fromDate), "MMM dd")} - {leave.toDate && format(new Date(leave.toDate), "MMM dd")}
                                    </span>
                                    <span className="text-xs font-semibold text-blue-600 uppercase">
                                        {leave.leaveValue} Day(s)
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date(s)</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading history...</td></tr>
                                ) : leaves.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic py-16">No leave requests found.</td></tr>
                                ) : (
                                    leaves.map((leave) => (
                                        <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-medium text-gray-900">{leave.type}</span>
                                                <div className="text-xs text-gray-500">{leave.session}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {leave.leaveValue} Day(s)
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {leave.fromDate && format(new Date(leave.fromDate), "MMM dd, yyyy")}
                                                {leave.toDate && leave.toDate !== leave.fromDate && ` - ${format(new Date(leave.toDate), "MMM dd, yyyy")}`}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                                {leave.reason}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(leave.status)}`}>
                                                    {leave.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
