"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEPARTMENT_LABS: Record<string, string[]> = {
    "Computer Science & Engineering": ["LAB 1", "LAB 2", "LAB 3", "LAB 4", "LAB 5"],
    "Mechanical Engineering": ["ME LAB"],
    "Electrical & Electronics Engineering": ["EEE LAB"],
    "Civil Engineering": ["CIVIL LAB"],
};

export default function Header() {
    const { role, user, userData } = useAuth();

    let dashboardHref = "/";
    if (user) {
        if (role === "admin") dashboardHref = "/admin";
        else if (role === "dir") dashboardHref = "/director";
        else if (role === "princi") dashboardHref = "/principal";
        else if (role === "hod") dashboardHref = "/hod";
        else dashboardHref = "/staff";
    }

    const showExamsButton =
        role === "dir" ||
        role === "hod" ||
        (role === "staff" &&
            (userData?.designation === "Assistant Professor" ||
                userData?.designation === "Associate Professor"));

    const [hasUpcomingExams, setHasUpcomingExams] = useState(false);

    useEffect(() => {
        if (!showExamsButton) return;

        const q = query(collection(db, "exams"));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                let upcomingCount = 0;
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                snapshot.docs.forEach((doc) => {
                    const data = doc.data();
                    if (data.deleted) return;

                    let examDate;
                    if (data.date && typeof data.date.toDate === "function") {
                        examDate = data.date.toDate();
                    } else if (data.date) {
                        examDate = new Date(data.date);
                    }

                    if (examDate && examDate >= now) {
                        if (role === "dir") {
                            upcomingCount++;
                        } else if (role === "staff" || role === "hod") {
                            const userDepartment = userData?.department || "";
                            const validLabs = DEPARTMENT_LABS[userDepartment] || [];
                            const examLabs = data.labs || [];

                            const hasMatchingLab = examLabs.some((lab: string) =>
                                validLabs.includes(lab)
                            );
                            if (hasMatchingLab) {
                                upcomingCount++;
                            }
                        }
                    }
                });

                setHasUpcomingExams(upcomingCount > 0);
            },
            (error) => {
                console.error("Error fetching exams:", error);
            }
        );

        return () => unsubscribe();
    }, [showExamsButton, role, userData?.department]);

    return (
        <header className="flex h-20 w-full items-center justify-between border-b border-blue-700 bg-blue-600 px-4 text-white md:px-6">
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
            {showExamsButton && (
                <Link
                    href="https://exam-schedular-ccet.vercel.app/login"
                    target="_blank"
                    className="mr-[2%] flex flex-col items-center gap-1 scale-[0.8] pt-2 transition-opacity hover:opacity-90 md:mr-[8%] md:scale-100 md:pt-3"
                    title="Exams"
                >
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-[60px] bg-white text-[#E33131]">
                        <span className="material-symbols-outlined text-[20px]">calendar_clock</span>
                        {hasUpcomingExams && (
                            <span className="absolute -left-1 -top-1 h-3.5 w-3.5 animate-pulse rounded-full bg-[#E33131]"></span>
                        )}
                    </div>
                    <span className="text-xs font-medium text-white">Exams</span>
                </Link>
            )}
        </header>
    );
}
