"use client";

import { useEffect, useState, use } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc } from "firebase/firestore";
import { format, startOfYear, endOfYear, startOfMonth, subDays, isAfter, differenceInMonths } from "date-fns";
import { ArrowLeft, User, Mail, Briefcase, Calendar, CheckCircle2, Clock, XCircle, FileText, CalendarClock, Plus, Trash2, GraduationCap, Edit } from "lucide-react";
import Link from "next/link";
import { LEAVE_LIMITS, LeaveType } from "@/lib/constants";

interface LeaveRequest {
    id: string;
    type: string;
    status: string;
    reason: string;
    description: string;
    fromDate: string;
    toDate: string;
    leaveValue: number;
    session: string;
    createdAt?: any;
    recommendedBy?: string;
    rejectedBy?: string;
}

const getCalculatedDuration = (fromDate: string, toDate: string, isCurrent: boolean) => {
    if (!fromDate) return '';
    const start = new Date(fromDate);
    const end = isCurrent ? new Date() : (toDate ? new Date(toDate) : new Date());
    const months = differenceInMonths(end, start);
    if (months < 0) return '';
    if (months < 12) {
        return `${months} month${months !== 1 ? 's' : ''}`;
    }
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
        return `${years} year${years !== 1 ? 's' : ''}`;
    }
    return `${years} yr${years !== 1 ? 's' : ''} ${remainingMonths} mo`;
};

