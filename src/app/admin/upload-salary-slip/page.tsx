"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db, storage } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { FileUp, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function UploadSalarySlip() {
    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [designations, setDesignations] = useState<string[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);

    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedDesignation, setSelectedDesignation] = useState("");
    const [selectedStaff, setSelectedStaff] = useState("");
    const [file, setFile] = useState<File | null>(null);

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Fetch users on load
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const q = query(collection(db, "users"), where("role", "in", ["staff", "princi", "dir", "hod"]));
                const snapshot = await getDocs(q);
                const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                setUsers(fetchedUsers);
                
                // Extract unique departments
                const depts = Array.from(new Set(fetchedUsers.map(u => u.department).filter(Boolean))) as string[];
                setDepartments(depts.sort());
            } catch (error) {
                console.error("Error fetching users:", error);
                setMessage({ type: 'error', text: "Failed to load staff data." });
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // Handle department change
    useEffect(() => {
        if (selectedDepartment) {
            const desigs = Array.from(
                new Set(users.filter(u => u.department === selectedDepartment).map(u => u.designation).filter(Boolean))
            ) as string[];
            setDesignations(desigs.sort());
            setSelectedDesignation("");
            setSelectedStaff("");
            setStaffList([]);
        } else {
            setDesignations([]);
            setStaffList([]);
        }
    }, [selectedDepartment, users]);

    // Handle designation change
    useEffect(() => {
        if (selectedDepartment && selectedDesignation) {
            const staff = users.filter(
                u => u.department === selectedDepartment && u.designation === selectedDesignation
            );
            setStaffList(staff.sort((a, b) => a.displayName?.localeCompare(b.displayName) || 0));
            setSelectedStaff("");
        } else {
            setStaffList([]);
        }
    }, [selectedDesignation, selectedDepartment, users]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== "application/pdf") {
                setMessage({ type: 'error', text: "Please upload a valid PDF file." });
                setFile(null);
                e.target.value = '';
            } else {
                setFile(selectedFile);
                setMessage(null);
            }
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedStaff || !file) {
            setMessage({ type: 'error', text: "Please select a staff member and a PDF file." });
            return;
        }

        const staffMember = users.find(u => u.id === selectedStaff);
        if (!staffMember) {
            setMessage({ type: 'error', text: "Staff member not found." });
            return;
        }

        setUploading(true);
        setMessage(null);

        try {
            // Upload to Storage
            const storageRef = ref(storage, `salary_slips/${staffMember.email}.pdf`);
            const snapshot = await uploadBytesResumable(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Save metadata to Firestore
            await setDoc(doc(db, "salary_slips", staffMember.id), {
                userId: staffMember.id,
                name: staffMember.displayName || "Unknown",
                email: staffMember.email,
                department: staffMember.department,
                designation: staffMember.designation,
                pdfUrl: downloadURL,
                uploadedAt: new Date(),
            });

            setMessage({ type: 'success', text: "Salary slip uploaded successfully!" });
            
            // Reset form partially
            setFile(null);
            // Reset file input value
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            
        } catch (error: any) {
            console.error("Upload error:", error);
            setMessage({ type: 'error', text: error.message || "An error occurred during upload." });
        } finally {
            setUploading(false);
        }
    };

    return (
        <DashboardLayout allowedRole="admin">
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileUp className="h-6 w-6 text-blue-600" />
                        Upload Salary Slip
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Upload a salary slip PDF for a specific staff member. This will overwrite any existing salary slip for them.
                    </p>
                </div>

                {message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                        {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                        <p className="text-sm font-medium">{message.text}</p>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-600" />
                            <p>Loading staff data...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleUpload} className="space-y-6">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Department */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-900">Department</label>
                                    <select
                                        value={selectedDepartment}
                                        onChange={(e) => setSelectedDepartment(e.target.value)}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900"
                                        required
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map((dept) => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Designation */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-900">Designation</label>
                                    <select
                                        value={selectedDesignation}
                                        onChange={(e) => setSelectedDesignation(e.target.value)}
                                        disabled={!selectedDepartment}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                                        required
                                    >
                                        <option value="">Select Designation</option>
                                        {designations.map((desig) => (
                                            <option key={desig} value={desig}>{desig}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Staff Name */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-900">Staff Name</label>
                                <select
                                    value={selectedStaff}
                                    onChange={(e) => setSelectedStaff(e.target.value)}
                                    disabled={!selectedDesignation}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                                    required
                                >
                                    <option value="">Select Staff Member</option>
                                    {staffList.map((staff) => (
                                        <option key={staff.id} value={staff.id}>
                                            {staff.displayName || staff.email} ({staff.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* File Upload */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-900">Salary Slip PDF</label>
                                <div className="mt-2 flex justify-center rounded-xl border border-dashed border-gray-300 px-6 py-10 hover:bg-gray-50 transition-colors">
                                    <div className="text-center">
                                        <FileUp className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
                                        <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                                            <label
                                                htmlFor="file-upload"
                                                className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500 px-2 py-1"
                                            >
                                                <span>Upload a file</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} required />
                                            </label>
                                            <p className="pl-1 flex items-center">or drag and drop</p>
                                        </div>
                                        <p className="text-xs leading-5 text-gray-500 mt-2">PDF up to 10MB</p>
                                        {file && (
                                            <p className="text-sm font-medium text-green-600 mt-4 flex items-center justify-center gap-1">
                                                <CheckCircle className="h-4 w-4" />
                                                Selected: {file.name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={uploading || !selectedStaff || !file}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                                            Uploading...
                                        </>
                                    ) : (
                                        "Upload Salary Slip"
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
