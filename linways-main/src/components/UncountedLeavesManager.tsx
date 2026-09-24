"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, updateDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { Search, Save, CheckCircle, RefreshCw, AlertCircle, User } from "lucide-react";
import { format, startOfYear, endOfYear } from "date-fns";

interface StaffUser {
    id: string;
    email: string;
    displayName?: string;
    department?: string;
    designation?: string;
    role?: string;
    extraCasualLeaves?: number;
    salutation?: string;
}

interface LeaveRequest {
    userId: string;
    leaveValue: number;
    fromDate: string;
}

export default function UncountedLeavesManager() {
    const [rawUsers, setRawUsers] = useState<StaffUser[]>([]);
    const [rawLeaves, setRawLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [success, setSuccess] = useState<Record<string, boolean>>({});

    const currentYear = new Date().getFullYear();
    const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
    const yearEnd = format(endOfYear(new Date()), "yyyy-MM-dd");

    // Fetch users and leaves
    useEffect(() => {
        if (!db) return;

        // Fetch HODs and Staffs
        const usersQuery = query(
            collection(db, "users"),
            where("role", "in", ["staff", "hod"])
        );

        const unsubscribeUsers = onSnapshot(usersQuery, (snap) => {
            const usersData = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as StaffUser[];
            setRawUsers(usersData);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching users:", err);
            setLoading(false);
        });

        // Fetch approved casual leaves for the current year
        const leavesQuery = query(
            collection(db, "leaves"),
            where("type", "==", "Casual Leave"),
            where("status", "==", "Approved")
        );

        const unsubscribeLeaves = onSnapshot(leavesQuery, (snap) => {
            const leavesData = snap.docs.map(d => {
                const data = d.data();
                return {
                    userId: data.userId,
                    leaveValue: data.leaveValue || 0,
                    fromDate: data.fromDate
                };
            }).filter(l => l.fromDate >= yearStart && l.fromDate <= yearEnd);
            setRawLeaves(leavesData);
        }, (err) => {
            console.error("Error fetching leaves:", err);
        });

        return () => {
            unsubscribeUsers();
            unsubscribeLeaves();
        };
    }, [yearStart, yearEnd]);

    // Update inputs state when rawUsers is loaded or updated
    useEffect(() => {
        setInputs(prev => {
            const next = { ...prev };
            rawUsers.forEach(u => {
                // Initialize if not already edited by user
                if (!(u.id in next)) {
                    next[u.id] = (u.extraCasualLeaves ?? 0).toString();
                }
            });
            return next;
        });
    }, [rawUsers]);

    const handleInputChange = (userId: string, val: string) => {
        setInputs(prev => ({
            ...prev,
            [userId]: val
        }));
    };

    const handleSave = async (userId: string) => {
        const valStr = inputs[userId] || "0";
        const val = parseFloat(valStr);

        if (isNaN(val) || val < 0) {
            alert("Please enter a valid non-negative number.");
            return;
        }

        setSaving(prev => ({ ...prev, [userId]: true }));
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                extraCasualLeaves: val,
                updatedAt: serverTimestamp()
            });

            // Update AuthContext locally if we are the user being edited?
            // (Usually the admin edits others, so this is not necessary).

            setSuccess(prev => ({ ...prev, [userId]: true }));
            setTimeout(() => {
                setSuccess(prev => ({ ...prev, [userId]: false }));
            }, 2000);
        } catch (err) {
            console.error("Error updating extraCasualLeaves:", err);
            alert("Failed to save changes. Make sure you have proper permissions.");
        } finally {
            setSaving(prev => ({ ...prev, [userId]: false }));
        }
    };

    const getDisplayRole = (role?: string) => {
        if (role === "hod") return "HOD";
        return "Staff";
    };

    const filteredUsers = rawUsers.filter(u => {
        const q = searchTerm.toLowerCase();
        return (
            (u.displayName || "").toLowerCase().includes(q) ||
            (u.email || "").toLowerCase().includes(q) ||
            (u.department || "").toLowerCase().includes(q) ||
            (u.designation || "").toLowerCase().includes(q)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                    <span className="text-gray-500 text-sm font-medium">Loading employee records...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Adjust Casual Leaves</h1>
                <p className="text-sm text-gray-500">Add extra uncounted leaves that will count towards the employee's used Casual Leave balance.</p>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search employee or department..."
                        className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none text-sm text-gray-900"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                    Year: {currentYear}
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Sl. No</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Designation</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">CL Taken</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Extra Added CL</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Total CL</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                                        No employee records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((employee, index) => {
                                    const taken = rawLeaves
                                        .filter(l => l.userId === employee.id)
                                        .reduce((sum, l) => sum + l.leaveValue, 0);

                                    const inputVal = inputs[employee.id] || "0";
                                    const extraNum = parseFloat(inputVal) || 0;
                                    const total = taken + extraNum;

                                    return (
                                        <tr key={employee.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-bold shrink-0">
                                                        {employee.displayName?.[0] || employee.email?.[0] || <User className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                            {employee.salutation ? `${employee.salutation} ` : ""}{employee.displayName || "N/A"}
                                                            <span className={`px-2 py-0.25 text-[10px] font-bold uppercase rounded-full border ${
                                                                employee.role === "hod"
                                                                    ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                                                    : "bg-gray-50 text-gray-700 border-gray-100"
                                                            }`}>
                                                                {getDisplayRole(employee.role)}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-500">{employee.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 font-medium">{employee.designation || "-"}</div>
                                                <div className="text-xs text-gray-500">{employee.department || "-"}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-semibold text-gray-700 text-sm">
                                                {taken}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    className="w-20 text-center rounded-lg border border-gray-300 py-1 focus:border-blue-500 focus:ring-blue-500 outline-none text-sm text-gray-900"
                                                    value={inputVal}
                                                    onChange={(e) => handleInputChange(employee.id, e.target.value)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-blue-700 text-sm">
                                                {total}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleSave(employee.id)}
                                                    disabled={saving[employee.id]}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                        success[employee.id]
                                                            ? "bg-green-100 text-green-700 border border-green-200"
                                                            : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                                    }`}
                                                >
                                                    {success[employee.id] ? (
                                                        <>
                                                            <CheckCircle className="h-3.5 w-3.5" />
                                                            Saved
                                                        </>
                                                    ) : saving[employee.id] ? (
                                                        <>
                                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                                            Saving
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="h-3.5 w-3.5" />
                                                            Save
                                                        </>
                                                    )}
                                                </button>
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
    );
}
