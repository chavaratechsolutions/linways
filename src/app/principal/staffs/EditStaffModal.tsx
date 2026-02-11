"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { X, Save, AlertCircle } from "lucide-react";

interface EditStaffModalProps {
    staff: any;
    onClose: () => void;
}

export default function EditStaffModal({ staff, onClose }: EditStaffModalProps) {
    const [formData, setFormData] = useState({
        salutation: staff.salutation || "Mr.",
        displayName: staff.displayName || "",
        department: (staff.department === "-" || !staff.department) ? "" : staff.department,
        designation: (staff.designation === "-" || !staff.designation) ? "" : staff.designation,
        dateOfJoining: staff.dateOfJoining || "",
        appointmentNo: staff.appointmentNo || "",
        status: staff.status || "Active",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await updateDoc(doc(db, "users", staff.id), formData);
            onClose();
        } catch (err: any) {
            console.error("Error updating staff:", err);
            setError("Failed to update staff details.");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900">Edit Staff Details</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Salutation</label>
                            <select
                                value={formData.salutation}
                                onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="Dr.">Dr.</option>
                                <option value="Prof.">Prof.</option>
                                <option value="Mr.">Mr.</option>
                                <option value="Ms.">Ms.</option>
                                <option value="Mrs.">Mrs.</option>

                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                            <input
                                type="text"
                                required
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 bg-white text-gray-900"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Department</label>
                            <select
                                required
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="" disabled>Select Department</option>
                                <option value="Civil Engineering">Civil Engineering</option>
                                <option value="Electrical & Electronics Engineering">Electrical & Electronics Engineering</option>
                                <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                                <option value="Basic Science & Humanities">Basic Science & Humanities</option>
                                <option value="Physical Education">Physical Education</option>
                                <option value="Office & Administration">Office & Administration</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Designation</label>
                            <select
                                required
                                value={formData.designation}
                                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="" disabled>Select Designation</option>
                                <option value="Principal">Principal</option>
                                <option value="Director">Director</option>
                                <option value="ERP Admin">ERP Admin</option>
                                <option value="Head of Department">Head of Department</option>
                                <option value="Professor">Professor</option>
                                <option value="Associate Professor">Associate Professor</option>
                                <option value="Assistant Professor">Assistant Professor</option>
                                <option value="Lab Instructor">Lab Instructor</option>
                                <option value="System Administrator">System Administrator</option>
                                <option value="Network Administrator">Network Administrator</option>
                                <option value="Administrative Staff">Administrative Staff</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date of Joining</label>
                            <input
                                type="date"
                                value={formData.dateOfJoining}
                                onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 bg-white text-gray-900"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Appointment No</label>
                            <input
                                type="text"
                                value={formData.appointmentNo}
                                onChange={(e) => setFormData({ ...formData, appointmentNo: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 bg-white text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Resigned">Resigned</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {loading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
