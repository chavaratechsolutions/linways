"use client";

import DashboardLayout from "@/components/DashboardLayout";
import UncountedLeavesManager from "@/components/UncountedLeavesManager";

export default function AdminUncountedLeavesPage() {
    return (
        <DashboardLayout allowedRole="admin">
            <UncountedLeavesManager />
        </DashboardLayout>
    );
}
