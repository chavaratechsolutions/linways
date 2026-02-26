"use client";

import { useEffect, useState, use } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { format, startOfYear, endOfYear, startOfMonth, subDays, isAfter } from "date-fns";
import { ArrowLeft, User, Mail, Briefcase, Calendar, CheckCircle2, Clock, XCircle, FileText, CalendarClock } from "lucide-react";
import Link from "next/link";
import { LEAVE_LIMITS, LeaveType } from "@/lib/constants";

interface LeaveRequest {
    id: string;
    type: string;
    status: string;
    reason: string;
    description: string;
    fromDate: string;
    toDate: string;
    leaveValue: number;
    session: string;
    createdAt?: any;
}

export default function StaffDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [staff, setStaff] = useState<any>(null);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Calculate balances
    const leaveBalances: Record<string, number> = {};
    const currentYear = new Date().getFullYear();
    const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
    const yearEnd = format(endOfYear(new Date()), "yyyy-MM-dd");

    const approvedYearLeaves = leaves.filter(l =>
        l.status === "Approved" &&
        l.fromDate >= yearStart &&
        l.fromDate <= yearEnd
    );

    Object.entries(LEAVE_LIMITS).forEach(([type, limit]) => {
        const used = approvedYearLeaves
            .filter(l => l.type === type)
            .reduce((sum, l) => sum + (l.leaveValue || 0), 0);
        leaveBalances[type] = Math.max(0, limit - used);
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Approved': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'Pending': return <Clock className="h-5 w-5 text-yellow-500" />;
            case 'Recommended': return <Clock className="h-5 w-5 text-blue-500" />;
            case 'Rejected': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <FileText className="h-5 w-5 text-gray-500" />;
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Approved': return 'bg-green-100 text-green-700 border-green-200';
            case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'Recommended': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Rejected': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    useEffect(() => {
        const fetchDetails = async () => {
            if (!db) return;
            try {
                // Fetch user doc
                const userDoc = await getDoc(doc(db, "users", resolvedParams.id));
                if (userDoc.exists()) {
                    setStaff(userDoc.data());
                } else {
                    setError("Staff member not found.");
                    setLoading(false);
                    return;
                }

                // Fetch leaves
                const leavesQuery = query(
                    collection(db, "leaves"),
                    where("userId", "==", resolvedParams.id)
                );
                const leavesSnap = await getDocs(leavesQuery);
                const leavesData = leavesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LeaveRequest[];

                // Sort leaves by date ascending
                leavesData.sort((a, b) => {
                    return new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime();
                });

                setLeaves(leavesData);
                setLoading(false);
            } catch (err: any) {
                console.error("Error fetching staff details:", err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchDetails();
    }, [resolvedParams.id]);

    if (loading) {
        return (
            <DashboardLayout allowedRole="princi">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-gray-400">Loading staff history...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !staff) {
        return (
            <DashboardLayout allowedRole="princi">
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <div className="text-red-500">{error || "Staff member not found"}</div>
                    <Link href="/principal/staffs" className="text-blue-600 hover:underline">
                        Return to Staff List
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout allowedRole="princi">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/principal/staffs" className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Staff Details</h1>
                        <p className="text-sm text-gray-500">View information and leave history</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left Column: Staff Info */}
                    <div className="space-y-6">
                        {/* Profile Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold uppercase shrink-0">
                                    {staff.displayName?.[0] || staff.email?.[0]}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">{staff.salutation} {staff.displayName}</h2>
                                    <p className="text-sm text-gray-500">{staff.designation}</p>
                                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold uppercase rounded-full ${staff.role === 'princi' ? 'bg-purple-100 text-purple-700' :
                                        staff.role === 'dir' ? 'bg-orange-100 text-orange-700' :
                                            staff.role === 'hod' ? 'bg-indigo-100 text-indigo-700' :
                                                'bg-gray-100 text-gray-700'
                                        }`}>
                                        {staff.role === 'princi' ? 'Principal' :
                                            staff.role === 'dir' ? 'Director' :
                                                staff.role === 'hod' ? 'HOD' : 'Staff'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                                    <span className="truncate">{staff.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Briefcase className="h-4 w-4 text-gray-400 shrink-0" />
                                    <span>{staff.department || "No Department"}</span>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Right Column: Leave Balances */}
                    <div className="space-y-6">
                        {/* Leave Balances Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CalendarClock className="h-5 w-5 text-gray-500" />
                                    <h3 className="font-semibold text-gray-900">Leave Balances</h3>
                                </div>
                                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                                    {currentYear}
                                </span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Object.entries(leaveBalances).map(([type, remaining]) => (
                                        <div key={type} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                            <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 line-clamp-1" title={type}>
                                                {type}
                                            </p>
                                            <div className="flex items-baseline gap-2">
                                                <span className={`text-xl sm:text-2xl font-bold ${remaining === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {remaining}
                                                </span>
                                                <span className="text-xs text-gray-400">/ {LEAVE_LIMITS[type as LeaveType]}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Leave History */}
                <div>
                    {/* Mobile View: Cards */}
                    <div className="grid grid-cols-1 gap-4 lg:hidden">
                        {leaves.length === 0 ? (
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
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-semibold text-blue-600 uppercase">
                                                {leave.leaveValue} Day(s)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                            <h3 className="font-semibold text-gray-900 text-lg">Leave History</h3>
                            <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                                Total: {leaves.length}
                            </span>
                        </div>
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
                                    {leaves.length === 0 ? (
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
            </div>
        </DashboardLayout >
    );
}
