"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { auth, db, secondaryAuth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterStaffPage() {
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");

    // New Staff Details
    const [salutation, setSalutation] = useState("Dr.");
    const [dateOfJoining, setDateOfJoining] = useState("");
    const [appointmentNo, setAppointmentNo] = useState("");
    const [designation, setDesignation] = useState("");
    const [department, setDepartment] = useState("");
    const [status, setStatus] = useState("Active");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: "", type: "" });

        try {
            // Create user using secondary auth instance to avoid signing out current admin
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, "123456");

            // Add to Firestore
            await setDoc(doc(db, "users", userCredential.user.uid), {
                email,
                displayName,
                role: designation === "Principal" ? "princi" :
                    designation === "Director" ? "dir" :
                        designation === "Head of Department" ? "hod" : "staff",

                // Save new details
                salutation,
                dateOfJoining,
                appointmentNo,
                designation,
                department,
                status,

                createdAt: new Date().toISOString(),
            });

            // Sign out from the secondary instance immediately
            await signOut(secondaryAuth);

            setMessage({ text: "Staff member registered successfully!", type: "success" });

            // Reset form
            setEmail("");
            setDisplayName("");
            setSalutation("Mr.");
            setDateOfJoining("");
            setAppointmentNo("");
            setDesignation("");
            setDepartment("");
            setStatus("Active");

        } catch (error: any) {
            console.error("Registration error:", error);
            setMessage({ text: error.message || "Failed to register staff.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout allowedRole="admin">
            <div className="max-w-2xl mx-auto pb-10">
                <div className="mb-6 px-1">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Register Staff</h1>
                    <p className="text-sm text-gray-500">Create new staff accounts for the portal.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6 bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Salutation</label>
                                <select
                                    value={salutation}
                                    onChange={(e) => setSalutation(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-purple-500 focus:ring-purple-500 outline-none text-gray-900 bg-white"
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
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-purple-500 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                    placeholder="Full Name"
                                />
                            </div>
                        </div>

                        {/* Department & Designation */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Department</label>
                                <select
                                    required
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-purple-500 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                >
                                    <option value="" disabled>Select Department</option>
                                    <option value="Civil Engineering">Civil Engineering</option>
                                    <option value="Electrical & Electronics Engineering">Electrical & Electronics Engineering</option>
                                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                                    <option value="Basic Science & Humanities">Basic Science & Humanities</option>
                                    <option value="Physical Education">Physical Education</option>
                                    <option value="Office & Administration">Office & Administration</option>

                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Designation</label>
                                <select
                                    required
                                    value={designation}
                                    onChange={(e) => setDesignation(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-purple-500 focus:ring-purple-500 outline-none text-gray-900 bg-white"
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

                        {/* Service Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date of Joining</label>
                                <input
                                    type="date"
                                    required
                                    value={dateOfJoining}
                                    onChange={(e) => setDateOfJoining(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-purple-500 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                />
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Appointment No</label>
                                <input
                                    type="text"
                                    value={appointmentNo}
                                    onChange={(e) => setAppointmentNo(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-purple-500 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                    placeholder=""
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-purple-500 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="On Leave">On Leave</option>
                                    <option value="Resigned">Resigned</option>
                                </select>
                            </div>
                        </div>


                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 shadow-sm focus:border-purple-500 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                                placeholder="staff@example.com"
                            />
                        </div>

                        {/* Password field removed - using default '123456' */}
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
                        className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                    >
                        {loading ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <>
                                <UserPlus className="h-5 w-5" />
                                Register Staff Member
                            </>
                        )}
                    </button>

                    <p className="text-[10px] md:text-xs text-center text-gray-400">
                        {/* The new user can sign in immediately with these credentials. */}
                    </p>
                </form>
            </div>
        </DashboardLayout>
    );
}
