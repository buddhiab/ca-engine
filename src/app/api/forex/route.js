// src/app/api/forex/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const baseCurrency = searchParams.get('base') || 'USD';

    try {
        // Fetching live rates from the open ExchangeRate-API
        const response = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`, {
            cache: 'no-store' // Ensure we always get the absolute live rate
        });
        
        const data = await response.json();

        if (data.result !== "success") {
            throw new Error("Failed to fetch exchange rates");
        }

        const lkrRate = data.rates['LKR'];

        if (!lkrRate) {
            throw new Error(`LKR rate not found for base currency ${baseCurrency}`);
        }

        return NextResponse.json({ 
            base: baseCurrency, 
            target: 'LKR', 
            rate: lkrRate 
        });

    } catch (error) {
        console.error("Forex API Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}