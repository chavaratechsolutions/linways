"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useRouter } from "next/navigation";

interface UserData {
    name?: string;
    designation?: string;
    department?: string;
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

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    setUser(user);
                    // Fetch role from Firestore
                    try {
                        if (db) {
                            const userDoc = await getDoc(doc(db, "users", user.uid));
                            if (userDoc.exists()) {
                                const data = userDoc.data();
                                setRole(data.role);
                                setUserData({
                                    name: data.name || data.displayName || user.displayName,
                                    designation: data.designation,
                                    department: data.department
                                });
                            }
                        } else {
                            console.warn("Firestore is not initialized.");
                        }
                    } catch (error) {
                        console.error("Error fetching user data:", error);
                    }
                } else {
                    setUser(null);
                    setRole(null);
                    setUserData(null);
                }
            } catch (error) {
                console.error("Auth state change error:", error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, role, userData, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
