"use client";

import DashboardLayout from "@/components/DashboardLayout";
import UncountedLeavesManager from "@/components/UncountedLeavesManager";

export default function DirectorUncountedLeavesPage() {
    return (
        <DashboardLayout allowedRole="dir">
            <UncountedLeavesManager />
        </DashboardLayout>
    );
}
