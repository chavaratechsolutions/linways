"use client";

import DashboardLayout from "@/components/DashboardLayout";
import UncountedLeavesManager from "@/components/UncountedLeavesManager";

export default function PrincipalUncountedLeavesPage() {
    return (
        <DashboardLayout allowedRole="princi">
            <UncountedLeavesManager />
        </DashboardLayout>
    );
}
