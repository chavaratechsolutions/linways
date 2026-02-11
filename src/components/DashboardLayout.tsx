"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

interface DashboardLayoutProps {
    children: React.ReactNode;
    allowedRole?: "admin" | "staff" | "dir" | "princi" | "hod";
}

export default function DashboardLayout({ children, allowedRole }: DashboardLayoutProps) {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
                // If role mismatch (and not the special case of princi viewing staff pages, or dir viewing admin pages)
                const isStaffAccessingStaff = allowedRole === "staff" && (role === "princi" || role === "dir" || role === "hod");
                const isAdminAccessingAdmin = allowedRole === "admin" && (role === "dir" || role === "princi" || role === "hod"); // Allow princi/dir/hod on admin pages if needed, but we have specific pages now.

                // Strict check for dedicated pages
                if (allowedRole && role !== allowedRole) {
                    // Exception for staff pages which princi/dir/hod can see
                    if (allowedRole === "staff" && (role === "princi" || role === "dir" || role === "hod")) {
                        // allowed
                    } else {
                        if (role === "admin") router.push("/admin");
                        else if (role === "dir") router.push("/director");
                        else if (role === "hod") router.push("/hod");
                        else if (role === "princi") router.push("/principal");
                        else router.push("/staff");
                    }
                }
            }
        }
    }, [user, role, loading, router, allowedRole]);

    // Fail-safe: Force redirect if stuck on "Redirecting..." for too long
    useEffect(() => {
        if (!loading && !user) {
            const timer = setTimeout(() => {
                window.location.href = "/login";
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [loading, user]);

    if (loading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-gray-50 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                <p className="text-sm text-gray-500 font-medium">Initializing...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-gray-50 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                <p className="text-sm text-gray-500 font-medium">Redirecting to login...</p>
            </div>
        );
    }

    // If role mismatch
    const isStaffAccessingStaff = allowedRole === "staff" && (role === "princi" || role === "dir" || role === "hod");
    // We are strict now: princi must be on allowedRole="princi", dir on "dir".

    if (allowedRole && role !== allowedRole && !isStaffAccessingStaff) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-gray-50 gap-4 p-4 text-center">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Access Issue</h2>
                <p className="text-gray-600 max-w-md">
                    {role === null
                        ? "We couldn't verify your account permissions. This often happens if a browser extension (like Brave Shields or AdBlock) is blocking our database."
                        : "You do not have the required permissions to view this page."}
                </p>
                {role === null && (
                    <div className="text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                        Tip: Try disabling "Shields" or AdBlock for this site.
                    </div>
                )}
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                    Retry Connection
                </button>
                <button
                    onClick={() => router.push("/login")}
                    className="text-sm text-gray-500 hover:text-gray-900"
                >
                    Back to Login
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden shrink-0">
                    <span className="text-lg font-bold text-blue-600">LMS Portal</span>
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
