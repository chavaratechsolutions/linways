"use client";

import { useEffect, useState, Suspense } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, where } from "firebase/firestore";
import { format, startOfYear, endOfYear } from "date-fns";
import { Check, X, AlertCircle, CalendarClock, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { LEAVE_LIMITS, LeaveType } from "@/lib/constants";

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
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [staffMap, setStaffMap] = useState<Record<string, any>>({});
    const [leaveUsageMap, setLeaveUsageMap] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const statusParam = searchParams.get("status") || "Pending";
    const [filter, setFilter] = useState<"All" | "Pending" | "Approved" | "Rejected" | "Recommended">(statusParam as any);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (["All", "Pending", "Approved", "Rejected", "Recommended"].includes(statusParam)) {
            setFilter(statusParam as any);
        }
    }, [statusParam]);

    // Fetch Staff Details
    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, "users"), where("role", "in", ["staff", "princi", "dir", "hod"])); // Include dir in mapping if needed
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const mapping: Record<string, any> = {};
            snapshot.docs.forEach(doc => {
                mapping[doc.id] = doc.data();
            });
            setStaffMap(mapping);
        });
        return () => unsubscribe();
    }, []);

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
        const q = query(collection(db, "leaves"));

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

    const handleAction = async (id: string, status: "Approved" | "Rejected") => {
        try {
            const leaveRef = doc(db, "leaves", id);
            await updateDoc(leaveRef, { status });
        } catch (error) {
            console.error("Error updating leave:", error);
            alert("Failed to update status.");
        }
    };

    const filteredLeaves = leaves.filter(l => {
        // Globally hide raw "Pending" requests from Principal (must be Recommended by HOD/Director)
        if (l.status === "Pending") return false;

        // Compensatory Leave Strict Flow: Must be recommended by Director
        if (l.type === "Compensatory Leave") {
            if (l.recommendedBy !== "Director") return false;
        }

        const staff = staffMap[l.userId];
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            ((staff?.displayName || "").toLowerCase().includes(searchLower) ||
                (l.userEmail || "").toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;

        if (filter === "All") return true;
        // The "Pending" filter tab should now show "Recommended" items (actionable items for Principal)
        if (filter === "Pending") return l.status === "Recommended";
        return l.status === filter;
    });

    return (
        <DashboardLayout allowedRole="princi">
            <div className="space-y-6">
                <div className="flex flex-col gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Manage Requests</h1>
                        <p className="text-sm text-gray-500 text-pretty">Review and respond to leave applications below.</p>
                    </div>

                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search requests..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow shadow-sm"
                        />
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
                                                {staff ? <>{staff.designation || "-"}<br />{staff.department || "-"}</> : "External User"}
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
                                    {(leave.status === "Pending" || leave.status === "Recommended") && (
                                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                                            <button
                                                onClick={() => handleAction(leave.id, "Approved")}
                                                className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                                            >
                                                Approve
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
                                                            {staff ? <>{staff.designation || "-"}<br />{staff.department || "-"}</> : "External User"}
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
                                                        {(leave.status === "Pending" || leave.status === "Recommended") ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAction(leave.id, "Approved")}
                                                                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                                                                >
                                                                    Approve
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
        </DashboardLayout >
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
