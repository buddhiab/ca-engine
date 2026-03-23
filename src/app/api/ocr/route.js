// src/app/api/ocr/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        // 1. Get the image file from the frontend request
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // 2. Prepare the file to send to Mindee's AI
        const mindeeFormData = new FormData();
        mindeeFormData.append('document', file);

        // 3. Call the Mindee Receipt Parsing AI
        const response = await fetch("https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict", {
            method: 'POST',
            headers: {
                'Authorization': `Token ${process.env.MINDEE_API_KEY}`
            },
            body: mindeeFormData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.api_request?.error?.message || "Failed to parse receipt");
        }

        // 4. Extract the exact data we need from the AI's response
        const prediction = data.document.inference.prediction;

        const extractedData = {
            date: prediction.date.value, // e.g., "2026-03-15"
            supplier: prediction.supplier_name.value, // e.g., "Starbucks"
            totalAmount: prediction.total_amount.value, // e.g., 14.50
        };

        // 5. Send the clean data back to the React frontend
        return NextResponse.json(extractedData);

    } catch (error) {
        console.error("OCR API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}