"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    serverTimestamp,
    orderBy,
} from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { CheckCircle, XCircle, FileCheck, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";

interface StaffOption {
    id: string;
    displayName: string;
    salutation?: string;
    designation?: string;
}

interface CompLeaveGrant {
    id: string;
    staffId: string;
    staffName: string;
    date: string;
    reason: string;
    docSubmitted: boolean;
    status: "Approved" | "Rejected";
    grantedDays: number;
    createdAt?: any;
}

export default function ManageCompLeavePage() {
    const { user, userData } = useAuth();
    const [staffList, setStaffList] = useState<StaffOption[]>([]);
    const [grants, setGrants] = useState<CompLeaveGrant[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const [form, setForm] = useState({
        staffId: "",
        date: "",
        reason: "",
        docSubmitted: "" as "" | "yes" | "no",
    });

    // Fetch staff from HOD's department
    useEffect(() => {
        if (!db || !userData?.department) return;

        const q = query(
            collection(db, "users"),
            where("role", "==", "staff"),
            where("department", "==", userData.department)
        );

        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({
                id: d.id,
                displayName: d.data().displayName || d.data().email,
                salutation: d.data().salutation,
                designation: d.data().designation,
            }));
            setStaffList(list);

            // Auto-select first staff if nothing selected
            if (list.length > 0 && !form.staffId) {
                setForm((f) => ({ ...f, staffId: list[0].id }));
            }
        });

        return () => unsub();
    }, [userData?.department]);

    // Fetch existing grants for this HOD's department
    useEffect(() => {
        if (!db || !user) return;

        const q = query(
            collection(db, "compLeaveGrants"),
            where("hodId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const data = snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as CompLeaveGrant[];
                setGrants(data);
            },
            () => {
                // If index doesn't exist yet, fall back without orderBy
                const q2 = query(
                    collection(db, "compLeaveGrants"),
                    where("hodId", "==", user.uid)
                );
                onSnapshot(q2, (snap) => {
                    const data = snap.docs
                        .map((d) => ({ id: d.id, ...d.data() } as CompLeaveGrant))
                        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setGrants(data);
                });
            }
        );

        return () => unsub();
    }, [user]);

    const showToast = (type: "success" | "error", message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const handleAction = async (action: "Approved" | "Rejected") => {
        if (!user || !userData?.department) return;
        if (!form.staffId) { showToast("error", "Please select a staff member."); return; }
        if (!form.date) { showToast("error", "Please select a date."); return; }
        if (!form.reason.trim()) { showToast("error", "Please enter a reason."); return; }
        if (!form.docSubmitted) { showToast("error", "Please indicate if a document was submitted."); return; }

        const selectedStaff = staffList.find((s) => s.id === form.staffId);

        setSubmitting(true);
        try {
            await addDoc(collection(db, "compLeaveGrants"), {
                staffId: form.staffId,
                staffName: selectedStaff ? `${selectedStaff.salutation || ""} ${selectedStaff.displayName}`.trim() : form.staffId,
                date: form.date,
                reason: form.reason.trim(),
                docSubmitted: form.docSubmitted === "yes",
                status: action,
                grantedDays: action === "Approved" ? 1 : 0,
                hodId: user.uid,
                department: userData.department,
                createdAt: serverTimestamp(),
            });

            showToast(
                "success",
                action === "Approved"
                    ? "Compensatory leave of 1 day granted successfully!"
                    : "Compensatory leave request rejected."
            );

            // Reset form (keep staff selected)
            setForm((f) => ({ ...f, date: "", reason: "", docSubmitted: "" }));
        } catch (err) {
            console.error("Error saving comp leave grant:", err);
            showToast("error", "Failed to save. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DashboardLayout allowedRole="hod">
            <div className="space-y-6 max-w-4xl">
                {/* Header */}
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileCheck className="h-6 w-6 text-indigo-600" />
                        Manage Compensatory Leave
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Grant or reject compensatory leave credits for your department staff. Each grant is valid for <strong>90 days</strong> from the date of issue.
                    </p>
                </div>

                {/* Toast */}
                {toast && (
                    <div
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm ${toast.type === "success"
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-red-50 border-red-200 text-red-700"
                            }`}
                    >
                        {toast.type === "success" ? (
                            <CheckCircle className="h-5 w-5 shrink-0" />
                        ) : (
                            <AlertCircle className="h-5 w-5 shrink-0" />
                        )}
                        <span className="flex-1 text-sm font-medium">{toast.message}</span>
                        <button onClick={() => setToast(null)}>
                            <X className="h-4 w-4 opacity-60 hover:opacity-100" />
                        </button>
                    </div>
                )}

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-8">
                    <h2 className="text-base font-semibold text-gray-800 mb-5">New Compensatory Leave Entry</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Staff Dropdown */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Select Staff Member
                            </label>
                            <select
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 outline-none text-gray-900 bg-white"
                                value={form.staffId}
                                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                            >
                                <option value="">-- Choose a staff member --</option>
                                {staffList.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.salutation ? `${s.salutation} ` : ""}{s.displayName}
                                        {s.designation ? ` (${s.designation})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Date of Compensatory Work
                            </label>
                            <input
                                type="date"
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-indigo-500 outline-none text-gray-900"
                                max={new Date().toISOString().split("T")[0]}
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                            />
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Reason
                            </label>
                            <input
                                type="text"
                                placeholder="e.g., Worked on national holiday"
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-indigo-500 outline-none text-gray-900"
                                value={form.reason}
                                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                            />
                        </div>

                        {/* Document Submitted */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Relevant Document Submitted?
                            </label>
                            <div className="flex gap-6">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${form.docSubmitted === "yes"
                                        ? "border-indigo-600 bg-indigo-600"
                                        : "border-gray-300 group-hover:border-indigo-400"
                                        }`}>
                                        {form.docSubmitted === "yes" && (
                                            <div className="h-2 w-2 rounded-full bg-white" />
                                        )}
                                    </div>
                                    <input
                                        type="radio"
                                        className="sr-only"
                                        name="docSubmitted"
                                        value="yes"
                                        checked={form.docSubmitted === "yes"}
                                        onChange={() => setForm({ ...form, docSubmitted: "yes" })}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Yes</span>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${form.docSubmitted === "no"
                                        ? "border-indigo-600 bg-indigo-600"
                                        : "border-gray-300 group-hover:border-indigo-400"
                                        }`}>
                                        {form.docSubmitted === "no" && (
                                            <div className="h-2 w-2 rounded-full bg-white" />
                                        )}
                                    </div>
                                    <input
                                        type="radio"
                                        className="sr-only"
                                        name="docSubmitted"
                                        value="no"
                                        checked={form.docSubmitted === "no"}
                                        onChange={() => setForm({ ...form, docSubmitted: "no" })}
                                    />
                                    <span className="text-sm font-medium text-gray-700">No</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
                        <button
                            onClick={() => handleAction("Approved")}
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-all hover:-translate-y-0.5 shadow-sm disabled:opacity-50"
                        >
                            <CheckCircle className="h-4 w-4" />
                            {submitting ? "Saving..." : "Accept"}
                        </button>
                        <button
                            onClick={() => handleAction("Rejected")}
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all hover:-translate-y-0.5 shadow-sm disabled:opacity-50"
                        >
                            <XCircle className="h-4 w-4" />
                            {submitting ? "Saving..." : "Reject"}
                        </button>
                    </div>
                </div>

                {/* Grant History */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 md:px-8 py-4 border-b border-gray-100">
                        <h2 className="text-base font-semibold text-gray-800">Grant History</h2>
                    </div>

                    {grants.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic">No comp leave records yet.</div>
                    ) : (
                        <>
                            {/* Mobile */}
                            <div className="divide-y divide-gray-100 md:hidden">
                                {grants.map((g) => {
                                    const COMP_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000;
                                    const createdSec = g.createdAt?.seconds ?? 0;
                                    const expiresAt = createdSec * 1000 + COMP_VALIDITY_MS;
                                    const now = Date.now();
                                    const isExpired = g.status === "Approved" && expiresAt < now;
                                    const daysLeft = g.status === "Approved" ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;
                                    const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

                                    return (
                                        <div key={g.id} className="p-4 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-sm text-gray-900">{g.staffName}</p>
                                                    <p className="text-xs text-gray-500">{g.date ? format(new Date(g.date), "MMM dd, yyyy") : "-"}</p>
                                                </div>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${g.status === "Approved"
                                                        ? isExpired
                                                            ? "bg-gray-100 text-gray-500 border-gray-200"
                                                            : "bg-green-50 text-green-700 border-green-200"
                                                        : "bg-red-50 text-red-700 border-red-200"
                                                    }`}>
                                                    {g.status === "Approved" ? `+${g.grantedDays} Day` : "Rejected"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-600">{g.reason}</p>
                                            <p className="text-[10px] text-gray-400">Doc submitted: {g.docSubmitted ? "Yes" : "No"}</p>
                                            {g.status === "Approved" && (
                                                <p className={`text-[10px] font-medium ${isExpired ? "text-red-500" : isExpiringSoon ? "text-yellow-600" : "text-green-600"
                                                    }`}>
                                                    {isExpired
                                                        ? "⛔ Expired"
                                                        : isExpiringSoon
                                                            ? `⚠ Expires in ${daysLeft} day(s)`
                                                            : `✓ Valid until ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                                                    }
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Doc Submitted</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status / Days</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Expiry</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {grants.map((g) => {
                                            const COMP_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000;
                                            const createdSec = g.createdAt?.seconds ?? 0;
                                            const expiresAt = createdSec * 1000 + COMP_VALIDITY_MS;
                                            const now = Date.now();
                                            const isExpired = g.status === "Approved" && expiresAt < now;
                                            const daysLeft = g.status === "Approved" ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;
                                            const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

                                            return (
                                                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{g.staffName}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{g.date ? format(new Date(g.date), "MMM dd, yyyy") : "-"}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{g.reason}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`text-xs font-semibold ${g.docSubmitted ? "text-green-600" : "text-gray-400"}`}>
                                                            {g.docSubmitted ? "Yes" : "No"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${g.status === "Approved"
                                                                ? isExpired
                                                                    ? "bg-gray-100 text-gray-500 border-gray-200"
                                                                    : "bg-green-50 text-green-700 border-green-200"
                                                                : "bg-red-50 text-red-700 border-red-200"
                                                            }`}>
                                                            {g.status === "Approved" ? `✓ +${g.grantedDays} Day` : "✗ Rejected"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {g.status === "Approved" ? (
                                                            <span className={`text-xs font-medium ${isExpired ? "text-red-500" : isExpiringSoon ? "text-yellow-600" : "text-green-600"
                                                                }`}>
                                                                {isExpired
                                                                    ? "⛔ Expired"
                                                                    : isExpiringSoon
                                                                        ? `⚠ ${daysLeft}d left`
                                                                        : `✓ ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-300">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
