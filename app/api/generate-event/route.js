import { NextResponse } from "next/server";
import { generateEventFromPrompt } from "@/lib/ai/event-generator";

export async function POST(req) {
  try {
    const { prompt } = await req.json();
    const data = await generateEventFromPrompt(prompt);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating event:", error);
    const status = error.message === "Prompt is required" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
