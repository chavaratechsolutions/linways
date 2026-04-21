"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { Users, AlertCircle, Search, ArrowUpDown, ArrowUp, ArrowDown, Check } from "lucide-react";

interface StaffData {
    id: string;
    email: string;
    displayName: string;
    department?: string;
    designation?: string;
    role?: string;
}

type SortKey = 'displayName' | 'role' | 'designation' | 'department' | 'email';
interface SortConfig {
    key: SortKey;
    direction: 'asc' | 'desc';
}

export default function VacationLeaveGrand() {
    const [staffs, setStaffs] = useState<StaffData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDepartment, setFilterDepartment] = useState("All");
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'displayName', direction: 'asc' });

    // Track grants to optionally disable or change button text
    const [grantedStatus, setGrantedStatus] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!db) return;
        const staffQuery = query(collection(db, "users"), where("role", "in", ["staff", "princi", "dir", "hod"]));
        const unsubs = onSnapshot(staffQuery, (snap) => {
            const data = snap.docs.map(doc => {
                const user = doc.data();
                return {
                    id: doc.id,
                    email: user.email,
                    displayName: user.displayName || "N/A",
                    department: user.department || "-",
                    designation: user.designation || "-",
                    role: user.role || "staff"
                };
            });
            setStaffs(data);
            setLoading(false);
        }, (err) => {
            console.error("Users fetch error:", err);
            setError("Failed to fetch staff data.");
            setLoading(false);
        });

        // Fetch vacationLeave collection to see who is already granted
        const vacationQuery = query(collection(db, "vacationLeave"));
        const unsubVacation = onSnapshot(vacationQuery, (snap) => {
            const statusMap: Record<string, boolean> = {};
            snap.docs.forEach(d => {
                if(d.data().anyTime === "yes") {
                    statusMap[d.id] = true;
                }
            });
            setGrantedStatus(statusMap);
        });

        return () => {
            unsubs();
            unsubVacation();
        }
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
            let aValue: any = a[sortConfig.key];
            let bValue: any = b[sortConfig.key];

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

        const matchesSearch = (
            staff.displayName?.toLowerCase().includes(searchLower) ||
            staff.email?.toLowerCase().includes(searchLower) ||
            staff.department?.toLowerCase().includes(searchLower) ||
            staff.designation?.toLowerCase().includes(searchLower) ||
            staff.role?.toLowerCase().includes(searchLower) ||
            displayRole.includes(searchLower)
        );

        const matchesDepartment = filterDepartment === "All" || staff.department === filterDepartment;

        return matchesSearch && matchesDepartment;
    });

    const sortedAndFilteredStaffs = getSortedStaffs(filteredStaffs);

    const uniqueDepartments = Array.from(
        new Set(staffs.map(staff => staff.department).filter(dep => dep && dep !== "-"))
    ).sort();

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="h-4 w-4 text-gray-400 ml-1" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-600 ml-1" /> : <ArrowDown className="h-4 w-4 text-blue-600 ml-1" />;
    };

    const handleGrant = async (staffId: string) => {
        try {
            await setDoc(doc(db, "vacationLeave", staffId), { anyTime: "yes" }, { merge: true });
        } catch (err) {
            console.error("Error granting vacation leave:", err);
            alert("Failed to grant vacation leave.");
        }
    };

    return (
        <DashboardLayout allowedRole="dir">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Users className="h-6 w-6 text-blue-600" />
                            Vacation Leave Grand
                        </h1>
                    </div>

                    <div className="flex flex-row gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72">
                            <div className="absolute inset-y-0 left-0 pl-2.5 md:pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search staff..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-8 md:pl-10 pr-3 py-2 md:py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs md:text-sm transition-shadow shadow-sm"
                            />
                        </div>
                        <select
                            value={filterDepartment}
                            onChange={(e) => setFilterDepartment(e.target.value)}
                            className="bg-white border border-gray-300 text-gray-900 text-xs md:text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-1/3 md:w-48 p-2 md:p-2.5 transition-shadow shadow-sm cursor-pointer"
                        >
                            <option value="All">All Departments</option>
                            {uniqueDepartments.map(dep => (
                                <option key={dep} value={dep}>{dep}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Mobile View: Cards */}
                <div className="grid grid-cols-1 gap-4 xl:hidden">
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
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <button 
                                        onClick={() => handleGrant(staff.id)}
                                        className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${grantedStatus[staff.id] ? 'bg-green-50 text-green-700 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                        disabled={grantedStatus[staff.id]}
                                    >
                                        {grantedStatus[staff.id] ? "Granted" : "Grant"}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden xl:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading staff data...</td></tr>
                                ) : sortedAndFilteredStaffs.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-20 text-center text-gray-400 italic">{searchTerm ? "No staff members match your search." : "No staff members registered."}</td></tr>
                                ) : (
                                    sortedAndFilteredStaffs.map((staff, index) => (
                                        <tr key={staff.id} className="hover:bg-gray-50 transition-colors text-left">
                                            <td className="px-6 py-4">
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
                                                <button 
                                                    onClick={() => handleGrant(staff.id)}
                                                    disabled={grantedStatus[staff.id]}
                                                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${grantedStatus[staff.id] ? 'bg-green-50 text-green-700 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}
                                                >
                                                    {grantedStatus[staff.id] ? (
                                                        <span className="flex items-center gap-1 justify-center"><Check className="h-4 w-4"/> Granted</span>
                                                    ) : "Grant"}
                                                </button>
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
