"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/AuthContext";
import { ClipboardList, Clock, CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import { LEAVE_LIMITS, LeaveType } from "@/lib/constants";

interface LeaveRequest {
    id: string;
    userId: string;
    type: string;
    status: "Pending" | "Approved" | "Rejected" | "Recommended";
    fromDate: string;
    toDate: string;
    leaveValue?: number;
    session?: string;
    createdAt?: Timestamp;
}

export default function StaffDashboard() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <StaffDashboardContent />
        </Suspense>
    );
}

function StaffDashboardContent() {
    const { user } = useAuth();
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
    });
    const searchParams = useSearchParams();
    const router = useRouter();
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);

    useEffect(() => {
        if (searchParams.get("success") === "password-updated") {
            setShowSuccessPopup(true);
            // Clear the param after showing
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete("success");
            router.replace(`/staff?${newParams.toString()}`);

            // Auto hide after 3 seconds
            const timer = setTimeout(() => setShowSuccessPopup(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, router]);

    useEffect(() => {
        if (!user || !db) return;

        const q = query(
            collection(db, "leaves"),
            where("userId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.metadata.fromCache && snapshot.empty) {
                return; // Ignore empty cache to wait for server data
            }

            const leavesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as LeaveRequest[];

            leavesData.sort((a, b) => {
                const timeA = a.createdAt && typeof a.createdAt.toMillis === 'function'
                    ? a.createdAt.toMillis()
                    : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.fromDate || 0).getTime());
                const timeB = b.createdAt && typeof b.createdAt.toMillis === 'function'
                    ? b.createdAt.toMillis()
                    : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.fromDate || 0).getTime());
                return timeB - timeA;
            });

            setLeaves(leavesData);

            setStats({
                total: leavesData.length,
                pending: leavesData.filter(l => l.status === "Pending" || l.status === "Recommended").length,
                approved: leavesData.filter(l => l.status === "Approved").length,
                rejected: leavesData.filter(l => l.status === "Rejected").length,
            });
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Firestore Error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const statCards = [
        { name: "Total Requests", value: loading ? "..." : stats.total, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-100", href: "/staff/history" },
        { name: "Pending", value: loading ? "..." : stats.pending, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100", href: "/staff/history" },
        { name: "Approved", value: loading ? "..." : stats.approved, icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", href: "/staff/history" },
        { name: "Rejected", value: loading ? "..." : stats.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-100", href: "/staff/history" },
    ];

    return (
        <DashboardLayout allowedRole="staff">
            <div className="space-y-6 relative">
                {showSuccessPopup && (
                    <div className="absolute top-0 right-0 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg shadow-lg border border-green-200 flex items-start gap-3 min-w-[300px]">
                            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-sm">Success!</h3>
                                <p className="text-sm">Your password has been updated successfully.</p>
                            </div>
                            <button
                                onClick={() => setShowSuccessPopup(false)}
                                className="text-green-500 hover:text-green-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Welcome back!</h1>
                    <p className="text-sm text-gray-500">Here's an overview of your leave status.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">Connection Error: {error}</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6">
                    {statCards.map((stat) => (
                        <Link href={stat.href} key={stat.name} className="flex flex-col md:flex-row items-center rounded-xl bg-white p-4 md:p-6 shadow-sm border border-gray-100 gap-2 md:gap-4 hover:shadow-md transition-shadow cursor-pointer">
                            <div className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg shrink-0 ${stat.bg} ${stat.color}`}>
                                <stat.icon className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <div className="text-center md:text-left overflow-hidden w-full">
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase tracking-tight truncate">{stat.name}</p>
                                <p className="text-lg md:text-2xl font-bold text-gray-900 leading-tight">{stat.value}</p>
                            </div>
                        </Link>
                    ))}
                </div>



                {/* Leave Balances Section */}
                <div className="rounded-xl bg-white p-4 md:p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Leave Balances (Used / Total)</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {Object.entries(LEAVE_LIMITS).map(([type, limit]) => {
                            // Calculate used leaves for this type in current year
                            const currentYear = new Date().getFullYear();
                            const used = leaves
                                .filter(l =>
                                    l.type === type &&
                                    l.status === 'Approved' &&
                                    (l.fromDate ? new Date(l.fromDate).getFullYear() === currentYear : true)
                                )
                                .reduce((acc, curr) => acc + (curr.leaveValue || 0), 0);

                            const percentage = Math.min((used / limit) * 100, 100);
                            const isNearLimit = percentage >= 80;

                            return (
                                <div key={type} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-gray-700 truncate" title={type}>{type}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isNearLimit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {used}/{limit}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 ${isNearLimit ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-xl bg-white p-4 md:p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
                    {loading ? (
                        <div className="text-center py-12 text-gray-400">Loading activity...</div>
                    ) : leaves.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic">
                            No leave requests found.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* Mobile View - Cards */}
                            <div className="md:hidden space-y-3">
                                {leaves.slice(0, 5).map((leave) => (
                                    <div key={leave.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex flex-col gap-3">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <span className="font-semibold text-gray-900 text-sm block truncate">{leave.type}</span>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {leave.fromDate && format(new Date(leave.fromDate), "MMM dd")} &bull; {leave.leaveValue} Day(s)
                                                </p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${leave.status === "Approved" ? "bg-green-100 text-green-700" :
                                                leave.status === "Rejected" ? "bg-red-100 text-red-700" :
                                                    leave.status === "Recommended" ? "bg-blue-100 text-blue-700" :
                                                        "bg-yellow-100 text-yellow-700"
                                                }`}>
                                                {leave.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-600 flex justify-between items-center border-t border-gray-200 pt-2">
                                            <span className="font-medium text-gray-500">Session</span>
                                            <span className="font-medium text-gray-900">{leave.session || "-"}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop View - Table */}
                            <div className="hidden md:block overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                                <table className="w-full text-left border-collapse min-w-[300px]">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Type</th>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Dates</th>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Duration</th>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Session</th>
                                            <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {leaves.slice(0, 5).map((leave) => (
                                            <tr key={leave.id}>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{leave.type}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {leave.fromDate && format(new Date(leave.fromDate), "MMM dd")}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {leave.leaveValue} Day(s)
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {leave.session || "-"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${leave.status === "Approved" ? "bg-green-100 text-green-700" :
                                                        leave.status === "Rejected" ? "bg-red-100 text-red-700" :
                                                            leave.status === "Recommended" ? "bg-blue-100 text-blue-700" :
                                                                "bg-yellow-100 text-yellow-700"
                                                        }`}>
                                                        {leave.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout >
    );
}