export default function StaffDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [staff, setStaff] = useState<any>(null);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddingQual, setIsAddingQual] = useState(false);
    const [newQual, setNewQual] = useState({ degree: '', institution: '', year: '' });
    const [isAddingExp, setIsAddingExp] = useState(false);
    const [newExp, setNewExp] = useState({ role: '', roleType: '', company: '', companyType: '', duration: '', fromDate: '', toDate: '', isCurrent: false });
    const [editingQualIndex, setEditingQualIndex] = useState<number | null>(null);
    const [editingExpIndex, setEditingExpIndex] = useState<number | null>(null);
    const [updating, setUpdating] = useState(false);

    // Calculate balances
    const leaveBalances: Record<string, number> = {};
    const currentYear = new Date().getFullYear();
    const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
    const yearEnd = format(endOfYear(new Date()), "yyyy-MM-dd");

    const approvedYearLeaves = leaves.filter(l =>
        l.status === "Approved" &&
        l.fromDate >= yearStart &&
        l.fromDate <= yearEnd
    );

    Object.entries(LEAVE_LIMITS).forEach(([type, limit]) => {
        const used = approvedYearLeaves
            .filter(l => l.type === type)
            .reduce((sum, l) => sum + (l.leaveValue || 0), 0);
        const extra = type === "Casual Leave" ? (staff?.extraCasualLeaves || 0) : 0;
        leaveBalances[type] = Math.max(0, limit - (used + extra));
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Approved': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'Pending': return <Clock className="h-5 w-5 text-yellow-500" />;
            case 'Recommended': return <Clock className="h-5 w-5 text-blue-500" />;
            case 'Rejected': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <FileText className="h-5 w-5 text-gray-500" />;
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Approved': return 'bg-green-100 text-green-700 border-green-200';
            case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'Recommended': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Rejected': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    useEffect(() => {
        const fetchDetails = async () => {
            if (!db) return;
            try {
                // Fetch user doc
                const userDoc = await getDoc(doc(db, "users", resolvedParams.id));
                if (userDoc.exists()) {
                    setStaff(userDoc.data());
                } else {
                    setError("Staff member not found.");
                    setLoading(false);
                    return;
                }

                // Fetch leaves
                const leavesQuery = query(
                    collection(db, "leaves"),
                    where("userId", "==", resolvedParams.id)
                );
                const leavesSnap = await getDocs(leavesQuery);
                const leavesData = leavesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LeaveRequest[];

                // Sort leaves by date ascending
                leavesData.sort((a, b) => {
                    return new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime();
                });

                setLeaves(leavesData);
                setLoading(false);
            } catch (err: any) {
                console.error("Error fetching staff details:", err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchDetails();
    }, [resolvedParams.id]);

    const handleAddQualification = async () => {
        if (!newQual.degree || !newQual.institution) return;
        setUpdating(true);
        try {
            const updatedQuals = [...(staff.qualifications || [])];
            if (editingQualIndex !== null) {
                updatedQuals[editingQualIndex] = newQual;
            } else {
                updatedQuals.push(newQual);
            }
            await updateDoc(doc(db, "users", resolvedParams.id), { qualifications: updatedQuals });
            setStaff({ ...staff, qualifications: updatedQuals });
            setNewQual({ degree: '', institution: '', year: '' });
            setIsAddingQual(false);
            setEditingQualIndex(null);
        } catch (err) {
            console.error("Error adding/editing qualification", err);
        }
        setUpdating(false);
    };

    const handleEditQualification = (index: number) => {
        setEditingQualIndex(index);
        setNewQual(staff.qualifications[index]);
        setIsAddingQual(true);
    };

    const handleDeleteQualification = async (index: number) => {
        if (!confirm("Are you sure you want to delete this qualification?")) return;
        setUpdating(true);
        try {
            const updatedQuals = staff.qualifications.filter((_: any, i: number) => i !== index);
            await updateDoc(doc(db, "users", resolvedParams.id), { qualifications: updatedQuals });
            setStaff({ ...staff, qualifications: updatedQuals });
        } catch (err) {
            console.error("Error deleting qualification", err);
        }
        setUpdating(false);
    };

    const handleAddExperience = async () => {
        if (!newExp.role || !newExp.company) return;
        const hasDuration = !!newExp.duration;
        const hasDates = !!newExp.fromDate && (!!newExp.toDate || newExp.isCurrent);
        if (!hasDuration && !hasDates) {
            alert("Please provide either a Duration or From/To dates.");
            return;
        }
        setUpdating(true);
        try {
            const updatedExps = [...(staff.experiences || [])];
            if (editingExpIndex !== null) {
                updatedExps[editingExpIndex] = newExp;
            } else {
                updatedExps.push(newExp);
            }
            await updateDoc(doc(db, "users", resolvedParams.id), { experiences: updatedExps });
            setStaff({ ...staff, experiences: updatedExps });
            setNewExp({ role: '', roleType: '', company: '', companyType: '', duration: '', fromDate: '', toDate: '', isCurrent: false });
            setIsAddingExp(false);
            setEditingExpIndex(null);
        } catch (err) {
            console.error("Error adding/editing experience", err);
        }
        setUpdating(false);
    };

    const handleEditExperience = (index: number) => {
        setEditingExpIndex(index);
        const comp = staff.experiences[index].company || '';
        const cType = comp === 'Carmel College of Engineering' ? 'carmel' : (comp === '' ? '' : 'other');
        const rl = staff.experiences[index].role || '';
        const knownRoles = [
            'Professor & HOD', 'Professor', 'Associate Professor & HOD', 'Associate Professor',
            'Assistant Professor & HOD', 'Assistant Professor', 'Lab Instructor',
            'System Administrator', 'Network Administrator', 'Administrative Staff'
        ];
        const rType = knownRoles.includes(rl) ? rl : (rl === '' ? '' : 'other');
        setNewExp({
            role: rl,
            roleType: rType,
            company: comp,
            companyType: cType,
            duration: staff.experiences[index].duration || '',
            fromDate: staff.experiences[index].fromDate || '',
            toDate: staff.experiences[index].toDate || '',
            isCurrent: staff.experiences[index].isCurrent || false,
        });
        setIsAddingExp(true);
    };

    const handleDeleteExperience = async (index: number) => {
        if (!confirm("Are you sure you want to delete this experience?")) return;
        setUpdating(true);
        try {
            const updatedExps = staff.experiences.filter((_: any, i: number) => i !== index);
            await updateDoc(doc(db, "users", resolvedParams.id), { experiences: updatedExps });
            setStaff({ ...staff, experiences: updatedExps });
        } catch (err) {
            console.error("Error deleting experience", err);
        }
        setUpdating(false);
    };

    if (loading) {
        return (
            <DashboardLayout allowedRole="admin">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-gray-400">Loading staff history...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !staff) {
        return (
            <DashboardLayout allowedRole="admin">
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <div className="text-red-500">{error || "Staff member not found"}</div>
                    <Link href="/admin/staffs" className="text-blue-600 hover:underline">
                        Return to Staff List
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout allowedRole="admin">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin/staffs" className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Staff Details</h1>
                        <p className="text-sm text-gray-500">View information and leave history</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left Column: Staff Info */}
                    <div className="space-y-6">
                        {/* Profile Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold uppercase shrink-0">
                                    {staff.displayName?.[0] || staff.email?.[0]}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">{staff.salutation} {staff.displayName}</h2>
                                    <p className="text-sm text-gray-500">{staff.designation}</p>
                                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold uppercase rounded-full ${staff.role === 'princi' ? 'bg-purple-100 text-purple-700' :
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

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                                    <span className="truncate">{staff.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Briefcase className="h-4 w-4 text-gray-400 shrink-0" />
                                    <span>{staff.department || "No Department"}</span>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Right Column: Leave Balances */}
                    <div className="space-y-6">
                        {/* Leave Balances Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CalendarClock className="h-5 w-5 text-gray-500" />
                                    <h3 className="font-semibold text-gray-900">Leave Balances</h3>
                                </div>
                                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                                    {currentYear}
                                </span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Object.entries(leaveBalances).map(([type, remaining]) => (
                                        <div key={type} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                            <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 line-clamp-1" title={type}>
                                                {type}
                                            </p>
                                            <div className="flex items-baseline gap-2">
                                                <span className={`text-xl sm:text-2xl font-bold ${remaining === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {remaining}
                                                </span>
                                                <span className="text-xs text-gray-400">/ {LEAVE_LIMITS[type as LeaveType]}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Qualifications & Experience Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Qualifications */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <GraduationCap className="h-5 w-5 text-gray-500" />
                                <h3 className="font-semibold text-gray-900">Qualifications</h3>
                            </div>
                            <button
                                onClick={() => {
                                    setIsAddingQual(!isAddingQual);
                                    if (isAddingQual) {
                                        setEditingQualIndex(null);
                                        setNewQual({ degree: '', institution: '', year: '' });
                                    }
                                }}
                                className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full border border-blue-100 transition-colors flex items-center gap-1"
                            >
                                <Plus className="h-3.5 w-3.5" /> {isAddingQual ? 'Cancel' : 'Add'}
                            </button>
                        </div>
                        <div className="p-4 flex-1">
                            {isAddingQual && (
                                <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Degree / Certificate</label>
                                        <input
                                            type="text"
                                            placeholder="Degree/Certificate"
                                            value={newQual.degree}
                                            onChange={(e) => setNewQual({ ...newQual, degree: e.target.value })}
                                            className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Institution / University</label>
                                        <input
                                            type="text"
                                            placeholder="Institution/University"
                                            value={newQual.institution}
                                            onChange={(e) => setNewQual({ ...newQual, institution: e.target.value })}
                                            className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                                            <input
                                                type="text"
                                                placeholder="Year"
                                                value={newQual.year}
                                                onChange={(e) => setNewQual({ ...newQual, year: e.target.value })}
                                                className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={handleAddQualification}
                                            disabled={updating || !newQual.degree || !newQual.institution}
                                            className="px-4 py-2 h-[38px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {editingQualIndex !== null ? 'Update' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3">
                                {(!staff.qualifications || staff.qualifications.length === 0) && !isAddingQual && (
                                    <p className="text-sm text-gray-500 italic text-center py-4">No qualifications added yet.</p>
                                )}
                                {(staff.qualifications || [])
                                    .map((qual: any, idx: number) => ({ ...qual, originalIndex: idx }))
                                    .sort((a: any, b: any) => {
                                        const getYear = (q: any) => Number(q.year || (q.isCurrent ? new Date().getFullYear() : (q.toDate?.split('-')[0] || q.fromDate?.split('-')[0] || 0)));
                                        return getYear(b) - getYear(a);
                                    })
                                    .map((qual: any) => {
                                        const idx = qual.originalIndex;
                                        return (
                                            <div key={idx} className="flex items-start justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">
                                                        {qual.degree}
                                                        {qual.isCurrent && <span className="font-normal italic text-gray-500 ml-1">(Pursuing)</span>}
                                                    </p>
                                                    <p className="text-xs text-black mt-0.5">{qual.institution}</p>
                                                    {qual.type === 'Other' ? (
                                                        <p className="text-xs text-black mt-0.5">Year: {qual.fromDate?.split('-')[0] || ''} - {qual.isCurrent ? 'Pursuing' : (qual.toDate?.split('-')[0] || '')}</p>
                                                    ) : (
                                                        <p className="text-xs text-black mt-0.5">Year: {qual.year}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEditQualification(idx)}
                                                        disabled={updating}
                                                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteQualification(idx)}
                                                        disabled={updating}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>

                    {/* Experiences */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-gray-500" />
                                <h3 className="font-semibold text-gray-900">Experience</h3>
                            </div>
                            <button
                                onClick={() => {
                                    setIsAddingExp(!isAddingExp);
                                    if (isAddingExp) {
                                        setEditingExpIndex(null);
                                        setNewExp({ role: '', roleType: '', company: '', companyType: '', duration: '', fromDate: '', toDate: '', isCurrent: false });
                                    }
                                }}
                                className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full border border-blue-100 transition-colors flex items-center gap-1"
                            >
                                <Plus className="h-3.5 w-3.5" /> {isAddingExp ? 'Cancel' : 'Add'}
                            </button>
                        </div>
                        <div className="p-4 flex-1">
                            {isAddingExp && (
                                <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Role / Designation</label>
                                        <select
                                            value={newExp.roleType}
                                            onChange={(e) => {
                                                const type = e.target.value;
                                                setNewExp({ 
                                                    ...newExp, 
                                                    roleType: type, 
                                                    role: type === 'other' || type === '' ? '' : type 
                                                });
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
                                    {newExp.roleType === 'other' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Other Role / Designation</label>
                                            <input
                                                type="text"
                                                placeholder="Enter Role/Designation"
                                                value={newExp.role}
                                                onChange={(e) => setNewExp({ ...newExp, role: e.target.value })}
                                                className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Company / Organization</label>
                                        <select
                                            value={newExp.companyType}
                                            onChange={(e) => {
                                                const type = e.target.value;
                                                setNewExp({ 
                                                    ...newExp, 
                                                    companyType: type, 
                                                    company: type === 'carmel' ? 'Carmel College of Engineering' : '' 
                                                });
                                            }}
                                            className="w-full text-sm text-gray-900 bg-white border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="" disabled hidden>Company / Organization</option>
                                            <option value="carmel">Carmel College of Engineering</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    {newExp.companyType === 'other' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Other Company Name</label>
                                            <input
                                                type="text"
                                                placeholder="Enter Company/Organization Name"
                                                value={newExp.company}
                                                onChange={(e) => setNewExp({ ...newExp, company: e.target.value })}
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
                                                value={newExp.fromDate}
                                                onChange={(e) => setNewExp({ ...newExp, fromDate: e.target.value, duration: '' })}
                                                disabled={!!newExp.duration}
                                                className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                            />
                                            <div className="flex flex-col gap-1">
                                                <input
                                                    type="date"
                                                    placeholder="To Date"
                                                    value={newExp.toDate}
                                                    onChange={(e) => setNewExp({ ...newExp, toDate: e.target.value, duration: '' })}
                                                    disabled={!!newExp.duration || newExp.isCurrent}
                                                    className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                                />
                                                <label className="flex items-center gap-1 text-xs text-gray-600 mt-1 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={newExp.isCurrent}
                                                        onChange={(e) => setNewExp({ ...newExp, isCurrent: e.target.checked, toDate: e.target.checked ? '' : newExp.toDate, duration: '' })}
                                                        disabled={!!newExp.duration}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    Present
                                                </label>
                                            </div>
                                        </div>
                                        
                                        <div className="text-center text-xs text-gray-400 font-semibold">OR</div>
                                        
                                        <input
                                            type="text"
                                            placeholder="Duration (e.g., 2 Years)"
                                            value={newExp.duration}
                                            onChange={(e) => setNewExp({ ...newExp, duration: e.target.value, fromDate: '', toDate: '', isCurrent: false })}
                                            disabled={!!newExp.fromDate}
                                            className="w-full text-sm text-gray-900 bg-white placeholder-gray-400 border-gray-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                        />
                                        <button
                                            onClick={handleAddExperience}
                                            disabled={updating || !newExp.role || !newExp.company}
                                            className="mt-2 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {editingExpIndex !== null ? 'Update' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3">
                                {(!staff.experiences || staff.experiences.length === 0) && !isAddingExp && (
                                    <p className="text-sm text-gray-500 italic text-center py-4">No experience added yet.</p>
                                )}
                                {(staff.experiences || [])
                                    .map((exp: any, idx: number) => ({ ...exp, originalIndex: idx }))
                                    .sort((a: any, b: any) => {
                                        if (a.fromDate && b.fromDate) {
                                            return new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime();
                                        }
                                        if (a.fromDate) return -1;
                                        if (b.fromDate) return 1;
                                        return 0;
                                    })
                                    .map((exp: any) => {
                                        const idx = exp.originalIndex;
                                        return (
                                            <div key={idx} className="flex items-start justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">{exp.role}</p>
                                                    <p className="text-xs text-black mt-0.5">{exp.company}</p>
                                                    <p className="text-xs text-black mt-0.5">
                                                        {exp.duration ? (
                                                            `Duration: ${exp.duration}`
                                                        ) : (
                                                            `Period: ${exp.fromDate ? format(new Date(exp.fromDate), 'MMM yyyy') : ''} - ${exp.isCurrent ? 'Present' : (exp.toDate ? format(new Date(exp.toDate), 'MMM yyyy') : '')} (${getCalculatedDuration(exp.fromDate, exp.toDate, exp.isCurrent)})`
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEditExperience(idx)}
                                                        disabled={updating}
                                                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteExperience(idx)}
                                                        disabled={updating}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Leave History */}
                <div>
                    {/* Mobile View: Cards */}
                    <div className="grid grid-cols-1 gap-4 lg:hidden">
                        {leaves.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 italic bg-white rounded-xl border border-gray-100">
                                No leave requests found.
                            </div>
                        ) : (
                            leaves.map((leave) => (
                                <div key={leave.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{leave.type}</h3>
                                            <p className="text-xs text-gray-500">{leave.session}</p>
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(leave.status)}`}>
                                            {leave.status === "Recommended" ? (leave.recommendedBy ? `${leave.recommendedBy} Recommended` : "Recommended") :
                                             leave.status === "Rejected" ? (leave.rejectedBy ? `${leave.rejectedBy} Rejected` : "Rejected") : leave.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <p className="line-clamp-2">{leave.reason}</p>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                        <span className="text-xs text-gray-400">
                                            {leave.fromDate && format(new Date(leave.fromDate), "MMM dd")} - {leave.toDate && format(new Date(leave.toDate), "MMM dd")}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-semibold text-blue-600 uppercase">
                                                {leave.leaveValue} Day(s)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                            <h3 className="font-semibold text-gray-900 text-lg">Leave History</h3>
                            <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                                Total: {leaves.length}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date(s)</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {leaves.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic py-16">No leave requests found.</td></tr>
                                    ) : (
                                        leaves.map((leave) => (
                                            <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="font-medium text-gray-900">{leave.type}</span>
                                                    <div className="text-xs text-gray-500">{leave.session}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    {leave.leaveValue} Day(s)
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {leave.fromDate && format(new Date(leave.fromDate), "MMM dd, yyyy")}
                                                    {leave.toDate && leave.toDate !== leave.fromDate && ` - ${format(new Date(leave.toDate), "MMM dd, yyyy")}`}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                                    {leave.reason}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(leave.status)}`}>
                                                        {leave.status === "Recommended" ? (leave.recommendedBy ? `${leave.recommendedBy} Recommended` : "Recommended") :
                                                         leave.status === "Rejected" ? (leave.rejectedBy ? `${leave.rejectedBy} Rejected` : "Rejected") : leave.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout >
    );
}
