// src/app/api/ocr/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
    const cleanApiKey = process.env.MINDEE_API_KEY ? process.env.MINDEE_API_KEY.trim() : "NO_KEY_FOUND";

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        const mindeeFormData = new FormData();
        mindeeFormData.append('file', file); 
        mindeeFormData.append('model_id', '4d5c646d-0e7f-4b5d-be89-8637214c5115'); 

        console.log("Sending document to Mindee V2...");

        const enqueueResponse = await fetch("https://api-v2.mindee.net/v2/inferences/enqueue", {
            method: 'POST',
            headers: { 'Authorization': cleanApiKey },
            body: mindeeFormData
        });

        const enqueueData = await enqueueResponse.json();

        if (!enqueueResponse.ok) {
            throw new Error(enqueueData.detail || "Failed to enqueue document");
        }

        const jobId = enqueueData.job?.id;
        if (!jobId) throw new Error("No Job ID returned.");

        console.log(`✅ Document enqueued! Job ID: ${jobId}`);

        let isDone = false;
        let prediction = null;
        let attempts = 0;

        while (!isDone && attempts < 45) { 
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1500)); 

            const pollResponse = await fetch(`https://api-v2.mindee.net/v2/jobs/${jobId}`, {
                method: 'GET',
                headers: { 'Authorization': cleanApiKey }
            });

            const pollData = await pollResponse.json();

            // 🚨 THE FIX: Mindee V2 stores your custom model data in `inference.result.fields`
            if (pollData.inference && pollData.inference.result && pollData.inference.result.fields) {
                isDone = true;
                prediction = pollData.inference.result.fields;
                console.log("✅ AI Processing Complete!");
                break;
            }

            const currentStatus = pollData.job?.status;
            if (currentStatus === "failed") {
                throw new Error("Mindee AI processing failed on their server.");
            }
        }

        if (!prediction) {
            throw new Error("AI Processing timed out. Mindee took too long to respond.");
        }

        console.log("✅ EXTRACTED FIELDS:", JSON.stringify({
            date: prediction.date?.value,
            supplier: prediction.supplier_name?.value,
            totalAmount: prediction.total_amount?.value
        }));

        // Map the fields safely to the React form
        const extractedData = {
            date: prediction.date?.value || prediction.receipt_date?.value || "",
            supplier: prediction.supplier_name?.value || prediction.supplier?.value || "",
            totalAmount: prediction.total_amount?.value || prediction.total?.value || 0,
        };

        return NextResponse.json(extractedData);

    } catch (error) {
        console.error("OCR API Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}