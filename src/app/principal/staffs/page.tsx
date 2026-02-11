"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import EditStaffModal from "./EditStaffModal";
import { Users, AlertCircle, Calendar, Pencil, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
    role?: string;
}

type SortKey = 'displayName' | 'role' | 'designation' | 'department' | 'email' | 'remaining';
interface SortConfig {
    key: SortKey;
    direction: 'asc' | 'desc';
}

export default function AdminStaffOverview() {
    const [staffs, setStaffs] = useState<StaffData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffData | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'displayName', direction: 'asc' });

    // ... (useEffect hook remains roughly the same, but we need to ensure we map all fields)
    useEffect(() => {
        if (!db) return;
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
                leavesUsed: 0,
                role: doc.data().role || "staff"
            }));


            // ... (leaves fetching logic stays the same)
            const leavesQuery = query(
                collection(db, "leaves"),
                where("status", "==", "Approved")
            );

            const unsubLeaves = onSnapshot(leavesQuery, (leaveSnap) => {
                const leaves = leaveSnap.docs.map(doc => doc.data());

                const updatedStaffs = users.map(user => {
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
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedStaffs = (staffList: StaffData[]) => {
        const sorted = [...staffList].sort((a, b) => {
            let aValue: any = '';
            let bValue: any = '';

            switch (sortConfig.key) {
                case 'displayName':
                    aValue = a.displayName;
                    bValue = b.displayName;
                    break;
                case 'role':
                    aValue = a.role;
                    bValue = b.role;
                    break;
                case 'designation':
                    aValue = a.designation;
                    bValue = b.designation;
                    break;
                case 'department':
                    aValue = a.department;
                    bValue = b.department;
                    break;
                case 'email':
                    aValue = a.email;
                    bValue = b.email;
                    break;
                case 'remaining': // Sort by total remaining leaves
                    aValue = Object.values(a.leaveBalances || {}).reduce((sum, val) => sum + val, 0);
                    bValue = Object.values(b.leaveBalances || {}).reduce((sum, val) => sum + val, 0);
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    };

    const getDisplayRole = (role?: string) => {
        if (role === 'princi') return 'Principal';
        if (role === 'dir') return 'Director';
        if (role === 'hod') return 'HOD';
        return 'Staff';
    };

    const filteredStaffs = staffs.filter((staff) => {
        const searchLower = searchTerm.toLowerCase();
        const displayRole = getDisplayRole(staff.role).toLowerCase();
        return (
            staff.displayName?.toLowerCase().includes(searchLower) ||
            staff.email?.toLowerCase().includes(searchLower) ||
            staff.department?.toLowerCase().includes(searchLower) ||
            staff.designation?.toLowerCase().includes(searchLower) ||
            staff.role?.toLowerCase().includes(searchLower) ||
            displayRole.includes(searchLower)
        );
    });

    const sortedAndFilteredStaffs = getSortedStaffs(filteredStaffs);

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="h-4 w-4 text-gray-400 ml-1" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-600 ml-1" /> : <ArrowDown className="h-4 w-4 text-blue-600 ml-1" />;
    };

    return (
        <DashboardLayout allowedRole="princi">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Users className="h-6 w-6 text-blue-600" />
                            Staff Overview
                        </h1>

                    </div>

                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search staff..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow shadow-sm"
                        />
                    </div>
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
                    ) : sortedAndFilteredStaffs.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic bg-white rounded-xl border border-gray-100">
                            {searchTerm ? "No staff members match your search." : "No staff members found."}
                        </div>
                    ) : (
                        sortedAndFilteredStaffs.map((staff) => (
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
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <span className={`px-2 py-1 text-xs font-bold uppercase rounded-full ${staff.role === 'princi' ? 'bg-purple-100 text-purple-700' :
                                            staff.role === 'dir' ? 'bg-orange-100 text-orange-700' :
                                                staff.role === 'hod' ? 'bg-indigo-100 text-indigo-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {staff.role === 'princi' ? 'Principal' :
                                                staff.role === 'dir' ? 'Director' :
                                                    staff.role === 'hod' ? 'HOD' : 'Staff'}
                                        </span>
                                        <button
                                            onClick={() => setEditingStaff(staff)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Pencil className="h-5 w-5" />
                                        </button>
                                    </div>
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Sl. No</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-50" onClick={() => handleSort('displayName')}>
                                        <div className="flex items-center gap-1">Employee <SortIcon columnKey="displayName" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-50" onClick={() => handleSort('role')}>
                                        <div className="flex items-center gap-1">Role <SortIcon columnKey="role" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-50" onClick={() => handleSort('designation')}>
                                        <div className="flex items-center gap-1">Designation <SortIcon columnKey="designation" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-50" onClick={() => handleSort('department')}>
                                        <div className="flex items-center gap-1">Department <SortIcon columnKey="department" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-50" onClick={() => handleSort('email')}>
                                        <div className="flex items-center gap-1">Email <SortIcon columnKey="email" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center cursor-pointer hover:bg-gray-50" onClick={() => handleSort('remaining')}>
                                        <div className="flex items-center justify-center gap-1">Remaining <SortIcon columnKey="remaining" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading staff data...</td></tr>
                                ) : sortedAndFilteredStaffs.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-20 text-center text-gray-400 italic">{searchTerm ? "No staff members match your search." : "No staff members registered."}</td></tr>
                                ) : (
                                    sortedAndFilteredStaffs.map((staff, index) => (
                                        <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-center text-sm text-gray-500 font-medium">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase text-sm">
                                                        {staff.displayName?.[0] || staff.email?.[0]}
                                                    </div>
                                                    <span className="font-semibold text-gray-900">{staff.displayName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2 py-1 text-xs font-bold uppercase rounded-full ${staff.role === 'princi' ? 'bg-purple-100 text-purple-700' :
                                                    staff.role === 'dir' ? 'bg-orange-100 text-orange-700' :
                                                        staff.role === 'hod' ? 'bg-indigo-100 text-indigo-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {staff.role === 'princi' ? 'Principal' :
                                                        staff.role === 'dir' ? 'Director' :
                                                            staff.role === 'hod' ? 'HOD' : 'Staff'}
                                                </span>
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
