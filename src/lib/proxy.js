// src/proxy.js
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function proxy(request) {
    // Create an unmodified response by default
    let supabaseResponse = NextResponse.next({ request });

    // Initialize the secure server-side Supabase client
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    // Update the request cookies
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

                    // Update the response cookies
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Securely request the user object from Supabase via cookies
    const { data: { user } } = await supabase.auth.getUser();

    // THE BOUNCER LOGIC:
    // 1. Kick unauthenticated users out of the dashboard
    if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // 2. Push authenticated users away from the login page back to the dashboard
    if (user && request.nextUrl.pathname === '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

// Ensure the proxy runs on the correct paths (ignoring static files)
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};