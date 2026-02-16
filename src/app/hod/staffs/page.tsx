"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import EditStaffModal from "./EditStaffModal";
import { Users, AlertCircle, Calendar, Pencil } from "lucide-react";
import { format, startOfYear, endOfYear } from "date-fns";
import { LEAVE_LIMITS, LeaveType } from "@/lib/constants";


interface StaffData {
    id: string;
    email: string;
    displayName: string;
    department?: string;
    designation?: string;
    salutation?: string;
    dateOfJoining?: string;
    service?: string;
    appointmentNo?: string;
    status?: string;
    leavesUsed: number;
    leaveBalances: Record<string, number>;
}

export default function AdminStaffOverview() {
    const { userData, loading: authLoading } = useAuth();
    const [staffs, setStaffs] = useState<StaffData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffData | null>(null);

    // ... (useEffect hook remains roughly the same, but we need to ensure we map all fields)
    useEffect(() => {
        if (!db || authLoading) return;

        // 1. Fetch all staff members
        const staffQuery = query(collection(db, "users"), where("role", "in", ["staff", "princi", "dir", "hod"]));

        // 2. Fetch all approved leaves for the current year
        const currentYear = new Date().getFullYear();
        const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
        const yearEnd = format(endOfYear(new Date()), "yyyy-MM-dd");

        const unsubUsers = onSnapshot(staffQuery, (userSnap) => {
            const users = userSnap.docs.map(doc => ({
                id: doc.id,
                email: doc.data().email,
                displayName: doc.data().displayName || "N/A",
                department: doc.data().department || "-",
                designation: doc.data().designation || "-",
                // capture other fields for editing
                salutation: doc.data().salutation,
                dateOfJoining: doc.data().dateOfJoining,
                service: doc.data().service,
                appointmentNo: doc.data().appointmentNo,
                status: doc.data().status,
                leavesUsed: 0
            }));

            // Filter by department if userData matches
            const filteredUsers = userData?.department
                ? users.filter(u => u.department === userData.department)
                : users; // Should ideally always have a department for HOD


            // ... (leaves fetching logic stays the same)
            const leavesQuery = query(
                collection(db, "leaves"),
                where("status", "==", "Approved")
            );

            const unsubLeaves = onSnapshot(leavesQuery, (leaveSnap) => {
                const leaves = leaveSnap.docs.map(doc => doc.data());

                const updatedStaffs = filteredUsers.map(user => {
                    const userYearLeaves = leaves.filter(leave =>
                        leave.userId === user.id &&
                        leave.fromDate >= yearStart &&
                        leave.fromDate <= yearEnd
                    );
                    const balances: Record<string, number> = {};
                    Object.entries(LEAVE_LIMITS).forEach(([type, limit]) => {
                        const used = userYearLeaves
                            .filter(l => l.type === type)
                            .reduce((sum, l) => sum + (l.leaveValue || 0), 0);
                        balances[type] = Math.max(0, limit - used);
                    });

                    return {
                        ...user,
                        leavesUsed: userYearLeaves.reduce((sum, leave) => sum + (leave.leaveValue || 0), 0),
                        leaveBalances: balances
                    };
                });

                setStaffs(updatedStaffs);
                setLoading(false);
            }, (err) => {
                console.error("Leaves fetch error:", err);
                setError("Failed to fetch leave data.");
                setLoading(false);
            });

            return () => unsubLeaves();

        }, (err) => {
            console.error("Users fetch error:", err);
            setError("Failed to fetch staff data.");
            setLoading(false);
        });

        return () => unsubUsers();
    }, [authLoading, userData]);

    return (
        <DashboardLayout allowedRole="hod">
            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="h-6 w-6 text-blue-600" />
                        Staff Overview
                    </h1>
                    <p className="text-sm text-gray-500">
                        View all staff members and their leave usage for {mounted ? new Date().getFullYear() : ""}.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Mobile View: Cards */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400">Loading staff data...</div>
                    ) : staffs.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic bg-white rounded-xl border border-gray-100">
                            No staff members found.
                        </div>
                    ) : (
                        staffs.map((staff) => (
                            <div key={staff.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase shrink-0">
                                            {staff.displayName?.[0] || staff.email?.[0]}
                                        </div>
                                        <div className="overflow-hidden min-w-0">
                                            <h3 className="font-bold text-gray-900 truncate">{staff.displayName}</h3>
                                            <p className="text-xs text-gray-500 truncate">{staff.department} • {staff.designation}</p>
                                            <p className="text-xs text-gray-400 truncate mt-0.5">{staff.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEditingStaff(staff)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                                    >
                                        <Pencil className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <div className="w-full">
                                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                                            <Calendar className="h-4 w-4" />
                                            <span className="text-xs font-semibold uppercase tracking-wider">Remaining Leaves</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {staff.leaveBalances && Object.entries(staff.leaveBalances).map(([type, remaining]) => (
                                                <div key={type} className="flex flex-col bg-gray-50 px-2 py-1 rounded border border-gray-100 min-w-[50px]">
                                                    <span className="text-[10px] text-gray-500 font-medium uppercase">{type}</span>
                                                    <span className={`text-sm font-bold ${remaining === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                        {remaining}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Employee</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Designation</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Department</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Email Address</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Remaining</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading staff data...</td></tr>
                                ) : staffs.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic">No staff members registered.</td></tr>
                                ) : (
                                    staffs.map((staff) => (
                                        <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase text-sm">
                                                        {staff.displayName?.[0] || staff.email?.[0]}
                                                    </div>
                                                    <span className="font-semibold text-gray-900">{staff.displayName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{staff.designation}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{staff.department}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{staff.email}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-wrap justify-center gap-1.5 max-w-[220px] mx-auto">
                                                    {staff.leaveBalances && Object.entries(staff.leaveBalances).map(([type, remaining]) => (
                                                        <span key={type} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${remaining === 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-700 border-gray-100'
                                                            }`} title={type}>
                                                            {type}: {remaining}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setEditingStaff(staff)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit Details"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {editingStaff && (
                    <EditStaffModal
                        staff={editingStaff}
                        onClose={() => setEditingStaff(null)}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
