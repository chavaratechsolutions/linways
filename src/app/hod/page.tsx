"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { Users, ClipboardList, Clock, CheckCircle, Calendar, UserPlus, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { LEAVE_LIMITS, LeaveType } from "@/lib/constants";
import { format } from "date-fns";

export default function HodDashboard() {
    const { user, userData } = useAuth();
    const [stats, setStats] = useState({
        totalStaff: 0,
        pendingLeaves: 0,
        approvedLeaves: 0,
        totalRequests: 0,
    });
    const [loading, setLoading] = useState(true);
    const [myLeaves, setMyLeaves] = useState<any[]>([]);
    const [compLeaveInfo, setCompLeaveInfo] = useState<{ granted: number; minGrantSeconds: number }>({ granted: 0, minGrantSeconds: Infinity });

    useEffect(() => {
        if (!db || !user || !userData?.department) return;

        let unsubscribeLeaves: (() => void) | undefined;

        // 1. Fetch Staff in My Department
        const staffQ = query(
            collection(db, "users"),
            where("role", "==", "staff"),
            where("department", "==", userData.department)
        );

        const unsubscribeStaff = onSnapshot(staffQ, (staffSnapshot) => {
            const staffIds = staffSnapshot.docs.map(doc => doc.id);

            // Update Staff Count
            setStats(prev => ({
                ...prev,
                totalStaff: staffSnapshot.size
            }));

            // Clean up previous leaves listener if it exists
            if (unsubscribeLeaves) {
                unsubscribeLeaves();
            }

            // 2. Fetch All Leaves and Filter by Staff IDs
            const leavesQ = query(collection(db, "leaves"));
            unsubscribeLeaves = onSnapshot(leavesQ, (leaveSnapshot) => {
                if (leaveSnapshot.metadata.fromCache && leaveSnapshot.empty) {
                    return; // Ignore empty cache
                }
                const allLeaves = leaveSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

                // Filter leaves to only those from staff in my department
                const deptLeaves = allLeaves.filter(l => staffIds.includes(l.userId));

                setStats(prev => ({
                    ...prev,
                    totalRequests: deptLeaves.length,
                    pendingLeaves: deptLeaves.filter(l => l.status === "Pending").length,
                    approvedLeaves: deptLeaves.filter(l => l.status === "Approved").length,
                }));
                setLoading(false);
            });
        });

        // Fetch My Leaves (Personal View)
        const myQ = query(collection(db, "leaves"), where("userId", "==", user.uid));
        const unsubscribeMy = onSnapshot(myQ, (snapshot) => {
            const leaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            leaves.sort((a: any, b: any) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });
            setMyLeaves(leaves);
        });

        return () => {
            unsubscribeStaff();
            if (unsubscribeLeaves) unsubscribeLeaves();
            unsubscribeMy();
        };
    }, [user, userData]);

    // Fetch HOD's own comp leave granted balance
    useEffect(() => {
        if (!user || !db) return;

        const fetchCompLeave = async () => {
            try {
                const COMP_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000;
                const now = Date.now();
                const q = query(
                    collection(db, "compLeaveGrants"),
                    where("staffId", "==", user.uid),
                    where("status", "==", "Approved")
                );
                const snap = await getDocs(q);
                const validDocs = snap.docs.filter(d => {
                    const data = d.data();
                    const workDateMs = data.date ? new Date(data.date).getTime() : (data.createdAt?.seconds ?? 0) * 1000;
                    return (workDateMs + COMP_VALIDITY_MS) >= now;
                });
                const total = validDocs.reduce((sum, d) => sum + (d.data().grantedDays || 0), 0);
                const minGrantSeconds = validDocs.length > 0
                    ? Math.min(...validDocs.map(d => {
                        const data = d.data();
                        return data.date ? new Date(data.date).getTime() / 1000 : (data.createdAt?.seconds ?? Infinity);
                    }))
                    : Infinity;
                setCompLeaveInfo({ granted: total, minGrantSeconds });
            } catch (err) {
                console.error("Failed to fetch comp leave grants:", err);
            }
        };

        fetchCompLeave();
    }, [user]);


    const statCards = [
        { name: "Total Staff", value: loading ? "..." : stats.totalStaff, icon: Users, color: "text-purple-600", bg: "bg-purple-100", href: "/hod/staffs" },
        { name: "Pending", value: loading ? "..." : stats.pendingLeaves, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100", href: "/hod/requests?status=Pending" },
        { name: "Approved", value: loading ? "..." : stats.approvedLeaves, icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", href: "/hod/requests?status=Approved" },
        { name: "Total Requests", value: loading ? "..." : stats.totalRequests, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-100", href: "/hod/requests?status=All" },
    ];

    return (
        <DashboardLayout allowedRole="hod">
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">HOD Dashboard</h1>
                    <p className="text-sm text-gray-500">Welcome to the HR Management System HOD portal.</p>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6">
                    {statCards.map((stat) => (
                        <Link href={stat.href} key={stat.name} className="flex flex-col md:flex-row items-center rounded-xl bg-white p-4 md:p-6 shadow-sm border border-gray-100 gap-2 md:gap-4 hover:shadow-md transition-shadow cursor-pointer">
                            <div className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg shrink-0 ${stat.bg} ${stat.color}`}>
                                <stat.icon className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <div className="text-center md:text-left overflow-hidden w-full">
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase tracking-tight truncate">{stat.name}</p>
                                <p className="text-lg md:text-2xl font-bold text-gray-900 leading-tight">{stat.value}</p>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Leave Balances Section */}
                <div className="rounded-xl bg-white p-4 md:p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Leave Balances (Used / Total)</h2>
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4">
                        <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 leading-snug">
                            Leave days are deducted as soon as you apply. They are <span className="font-semibold">only restored</span> if your request is <span className="font-semibold">rejected</span> by the HOD, Principal, or Director — or if you <span className="font-semibold">cancel</span> the request before it is recommended by the HOD.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {Object.entries(LEAVE_LIMITS)
                            .filter(([type]) => {
                                if (type === "Maternity Leave" && userData?.gender !== "Female") return false;
                                return true;
                            })
                            .map(([type, limit]) => {
                            const currentYear = new Date().getFullYear();
                            const used = myLeaves
                                .filter(l => {
                                    if (l.type !== type || l.status === 'Rejected') return false;
                                    if (l.fromDate && new Date(l.fromDate).getFullYear() !== currentYear) return false;
                                    if (type === "Compensatory Leave") {
                                        const createdSec = l.createdAt?.seconds ?? 0;
                                        return createdSec >= compLeaveInfo.minGrantSeconds;
                                    }
                                    return true;
                                })
                                .reduce((acc, curr) => acc + (curr.leaveValue || 0), 0);

                            const effectiveLimit = type === "Compensatory Leave" ? compLeaveInfo.granted : limit;
                            const percentage = effectiveLimit > 0 ? Math.min((used / effectiveLimit) * 100, 100) : 0;
                            const isNearLimit = effectiveLimit > 0 && percentage >= 80;

                            return (
                                <div key={type} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-gray-700 truncate" title={type}>{type}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isNearLimit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {used}/{effectiveLimit}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 ${isNearLimit ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                    {type === "Compensatory Leave" && effectiveLimit === 0 && (
                                        <p className="text-[10px] text-gray-400 italic mt-1">No grants yet</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
