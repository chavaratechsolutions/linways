"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useState } from "react";
import * as XLSX from 'xlsx';
import { db, secondaryAuth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function RegisterMultiStaffPage() {
    const [fileName, setFileName] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [logs, setLogs] = useState<{ type: 'success' | 'error', message: string }[]>([]);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [importedCount, setImportedCount] = useState(0);
    const [duplicatesCount, setDuplicatesCount] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFileName(e.target.files[0].name);
            setFile(e.target.files[0]);
            setLogs([]);
            setProgress({ current: 0, total: 0 });
            setShowSuccessPopup(false);
            setImportedCount(0);
            setDuplicatesCount(0);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setLogs([]);
        setProgress({ current: 0, total: 0 });
        setShowSuccessPopup(false);
        setImportedCount(0);
        setDuplicatesCount(0);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

                if (jsonData.length === 0) {
                    setLogs(prev => [...prev, { type: 'error', message: "The Excel file is empty." }]);
                    setLoading(false);
                    return;
                }

                setProgress({ current: 0, total: jsonData.length });

                let successCount = 0;
                let errorCount = 0;
                let dupCount = 0;

                for (let i = 0; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const email = row['email'];

                    if (!email) {
                        setLogs(prev => [...prev, { type: 'error', message: `Row ${i + 2}: Missing email address.` }]);
                        errorCount++;
                        continue;
                    }

                    try {
                        // Create user with secondary auth
                        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, "123456");
                        const uid = userCredential.user.uid;

                        // Add to Firestore
                        await setDoc(doc(db, "users", uid), {
                            email: email,
                            displayName: row['displayName'] || "",
                            role: (row['designation'] || "") === "Principal" ? "princi" :
                                (row['designation'] || "") === "Director" ? "dir" :
                                    (row['designation'] || "") === "Head of Department" ? "hod" : "staff",
                            salutation: row['salutation'] || "Mr.",
                            dateOfJoining: row['dateOfJoining'] || "",
                            appointmentNo: row['appointmentNo'] || "",
                            designation: row['designation'] || "",
                            department: row['department'] || "",
                            status: row['status'] || "Active",
                            createdAt: new Date().toISOString(),
                        });

                        // Sign out the secondary session immediately
                        await signOut(secondaryAuth);

                        successCount++;
                    } catch (err: any) {
                        if (err.code === 'auth/email-already-in-use') {
                            console.warn(`Skipping duplicate email: ${email}`);
                            setLogs(prev => [...prev, { type: 'error', message: `Row ${i + 2} (${email}): Email already exists.` }]);
                            dupCount++;
                        } else {
                            console.error(`Error registering ${email}:`, err);
                            setLogs(prev => [...prev, { type: 'error', message: `Row ${i + 2} (${email}): ${err.message}` }]);
                            errorCount++;
                        }
                    }

                    setProgress({ current: i + 1, total: jsonData.length });
                }

                setLogs(prev => [
                    { type: 'success', message: `Completed: ${successCount} registered successfully, ${dupCount} duplicates skipped, ${errorCount} errors.` },
                    ...prev
                ]);

                if (successCount > 0 || dupCount > 0) {
                    setImportedCount(successCount);
                    setDuplicatesCount(dupCount);
                    setShowSuccessPopup(true);
                    setTimeout(() => setShowSuccessPopup(false), 5000);
                }

            } catch (err: any) {
                console.error("File parsing error:", err);
                setLogs(prev => [...prev, { type: 'error', message: "Failed to parse Excel file." }]);
            } finally {
                setLoading(false);
            }
        };

        reader.readAsBinaryString(file);
    };

    return (
        <DashboardLayout allowedRole="admin">
            <div className="max-w-4xl mx-auto pb-10 relative">
                {showSuccessPopup && (
                    <div className={`fixed top-24 right-5 bg-white border shadow-xl rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-right-5 fade-in duration-300 z-50 max-w-sm ${duplicatesCount > 0 ? 'border-orange-100' : 'border-green-100'}`}>
                        <div className={`p-2 rounded-full ${duplicatesCount > 0 ? 'bg-orange-100' : 'bg-green-100'}`}>
                            {duplicatesCount > 0 ? <AlertCircle className="h-5 w-5 text-orange-600" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900">
                                {duplicatesCount > 0 ? 'Import Completed with Issues' : 'Import Successful'}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {importedCount} staff added.
                                {duplicatesCount > 0 && <span className="text-orange-600 block mt-0.5">{duplicatesCount} emails already existed (skipped).</span>}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowSuccessPopup(false)}
                            className="text-gray-400 hover:text-gray-500 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                <div className="mb-6 px-1">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Register Multiple Staffs</h1>
                    <p className="text-sm text-gray-500">Upload an Excel file to bulk register staff members.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-6">
                    <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-800">
                        <p className="font-semibold mb-2">Instructions:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Upload an .xlsx or .xls file.</li>
                            <li>The first row must contain these headers: <code className="bg-white px-1 py-0.5 rounded border border-blue-200">email</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200">displayName</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200">salutation</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200">dateOfJoining</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200">department</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200">designation</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200">appointmentNo</code>, <code className="bg-white px-1 py-0.5 rounded border border-blue-200">status</code>.</li>
                            <li>Default password for all new accounts will be <span className="font-mono font-bold">123456</span>.</li>
                        </ul>
                    </div>

                    <div className="flex flex-col items-center justify-center w-full">
                        <label className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${loading ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-300' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-10 h-10 mb-3 text-gray-400" />
                                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                <p className="text-xs text-gray-500">Excel files only (.xlsx, .xls)</p>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                disabled={loading}
                            />
                        </label>
                    </div>

                    {fileName && (
                        <div className="mt-4 p-4 bg-purple-50 text-purple-700 rounded-xl flex items-center justify-between border border-purple-100">
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet className="h-5 w-5" />
                                <span className="text-sm font-medium">{fileName}</span>
                            </div>
                            {loading && (
                                <span className="text-xs font-semibold bg-purple-200 px-2 py-1 rounded">
                                    Processing {progress.current}/{progress.total}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            onClick={handleUpload}
                            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!file || loading}
                        >
                            {loading ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Processing...
                                </>
                            ) : (
                                "Start Import"
                            )}
                        </button>
                    </div>
                </div>

                {logs.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Log</h3>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                            {logs.map((log, index) => (
                                <div key={index} className={`p-3 rounded-lg text-sm border flex items-start gap-3 ${log.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                    {log.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                                    <span>{log.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
