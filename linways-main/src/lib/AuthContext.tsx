"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useRouter } from "next/navigation";

interface UserData {
    name?: string;
    designation?: string;
    department?: string;
    gender?: string;
    extraCasualLeaves?: number;
    qualifications?: any[];
    experiences?: any[];
}

interface AuthContextType {
    user: User | null;
    role: "admin" | "staff" | "princi" | "dir" | "hod" | null;
    userData: UserData | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    userData: null,
    loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<"admin" | "staff" | "princi" | "dir" | "hod" | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        let docUnsubscribe: (() => void) | null = null;

        const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
            if (docUnsubscribe) {
                docUnsubscribe();
                docUnsubscribe = null;
            }
            try {
                if (user) {
                    setUser(user);
                    try {
                        if (db) {
                            docUnsubscribe = onSnapshot(doc(db, "users", user.uid), (userDoc) => {
                                if (userDoc.exists()) {
                                    const data = userDoc.data();
                                    setRole(data.role);
                                    setUserData({
                                        name: data.name || data.displayName || user.displayName,
                                        designation: data.designation,
                                        department: data.department,
                                        gender: data.gender,
                                        extraCasualLeaves: data.extraCasualLeaves || 0,
                                        qualifications: data.qualifications || [],
                                        experiences: data.experiences || []
                                    });
                                }
                                setLoading(false);
                            });
                        } else {
                            console.warn("Firestore is not initialized.");
                            setLoading(false);
                        }
                    } catch (error) {
                        console.error("Error setting up onSnapshot for user data:", error);
                        setLoading(false);
                    }
                } else {
                    setUser(null);
                    setRole(null);
                    setUserData(null);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Auth state change error:", error);
                setLoading(false);
            }
        });

        return () => {
            authUnsubscribe();
            if (docUnsubscribe) docUnsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, role, userData, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
