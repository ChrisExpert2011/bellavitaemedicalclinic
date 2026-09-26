import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/aig-run-id.server";

const MODEL = "openai/gpt-6-astra";

async function clinicFacts() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: staff }, { data: ins }] = await Promise.all([
      supabaseAdmin.from("staff_members").select("full_name, specialty").order("sort_order"),
      supabaseAdmin.from("insurances").select("name"),
    ]);
    return {
      staff: (staff ?? []).map((s) => `${s.full_name} (${s.specialty})`).join("; "),
      insurances: (ins ?? []).map((i: { name: string }) => i.name).join(", "),
    };
  } catch {
    return { staff: "", insurances: "RSSB, UAP, MMI, RADIANT, BRITAM, PRIME, SANLAM" };
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });
        let body: { messages?: UIMessage[] };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid request", { status: 400 });
        }
        const messages = (body.messages ?? []).slice(-20);
        const facts = await clinicFacts();

        const system = `You are "Bella Vitae AI", the assistant of Bella Vitae Medical Clinic, KN 5 Rd, Kigali, Rwanda.
Clinic facts: open every day 07:00–23:00. Phone +250 788 275 617, email nibellasheja@gmail.com. Languages: Kinyarwanda and English. Payments: cash, cards, cheques, mobile money. Insurances: ${facts.insurances}. Team: ${facts.staff}. Services: consultations, laboratory, echography, dental care, gynecology, internal medicine. Online booking at /appointments gives a code (BV-XXXXXX); status can be checked on the same page without signing in.
Medical answers: base them on evidence-based clinical references in the style of Medscape (Medscape Reference / drug monographs). At the end of every medical answer, add a line "Source: Medscape — <relevant topic name>" naming the Medscape topic the reader can look up. Be clear, concise, use short headings or bullets.
Safety: you do not diagnose or prescribe. For emergencies (chest pain, difficulty breathing, severe bleeding, stroke signs, loss of consciousness, pregnancy bleeding) tell the user to call 912 or come to the clinic immediately. Recommend booking an appointment with the right clinic doctor when appropriate.
Reply in the user's language (Kinyarwanda or English).`;

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });
        const result = streamText({
          model: provider.responses(MODEL),
          system,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });
        return withLovableAiGatewayRunIdHeader(
          result.toUIMessageStreamResponse({
            sendReasoning: true,
            onError: (e) => {
              const status = (e as { statusCode?: number })?.statusCode;
              if (status === 429) return "Bella Vitae AI is busy. Please try again in a moment.";
              if (status === 402) return "Bella Vitae AI is temporarily unavailable (AI credits).";
              return "Bella Vitae AI could not answer right now. Please try again.";
            },
          }),
          runIdFetch,
        );
      },
    },
  },
});
