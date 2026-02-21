"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";

export default function Header() {
    const { role, user } = useAuth();

    let dashboardHref = "/";
    if (user) {
        if (role === "admin") dashboardHref = "/admin";
        else if (role === "dir") dashboardHref = "/director";
        else if (role === "princi") dashboardHref = "/principal";
        else if (role === "hod") dashboardHref = "/hod";
        else dashboardHref = "/staff";
    }

    return (
        <header className="flex h-20 w-full items-center border-b border-blue-700 bg-blue-600 px-4 text-white md:px-6">
            <Link href={dashboardHref} className="flex items-center gap-2">
                <Image
                    src="/img/carmellogo.png"
                    alt="Logo"
                    width={500}
                    height={200}
                    className="h-12 w-auto"
                    priority
                    unoptimized
                />
            </Link>
        </header>
    );
}
