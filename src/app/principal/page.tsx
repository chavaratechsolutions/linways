"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { Users, ClipboardList, Clock, CheckCircle, Calendar, UserPlus } from "lucide-react";
import Link from "next/link";

export default function PrincipalDashboard() {
    const [stats, setStats] = useState({
        totalStaff: 0,
        pendingLeaves: 0,
        approvedLeaves: 0,
        totalRequests: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, "leaves"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.metadata.fromCache && snapshot.empty) {
                return; // Ignore empty cache
            }
            const leaves = snapshot.docs.map(d => d.data());

            // Principal only sees requests that have passed through lower levels
            const relevantLeaves = leaves.filter(l => {
                if (l.status === "Pending") return false;
                if (l.type === "Compensatory Leave" && l.recommendedBy !== "Director") return false;
                return true;
            });

            setStats(prev => ({
                ...prev,
                totalRequests: relevantLeaves.length,
                pendingLeaves: relevantLeaves.filter(l => l.status === "Recommended").length,
                approvedLeaves: relevantLeaves.filter(l => l.status === "Approved").length,
            }));
            setLoading(false);
        });

        const fetchStaffCount = async () => {
            const staffQ = query(collection(db, "users"), where("role", "==", "staff"));
            const staffSnap = await getDocs(staffQ);
            setStats(prev => ({ ...prev, totalStaff: staffSnap.size }));
        };

        fetchStaffCount();
        return () => unsubscribe();
    }, []);

    const statCards = [
        { name: "Total Staff", value: loading ? "..." : stats.totalStaff, icon: Users, color: "text-purple-600", bg: "bg-purple-100", href: "/principal/staffs" },
        { name: "Pending", value: loading ? "..." : stats.pendingLeaves, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100", href: "/principal/requests?status=Pending" },
        { name: "Approved", value: loading ? "..." : stats.approvedLeaves, icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", href: "/principal/requests?status=Approved" },
        { name: "Total Requests", value: loading ? "..." : stats.totalRequests, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-100", href: "/principal/requests?status=All" },
    ];

    return (
        <DashboardLayout allowedRole="princi">
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Principal Dashboard</h1>
                    <p className="text-sm text-gray-500">Welcome to the HR Management System principal portal.</p>
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

                <div className="rounded-xl bg-white p-4 md:p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Link
                            href="/principal/requests"
                            className="flex items-center justify-center gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-semibold shadow-sm text-sm md:text-base"
                        >
                            <Calendar className="h-5 w-5 shrink-0" />
                            Review Requests
                        </Link>

                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
