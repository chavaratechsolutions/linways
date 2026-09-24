"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ArrowLeft, GraduationCap, Briefcase, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const calculateDuration = (from: string, to: string, isCurrent: boolean): string => {
    if (!from) return '';
    const startDate = new Date(from);
    if (isNaN(startDate.getTime())) return '';
    
    const endDate = isCurrent ? new Date() : (to ? new Date(to) : null);
    if (!endDate || isNaN(endDate.getTime())) return '';

    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    months -= startDate.getMonth();
    months += endDate.getMonth();
    
    if (endDate.getDate() < startDate.getDate()) {
        months--;
    }
    
    if (months < 0) return '';
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0 && remainingMonths === 0) {
        return 'Less than 1 Month';
    }

    const parts = [];
    if (years > 0) parts.push(`${years} Year${years > 1 ? 's' : ''}`);
    if (remainingMonths > 0) parts.push(`${remainingMonths} Month${remainingMonths > 1 ? 's' : ''}`);
    
    return parts.join(' ');
};

export default function CompleteProfilePage() {
    const { user, role, userData: staff } = useAuth();
    const router = useRouter();

    const [quals, setQuals] = useState<any[]>([
        { type: 'UG / DIPLOMA', degree: '', institution: '', year: '', duration: '', fromDate: '', toDate: '', isCurrent: false },
        { type: 'PG', degree: '', institution: '', year: '', duration: '', fromDate: '', toDate: '', isCurrent: false }
    ]);
    const [exps, setExps] = useState<any[]>([
        { role: '', roleType: '', company: '', companyType: '', duration: '', fromDate: '', toDate: '', isCurrent: false }
    ]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (staff && !isLoaded) {
            if (staff.qualifications && staff.qualifications.length > 0) {
                setQuals(staff.qualifications);
            }
            if (staff.experiences && staff.experiences.length > 0) {
                setExps(staff.experiences);
            }
            setIsLoaded(true);
        }
    }, [staff, isLoaded]);
    const [updating, setUpdating] = useState(false);

    let dashboardHref = "/";
    if (role === "admin") dashboardHref = "/admin";
    else if (role === "dir") dashboardHref = "/director";
    else if (role === "princi") dashboardHref = "/principal";
    else if (role === "hod") dashboardHref = "/hod";
    else dashboardHref = "/staff";

    const handleSaveProfile = async () => {
        if (!user?.uid) return;
        setUpdating(true);
        try {
            const updatedData: any = {};
            const updatedQuals: any[] = [];
            quals.forEach(q => {
                if (q.degree && q.institution) {
                    updatedQuals.push(q);
                }
            });
            if (updatedQuals.length > 0) {
                updatedData.qualifications = updatedQuals;
            }

            const updatedExps: any[] = [];
            exps.forEach(exp => {
                const hasDuration = !!exp.duration;
                const hasDates = !!exp.fromDate && (!!exp.toDate || exp.isCurrent);
                if (exp.role && exp.company && (hasDuration || hasDates)) {
                    updatedExps.push(exp);
                }
            });
            if (updatedExps.length > 0) {
                updatedData.experiences = updatedExps;
            }

            if (Object.keys(updatedData).length > 0) {
                await updateDoc(doc(db, "users", user.uid), updatedData);
            }

            router.push(dashboardHref);
        } catch (err) {
            console.error("Error saving profile", err);
            alert("Error saving profile");
        }
        setUpdating(false);
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={dashboardHref} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
                        <p className="text-sm text-gray-500">Please add your qualifications and experience details to continue.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Qualifications */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-gray-500" />
                            <h3 className="font-semibold text-gray-900">Qualifications</h3>
                        </div>
                        <div className="p-4 flex-1">
                            {quals.map((qual, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3 mb-3 relative">
                                    {qual.type !== 'UG / DIPLOMA' && qual.type !== 'PG' && (
                                        <button
                                            onClick={() => {
                                                const newQuals = [...quals];
                                                newQuals.splice(idx, 1);
                                                setQuals(newQuals);
                                            }}
                                            className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-lg"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                    <h4 className="text-sm font-semibold text-gray-700">{qual.type === 'Other' ? 'Additional Qualification' : qual.type}</h4>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Degree / Certificate</label>
                                        <input
                                            type="text"
                                            placeholder={qual.type === 'UG / DIPLOMA' ? "e.g. B.Tech" : qual.type === 'PG' ? "e.g. M.Tech" : "Degree/Certificate"}
                                            value={qual.degree}
                                            onChange={(e) => {
                                                const newQuals = [...quals];
                                                newQuals[idx].degree = e.target.value;
                                                setQuals(newQuals);
                                            }}
                                            className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Institution / University</label>
                                        <input
                                            type="text"
                                            placeholder="Institution/University"
                                            value={qual.institution}
                                            onChange={(e) => {
                                                const newQuals = [...quals];
                                                newQuals[idx].institution = e.target.value;
                                                setQuals(newQuals);
                                            }}
                                            className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    {qual.type === 'Other' ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 my-1">
                                                <div className="h-px bg-gray-200 flex-1"></div>
                                                <span className="text-xs text-gray-500 font-medium">Duration Options (Choose one)</span>
                                                <div className="h-px bg-gray-200 flex-1"></div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="date"
                                                    placeholder="From Date"
                                                    value={qual.fromDate || ''}
                                                    onChange={(e) => {
                                                        const newQuals = [...quals];
                                                        const newFrom = e.target.value;
                                                        newQuals[idx] = { 
                                                            ...newQuals[idx], 
                                                            fromDate: newFrom, 
                                                            duration: calculateDuration(newFrom, newQuals[idx].toDate || '', newQuals[idx].isCurrent || false) 
                                                        };
                                                        setQuals(newQuals);
                                                    }}
                                                    className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <input
                                                        type="date"
                                                        placeholder="To Date"
                                                        value={qual.toDate || ''}
                                                        onChange={(e) => {
                                                            const newQuals = [...quals];
                                                            const newTo = e.target.value;
                                                            newQuals[idx] = { 
                                                                ...newQuals[idx], 
                                                                toDate: newTo, 
                                                                duration: calculateDuration(newQuals[idx].fromDate || '', newTo, newQuals[idx].isCurrent || false) 
                                                            };
                                                            setQuals(newQuals);
                                                        }}
                                                        disabled={qual.isCurrent}
                                                        className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                                    />
                                                    <label className="flex items-center gap-1 text-xs text-gray-600 mt-1 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={qual.isCurrent || false}
                                                            onChange={(e) => {
                                                                const newQuals = [...quals];
                                                                const newIsCurrent = e.target.checked;
                                                                newQuals[idx] = {
                                                                    ...newQuals[idx],
                                                                    isCurrent: newIsCurrent,
                                                                    toDate: newIsCurrent ? '' : newQuals[idx].toDate,
                                                                    duration: calculateDuration(newQuals[idx].fromDate || '', newIsCurrent ? '' : newQuals[idx].toDate || '', newIsCurrent)
                                                                };
                                                                setQuals(newQuals);
                                                            }}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        Pursuing
                                                    </label>
                                                </div>
                                            </div>

                                            {qual.duration && (
                                                <div className="text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded-lg text-center">
                                                    Duration: {qual.duration}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                                            <input
                                                type="text"
                                                placeholder="Year"
                                                value={qual.year}
                                                onChange={(e) => {
                                                    const newQuals = [...quals];
                                                    newQuals[idx].year = e.target.value;
                                                    setQuals(newQuals);
                                                }}
                                                className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={() => setQuals([...quals, { type: 'Other', degree: '', institution: '', year: '', duration: '', fromDate: '', toDate: '', isCurrent: false }])}
                                className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="h-4 w-4" /> Add Another Qualification
                            </button>
                        </div>
                    </div>

                    {/* Experience */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-gray-500" />
                            <h3 className="font-semibold text-gray-900">Experience</h3>
                        </div>
                        <div className="p-4 flex-1">
                            {exps.map((exp, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3 mb-3 relative">
                                    {exps.length > 1 && (
                                        <button
                                            onClick={() => {
                                                const newExps = [...exps];
                                                newExps.splice(idx, 1);
                                                setExps(newExps);
                                            }}
                                            className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-lg z-10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                    <h4 className="text-sm font-semibold text-gray-700">Experience {idx + 1}</h4>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Role / Designation</label>
                                        <select
                                            value={exp.roleType}
                                            onChange={(e) => {
                                                const type = e.target.value;
                                                const newExps = [...exps];
                                                newExps[idx] = {
                                                    ...newExps[idx],
                                                    roleType: type,
                                                    role: type === 'other' || type === '' ? '' : type
                                                };
                                                setExps(newExps);
                                            }}
                                            className="w-full text-sm text-gray-900 bg-white border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="" disabled hidden>Select Role / Designation</option>
                                            <option value="Professor & HOD">Professor & HOD</option>
                                            <option value="Professor">Professor</option>
                                            <option value="Associate Professor & HOD">Associate Professor & HOD</option>
                                            <option value="Associate Professor">Associate Professor</option>
                                            <option value="Assistant Professor & HOD">Assistant Professor & HOD</option>
                                            <option value="Assistant Professor">Assistant Professor</option>
                                            <option value="Lab Instructor">Lab Instructor</option>
                                            <option value="System Administrator">System Administrator</option>
                                            <option value="Network Administrator">Network Administrator</option>
                                            <option value="Administrative Staff">Administrative Staff</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    {exp.roleType === 'other' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Other Role / Designation</label>
                                            <input
                                                type="text"
                                                placeholder="Enter Role/Designation"
                                                value={exp.role}
                                                onChange={(e) => {
                                                    const newExps = [...exps];
                                                    newExps[idx].role = e.target.value;
                                                    setExps(newExps);
                                                }}
                                                className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Company / Organization</label>
                                        <select
                                            value={exp.companyType}
                                            onChange={(e) => {
                                                const type = e.target.value;
                                                const newExps = [...exps];
                                                const isCarmel = type === 'carmel';
                                                newExps[idx] = {
                                                    ...newExps[idx],
                                                    companyType: type,
                                                    company: isCarmel ? 'Carmel College of Engineering & Technology' : '',
                                                    ...(isCarmel ? { isCurrent: true, toDate: '', duration: '' } : {})
                                                };
                                                setExps(newExps);
                                            }}
                                            className="w-full text-sm text-gray-900 bg-white border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="" disabled hidden>Company / Organization</option>
                                            <option value="carmel">Carmel College of Engineering & Technology</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    {exp.companyType === 'other' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Other Company Name</label>
                                            <input
                                                type="text"
                                                placeholder="Enter Company/Organization Name"
                                                value={exp.company}
                                                onChange={(e) => {
                                                    const newExps = [...exps];
                                                    newExps[idx].company = e.target.value;
                                                    setExps(newExps);
                                                }}
                                                className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 my-1">
                                            <div className="h-px bg-gray-200 flex-1"></div>
                                            <span className="text-xs text-gray-500 font-medium">Duration Options (Choose one)</span>
                                            <div className="h-px bg-gray-200 flex-1"></div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="date"
                                                placeholder="From Date"
                                                value={exp.fromDate}
                                                onChange={(e) => {
                                                    const newExps = [...exps];
                                                    const newFrom = e.target.value;
                                                    newExps[idx] = { 
                                                        ...newExps[idx], 
                                                        fromDate: newFrom, 
                                                        duration: calculateDuration(newFrom, newExps[idx].toDate || '', newExps[idx].isCurrent || false) 
                                                    };
                                                    setExps(newExps);
                                                }}
                                                className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                            />
                                            <div className="flex flex-col gap-1">
                                                <input
                                                    type="date"
                                                    placeholder="To Date"
                                                    value={exp.toDate}
                                                    onChange={(e) => {
                                                        const newExps = [...exps];
                                                        const newTo = e.target.value;
                                                        newExps[idx] = { 
                                                            ...newExps[idx], 
                                                            toDate: newTo, 
                                                            duration: calculateDuration(newExps[idx].fromDate || '', newTo, newExps[idx].isCurrent || false) 
                                                        };
                                                        setExps(newExps);
                                                    }}
                                                    disabled={exp.isCurrent}
                                                    className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                                />
                                                <label className="flex items-center gap-1 text-xs text-gray-600 mt-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={exp.isCurrent}
                                                        onChange={(e) => {
                                                            const newExps = [...exps];
                                                            const newIsCurrent = e.target.checked;
                                                            newExps[idx] = {
                                                                ...newExps[idx],
                                                                isCurrent: newIsCurrent,
                                                                toDate: newIsCurrent ? '' : newExps[idx].toDate,
                                                                duration: calculateDuration(newExps[idx].fromDate || '', newIsCurrent ? '' : newExps[idx].toDate || '', newIsCurrent)
                                                            };
                                                            setExps(newExps);
                                                        }}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    Present
                                                </label>
                                            </div>
                                        </div>

                                        {exp.duration && (
                                            <div className="text-sm font-medium text-blue-600 bg-blue-50 p-2 rounded-lg text-center">
                                                Duration: {exp.duration}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => setExps([...exps, { role: '', roleType: '', company: '', companyType: '', duration: '', fromDate: '', toDate: '', isCurrent: false }])}
                                className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="h-4 w-4" /> Add Another Experience
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSaveProfile}
                        disabled={updating}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {updating ? 'Saving...' : 'Save Profile & Continue'}
                    </button>
                </div>
            </div>
        </DashboardLayout>
    );
}
