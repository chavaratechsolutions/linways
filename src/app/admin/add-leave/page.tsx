"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";
import { LEAVE_LIMITS, LeaveType } from "@/lib/constants";
import { CheckCircle2, AlertCircle, Search } from "lucide-react";

interface User {
    id: string;
    displayName: string;
    email: string;
    department?: string;
    designation?: string;
    role: string;
}

export default function AdminAddLeavePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [fetchingUsers, setFetchingUsers] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [message, setMessage] = useState({ text: "", type: "" });

    // Form Data
    const [formData, setFormData] = useState({
        type: "Casual Leave",
        fromDate: "",
        toDate: "",
        session: "Full Day",
        reason: "",
        description: "",
    });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // Fetch staff, hod, princi, director
                const q = query(
                    collection(db, "users"),
                    where("role", "in", ["staff", "hod", "princi", "dir"])
                );
                const snapshot = await getDocs(q);
                const fetchedUsers = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as User));

                // Sort by name
                fetchedUsers.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

                setUsers(fetchedUsers);
            } catch (error) {
                console.error("Error fetching users:", error);
                setMessage({ text: "Failed to load staff list.", type: "error" });
            } finally {
                setFetchingUsers(false);
            }
        };

        fetchUsers();
    }, []);

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
        setMessage({ text: "", type: "" });

        if (!selectedUser) {
            setMessage({ text: "Please select a staff member.", type: "error" });
            return;
        }

        setLoading(true);

        // Validation
        if (formData.fromDate && formData.toDate) {
            const start = parseISO(formData.fromDate);
            const end = parseISO(formData.toDate);
            if (differenceInDays(end, start) < 0) {
                setMessage({ text: "End date cannot be before start date.", type: "error" });
                setLoading(false);
                return;
            }
        }

        const leaveValue = calculateLeaveValue();

        try {
            const dataToSave = {
                ...formData,
                userId: selectedUser.id,
                userEmail: selectedUser.email,
                userName: selectedUser.displayName, // Store name for easier reference
                department: selectedUser.department || "-",
                designation: selectedUser.designation || "-",
                leaveValue,
                status: "Approved", // Auto-approve admin added leaves
                approvedBy: "Admin",
                approvedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                isAdminEntry: true
            };

            await addDoc(collection(db, "leaves"), dataToSave);

            setMessage({ text: `Leave added successfully for ${selectedUser.displayName}!`, type: "success" });

            // Reset form but keep user selected? Or reset all? 
            // Resetting sensitive fields
            setFormData({
                type: "Casual Leave",
                fromDate: "",
                toDate: "",
                session: "Full Day",
                reason: "",
                description: "",
            });
            // Optional: Deselect user
            // setSelectedUser(null);

        } catch (error) {
            console.error("Error submitting leave:", error);
            setMessage({ text: "Failed to submit leave entry.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout allowedRole="admin">
            <div className="max-w-2xl mx-auto pb-10">
                <div className="mb-6 px-1">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Add Staff Leave</h1>
                    <p className="text-sm text-gray-500">Manually record a leave for a staff member. Automatically approved.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-100">

                    {/* User Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Staff Member</label>
                        {fetchingUsers ? (
                            <div className="h-10 w-full animate-pulse bg-gray-100 rounded-xl"></div>
                        ) : (
                            <select
                                required
                                value={selectedUser?.id || ""}
                                onChange={(e) => {
                                    const user = users.find(u => u.id === e.target.value);
                                    setSelectedUser(user || null);
                                }}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                            >
                                <option value="">-- Choose Staff --</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.displayName} ({user.department || "No Dept"})
                                        {user.role === 'hod' ? " [HOD]" : ""}
                                    </option>
                                ))}
                            </select>
                        )}
                        {selectedUser && (
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <span className="font-semibold">Selected:</span> {selectedUser.displayName}
                                <span className="mx-1">•</span>
                                {selectedUser.email}
                                <span className="mx-1">•</span>
                                {selectedUser.designation}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Leave Details */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
                            <select
                                required
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                {Object.keys(LEAVE_LIMITS).map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Session</label>
                            <select
                                required
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                                value={formData.session}
                                onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                            >
                                <option>Full Day</option>
                                <option>Forenoon</option>
                                <option>Afternoon</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Date</label>
                            <input
                                type="date"
                                required
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none text-gray-900"
                                value={formData.fromDate}
                                onChange={(e) => {
                                    const newDate = e.target.value;
                                    setFormData({
                                        ...formData,
                                        fromDate: newDate,
                                        toDate: formData.session !== "Full Day" ? newDate : formData.toDate
                                    });
                                }}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">To Date</label>
                            <input
                                type="date"
                                required
                                disabled={formData.session !== "Full Day"}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                                value={formData.session !== "Full Day" ? formData.fromDate : formData.toDate}
                                onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g., Medical checkup"
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none text-gray-900"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        />
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl flex justify-between items-center border border-blue-100">
                        <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Days to Deduct:</span>
                        <span className="text-xl font-black text-blue-800">{calculateLeaveValue()}</span>
                    </div>

                    {message.text && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
                            }`}>
                            {message.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Adding Leave...
                            </span>
                        ) : "Submit & Approve Leave"}
                    </button>

                </form>
            </div>
        </DashboardLayout>
    );
}
