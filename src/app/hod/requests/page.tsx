"use client";

import { useEffect, useState, Suspense } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, where } from "firebase/firestore";
import { format, startOfYear, endOfYear } from "date-fns";
import { Check, X, AlertCircle, CalendarClock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { LEAVE_LIMITS, LeaveType } from "@/lib/constants";
import { useAuth } from "@/lib/AuthContext";

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
    createdAt?: Timestamp;
    recommendedBy?: string;
}

function AdminRequestManagerContent() {
    const { userData } = useAuth();
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [staffMap, setStaffMap] = useState<Record<string, any>>({});
    const [leaveUsageMap, setLeaveUsageMap] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const statusParam = searchParams.get("status") || "Pending";
    const [filter, setFilter] = useState<"All" | "Pending" | "Approved" | "Rejected" | "Recommended">(statusParam as any);

    useEffect(() => {
        if (["All", "Pending", "Approved", "Rejected", "Recommended"].includes(statusParam)) {
            setFilter(statusParam as any);
        }
    }, [statusParam]);

    // Fetch Staff Details
    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, "users"), where("role", "in", ["staff", "hod"])); // Fetch staff and hod to ensure map coverage
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const mapping: Record<string, any> = {};
            snapshot.docs.forEach(doc => {
                mapping[doc.id] = doc.data();
            });
            setStaffMap(mapping);
        });
        return () => unsubscribe();
    }, []);

    // ... (keep existing effects for leaves)

    // Fetch Approved Leaves and Calculate Usage
    useEffect(() => {
        if (!db) return;
        const currentYear = new Date().getFullYear();
        const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
        const yearEnd = format(endOfYear(new Date()), "yyyy-MM-dd");

        const q = query(collection(db, "leaves"), where("status", "==", "Approved"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usage: Record<string, Record<string, number>> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.fromDate >= yearStart && data.fromDate <= yearEnd) {
                    if (!usage[data.userId]) usage[data.userId] = {};
                    usage[data.userId][data.type] = (usage[data.userId][data.type] || 0) + (data.leaveValue || 0);
                }
            });
            setLeaveUsageMap(usage);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, "leaves")); // Fetch all leaves, then filter in memory

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leavesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as LeaveRequest[];

            leavesData.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
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
    }, []);

    const handleAction = async (id: string, status: "Approved" | "Rejected" | "Recommended") => {
        try {
            const leaveRef = doc(db, "leaves", id);
            if (status === "Recommended") {
                await updateDoc(leaveRef, { status, recommendedBy: "HOD" });
            } else {
                await updateDoc(leaveRef, { status });
            }
        } catch (error) {
            console.error("Error updating leave:", error);
            alert("Failed to update status.");
        }
    };

    const filteredLeaves = leaves.filter(l => {
        // 1. Filter by Department
        const staff = staffMap[l.userId];
        // If userData or staff map isn't fully ready, or department doesn't match, hide it.
        // Also ensure user sees their own requests if needed? No, this is "Manage Requests", so probably not their own.
        // HOD should see requests from Staff in their department.

        // Strict Check: Must have staff record and matching department
        if (!userData?.department || !staff?.department || staff.department !== userData.department) {
            return false;
        }

        // 2. Filter by Status
        if (filter === "All") return true;
        return l.status === filter;
    });

    return (
        <DashboardLayout allowedRole="hod">
            <div className="space-y-6">
                <div className="flex flex-col gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Manage Requests</h1>
                        <p className="text-sm text-gray-500 text-pretty">Review and respond to leave applications below.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(["All", "Pending", "Recommended", "Approved", "Rejected"] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === status
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">Error loading data: {error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:hidden">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400">Loading requests...</div>
                    ) : filteredLeaves.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic bg-white rounded-xl border border-gray-100">
                            No {filter.toLowerCase()} requests found.
                        </div>
                    ) : (
                        filteredLeaves.map((leave) => {
                            const staff = staffMap[leave.userId];
                            const leavesUsed = leaveUsageMap[leave.userId] || 0;
                            return (
                                <div key={leave.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 truncate max-w-[200px]">
                                                {staff ? `${staff.salutation || ""} ${staff.displayName}` : leave.userEmail}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                {staff ? <>{staff.designation || "-"}<br />{staff.department || "-"}</> : "External"}
                                            </p>
                                            <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 font-medium">
                                                <CalendarClock className="h-3 w-3" />
                                                <span>
                                                    Balance: {Math.max(0, (LEAVE_LIMITS[leave.type as LeaveType] || 0) - (leaveUsageMap[leave.userId]?.[leave.type] || 0))} / {LEAVE_LIMITS[leave.type as LeaveType] || "-"}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${leave.status === "Approved" ? "bg-green-100 text-green-700 border-green-200" :
                                            leave.status === "Rejected" ? "bg-red-100 text-red-700 border-red-200" :
                                                leave.status === "Recommended" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                                    "bg-yellow-100 text-yellow-700 border-yellow-200"
                                            }`}>
                                            {leave.status === "Recommended" ? (leave.recommendedBy ? `${leave.recommendedBy} Recommended` : "Recommended by HOD") : leave.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                        <p className="font-semibold text-xs uppercase text-blue-600 mb-1">{leave.type} ({leave.leaveValue} Days)</p>
                                        <p className="font-medium">{leave.reason}</p>
                                        <p className="text-xs mt-1 italic line-clamp-2">{leave.description}</p>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {leave.fromDate && format(new Date(leave.fromDate), "MMM dd")} - {leave.toDate && format(new Date(leave.toDate), "MMM dd")}
                                    </div>
                                    {leave.status === "Pending" && (
                                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                                            <button
                                                onClick={() => handleAction(leave.id, "Recommended")}
                                                className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                                            >
                                                Recommend
                                            </button>
                                            <button
                                                onClick={() => handleAction(leave.id, "Rejected")}
                                                className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-nowrap">Staff Details</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-nowrap text-center">Remaining Balance</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-nowrap">Type & Duration</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-nowrap">Reason & Details</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-nowrap">Dates</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-nowrap">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-nowrap text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading requests...</td></tr>
                                ) : filteredLeaves.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 py-16">No {filter.toLowerCase()} requests found.</td></tr>
                                ) : (
                                    filteredLeaves.map((leave) => {
                                        const staff = staffMap[leave.userId];
                                        const leavesUsed = leaveUsageMap[leave.userId] || 0;
                                        return (
                                            <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <span className="text-sm font-bold text-gray-900 block">
                                                            {staff ? `${staff.salutation || ""} ${staff.displayName}` : leave.userEmail}
                                                        </span>
                                                        <span className="text-xs text-gray-500 block mt-0.5">
                                                            {staff ? <>{staff.designation || "-"}<br />{staff.department || "-"}</> : "External"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${Math.max(0, (LEAVE_LIMITS[leave.type as LeaveType] || 0) - (leaveUsageMap[leave.userId]?.[leave.type] || 0)) === 0
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-blue-50 text-blue-700'
                                                        }`}>
                                                        {Math.max(0, (LEAVE_LIMITS[leave.type as LeaveType] || 0) - (leaveUsageMap[leave.userId]?.[leave.type] || 0))} left
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-medium text-gray-900">{leave.type}</div>
                                                    <div className="text-xs text-blue-600 font-semibold uppercase">{leave.leaveValue} Day(s) - {leave.session}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="max-w-[200px]">
                                                        <p className="text-sm text-gray-900 font-medium truncate" title={leave.reason}>{leave.reason}</p>
                                                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5" title={leave.description}>{leave.description}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {leave.fromDate && format(new Date(leave.fromDate), "MMM dd")}
                                                    {leave.toDate && leave.toDate !== leave.fromDate && ` - ${format(new Date(leave.toDate), "MMM dd")}`}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${leave.status === "Approved" ? "bg-green-100 text-green-700 border-green-200" :
                                                        leave.status === "Rejected" ? "bg-red-100 text-red-700 border-red-200" :
                                                            leave.status === "Recommended" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                                                "bg-yellow-100 text-yellow-700 border-yellow-200"
                                                        }`}>
                                                        {leave.status === "Recommended" ? (leave.recommendedBy ? `${leave.recommendedBy} Recommended` : "Recommended by HOD") : leave.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        {leave.status === "Pending" ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAction(leave.id, "Recommended")}
                                                                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                                                                >
                                                                    Recommend
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAction(leave.id, "Rejected")}
                                                                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">Actioned</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function AdminRequestManager() {
    return (
        <Suspense fallback={
            <DashboardLayout allowedRole="admin">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-gray-400">Loading manager...</div>
                </div>
            </DashboardLayout>
        }>
            <AdminRequestManagerContent />
        </Suspense>
    );
}
