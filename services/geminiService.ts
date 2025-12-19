
import { GoogleGenAI } from "@google/genai";
import { NetworkConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AdviceResult {
  text: string;
  commands: string[];
  sources: { title: string; uri: string }[];
}

export async function getNetworkAdvice(config: NetworkConfig): Promise<AdviceResult> {
  const prompt = `
    You are a Linux Networking Expert specialized in Ubuntu 24.04 x64 routers, Multi-WAN, and High Availability.
    Current Router State:
    - Mode: ${config.mode}
    - WAN Interfaces: ${JSON.stringify(config.wanInterfaces, null, 2)}
    
    Task:
    1. Analyze this setup for performance and reliability on an Ubuntu x64 machine.
    2. Provide a short, professional recommendation.
    3. List the EXACT Linux CLI commands (iproute2, nftables, sysctl) to implement the current mode (${config.mode}).
    
    IMPORTANT: Provide the output in a structured format. 
    Wrap the CLI commands in a single code block starting with 'COMMANDS_START' and ending with 'COMMANDS_END'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      }
    });

    const text = response.text || "";
    const commandsMatch = text.match(/COMMANDS_START([\s\S]*?)COMMANDS_END/);
    const commands = commandsMatch 
      ? commandsMatch[1].trim().split('\n').filter(line => line.trim() && !line.startsWith('```'))
      : ["# No specific commands generated"];

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Reference",
        uri: chunk.web?.uri || "#"
      })) || [];

    return {
      text: text.replace(/COMMANDS_START[\s\S]*?COMMANDS_END/, "").trim(),
      commands,
      sources
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      text: "Connectivity error. Unable to fetch AI advice.",
      commands: [],
      sources: []
    };
  }
}
