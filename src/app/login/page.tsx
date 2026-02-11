"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { LogIn } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user, role, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && user && role) {
            if (role === "admin") router.push("/admin");
            else if (role === "dir") router.push("/director");
            else if (role === "princi") router.push("/principal");
            else router.push("/staff");
        }
    }, [user, role, authLoading, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (!auth) {
                throw new Error("Firebase authentication is not initialized. Please check your environment variables.");
            }
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

            if (userDoc.exists()) {
                const userRole = userDoc.data().role;
                if (userRole === "admin") router.push("/admin");
                else if (userRole === "dir") router.push("/director");
                else if (userRole === "princi") router.push("/principal");
                else router.push("/staff");
            } else {
                setError("User record not found in database.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to sign in.");
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl">
                <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <LogIn className="h-8 w-8" />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Sign in to LMS</h2>
                    <p className="mt-2 text-sm text-gray-600">Enter your credentials to access your dashboard</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Email Address</label>
                            <input
                                type="email"
                                required
                                className="relative block w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                                placeholder="email@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Password</label>
                            <input
                                type="password"
                                required
                                className="relative block w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <div className="text-sm font-medium text-red-600">{error}</div>}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {loading ? "Signing in..." : "Sign in"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
