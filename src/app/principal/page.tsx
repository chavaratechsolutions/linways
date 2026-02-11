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

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, "leaves"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leaves = snapshot.docs.map(d => d.data());
            setStats(prev => ({
                ...prev,
                totalRequests: leaves.length,
                pendingLeaves: leaves.filter(l => l.status === "Pending").length,
                approvedLeaves: leaves.filter(l => l.status === "Approved").length,
            }));
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
        { name: "Total Staff", value: stats.totalStaff, icon: Users, color: "text-purple-600", bg: "bg-purple-100" },
        { name: "Pending", value: stats.pendingLeaves, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" },
        { name: "Approved", value: stats.approvedLeaves, icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
        { name: "Total Requests", value: stats.totalRequests, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-100" },
    ];

    return (
        <DashboardLayout allowedRole="princi">
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Principal Dashboard</h1>
                    <p className="text-sm text-gray-500">Welcome to the LMS principal portal.</p>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 md:gap-6">
                    {statCards.map((stat) => (
                        <div key={stat.name} className="flex flex-col md:flex-row items-center rounded-xl bg-white p-4 md:p-6 shadow-sm border border-gray-100 gap-2 md:gap-4">
                            <div className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg shrink-0 ${stat.bg} ${stat.color}`}>
                                <stat.icon className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <div className="text-center md:text-left overflow-hidden w-full">
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase tracking-tight truncate">{stat.name}</p>
                                <p className="text-lg md:text-2xl font-bold text-gray-900 leading-tight">{stat.value}</p>
                            </div>
                        </div>
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
