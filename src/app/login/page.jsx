// src/app/login/page.jsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);

        try {
            if (isSignUp) {
                // Register a new accountant
                const { error } = await supabase.auth.signUp({
                    email,
                    password
                });
                if (error) throw error;
                alert("Registration successful! You can now sign in.");
                setIsSignUp(false); // Flip back to login mode
            } else {
                // Authenticate an existing accountant
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;

                // FIX: Force a hard browser redirect to clear the Next.js cache 
                // so the server-side middleware instantly reads the fresh secure cookie.
                window.location.href = "/dashboard";
            }
        } catch (error) {
            console.error("Auth Error:", error);
            setErrorMsg(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-sm border-slate-200">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
                        {isSignUp ? "Create an Account" : "Welcome Back"}
                    </CardTitle>
                    <CardDescription>
                        {isSignUp
                            ? "Enter your email below to register your firm."
                            : "Enter your credentials to access your ledger."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m.scott@paperco.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {errorMsg && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md">
                                {errorMsg}
                            </div>
                        )}

                        <Button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                            {isLoading ? "Authenticating..." : (isSignUp ? "Register Firm" : "Sign In")}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter>
                    <div className="text-sm text-slate-500 text-center w-full">
                        {isSignUp ? "Already have an account? " : "Don't have an account? "}
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setErrorMsg(null);
                            }}
                            className="text-slate-900 font-semibold hover:underline"
                        >
                            {isSignUp ? "Sign In" : "Sign Up"}
                        </button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}