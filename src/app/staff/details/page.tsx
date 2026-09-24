"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
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

export default function MyProfileDetailsPage() {
    const { user, role } = useAuth();
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
            if (!db || !user?.uid) return;
            try {
                // Fetch user doc
                const userDoc = await getDoc(doc(db, "users", user?.uid as string));
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
                    where("userId", "==", user?.uid)
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
    }, [user?.uid]);

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
            await updateDoc(doc(db, "users", user?.uid as string), { qualifications: updatedQuals });
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
            await updateDoc(doc(db, "users", user?.uid as string), { qualifications: updatedQuals });
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
            await updateDoc(doc(db, "users", user?.uid as string), { experiences: updatedExps });
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
            await updateDoc(doc(db, "users", user?.uid as string), { experiences: updatedExps });
            setStaff({ ...staff, experiences: updatedExps });
        } catch (err) {
            console.error("Error deleting experience", err);
        }
        setUpdating(false);
    };

    if (loading) {
        return (
            <DashboardLayout >
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-gray-400">Loading your profile...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !staff) {
        return (
            <DashboardLayout >
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <div className="text-red-500">{error || "Profile not found"}</div>
                </div>
            </DashboardLayout>
        );
    }

    let dashboardHref = "/";
    if (role === "admin") dashboardHref = "/admin";
    else if (role === "dir") dashboardHref = "/director";
    else if (role === "princi") dashboardHref = "/principal";
    else if (role === "hod") dashboardHref = "/hod";
    else dashboardHref = "/staff";

    return (
        <DashboardLayout >
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={dashboardHref} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                        <p className="text-sm text-gray-500">View your information and leave history</p>
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
                            <Link 
                                href="/staff/complete-profile"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                            >
                                <Edit className="h-3.5 w-3.5" />
                                Edit / Add
                            </Link>

                            
                        </div>
                        <div className="p-4 flex-1">
                            <div className="space-y-3">
                                {(!staff.qualifications || staff.qualifications.length === 0) && (
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
                            <Link 
                                href="/staff/complete-profile"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                            >
                                <Edit className="h-3.5 w-3.5" />
                                Edit / Add
                            </Link>

                            
                        </div>
                        <div className="p-4 flex-1">
                            <div className="space-y-3">
                                {(!staff.experiences || staff.experiences.length === 0) && (
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
