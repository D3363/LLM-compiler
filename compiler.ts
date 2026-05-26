import OpenAI from 'openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Redirect OpenAI SDK to point to Groq's cloud infrastructure
const ai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1"
});

// ==========================================
// 1. STRICT SCHEMA ENFORCEMENT (CONTRACTS)
// ==========================================

const IntentSchema = z.object({
  appName: z.string(),
  coreEntities: z.array(z.string()),
  userRoles: z.array(z.string()),
  businessLogicRules: z.array(z.string()),
});

const DBTableSchema = z.object({
  tableName: z.string(),
  columns: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'date', 'reference']),
    isRequired: z.boolean(),
    references: z.string().optional()
  }))
});

const APISchema = z.object({
  endpoints: z.array(z.object({
    path: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    requiresAuth: z.boolean(),
    allowedRoles: z.array(z.string()),
    interactsWithTables: z.array(z.string())
  }))
});

// ==========================================
// 2. VALIDATION + REPAIR ENGINE (GROQ ADAPTED)
// ==========================================

async function generateWithRepair<T>(
  systemPrompt: string,
  userPrompt: string,
  zodSchema: z.ZodSchema<T>,
  schemaName: string,
  maxRetries = 4
): Promise<T> {
  let currentErrorContext = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const messages: any[] = [
      { 
        role: "system", 
        content: `${systemPrompt}\n\nCRITICAL: Return ONLY raw JSON matching the required scheme fields. No conversational text. No markdown wrappers.` 
      },
      { role: "user", content: userPrompt }
    ];

    if (attempt > 1) {
      messages.push({
        role: "user",
        content: `⚠️ CRITICAL COMPILER ERROR:\nYour previous output failed validation parsing.\nError Stack:\n${currentErrorContext}\n\nFix your syntax errors and return a perfectly structured object.`
      });
      console.log(`[Repair Engine] Running repair cycle ${attempt}/${maxRetries} for ${schemaName}...`);
      await sleep(2000); // Small pause to manage free-tier rate queues
    }

    try {
      const response = await ai.chat.completions.create({
        // Using Groq's high-intelligence coding model
        model: "llama-3.3-70b-versatile", 
        messages: messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const rawText = response.choices[0]?.message?.content?.trim() || "{}";
      const parsedJson = JSON.parse(rawText);
      
      // Enforce absolute type-safety checks at runtime
      return zodSchema.parse(parsedJson);

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        currentErrorContext = JSON.stringify(error.issues, null, 2);
      } else {
        currentErrorContext = error.message;
      }

      if (attempt === maxRetries) {
        throw new Error(`[CRITICAL ARTIFACT CRASH] ${schemaName} generation failed structural verification. Log: ${currentErrorContext}`);
      }
    }
  }
  throw new Error("Fatal Compilation State");
}

// ==========================================
// 3. MULTI-STAGE GENERATION PIPELINE
// ==========================================

class LLMCompiler {
  static async extractIntent(rawInput: string) {
    console.log("[Stage 1] Extracting System Intent via Groq Cloud...");
    const systemPrompt = `Extract core system dependencies: appName (string), coreEntities (array), userRoles (array), businessLogicRules (array).`;
    return await generateWithRepair(systemPrompt, rawInput, IntentSchema, "Intent Extraction");
  }

  static async designDatabase(intent: z.infer<typeof IntentSchema>) {
    console.log("[Stage 2] Building Database Architectures...");
    const systemPrompt = `Map application parameters to database designs. Create an object with a single "tables" array root. Ensure each entry has "tableName" and a nested "columns" array including 'name', 'type' (string/number/boolean/date/reference), and 'isRequired'.`;
    const wrapperSchema = z.object({ tables: z.array(DBTableSchema) });
    const result = await generateWithRepair(systemPrompt, JSON.stringify(intent), wrapperSchema, "Database Schema");
    return result.tables;
  }

  static async designAPI(intent: z.infer<typeof IntentSchema>, dbSchema: any) {
    console.log("[Stage 3] Compiling REST Microservice Routing & Middleware...");
    const systemPrompt = `Generate a REST API model. Create an object with an "endpoints" array root. Allowed tables: ${JSON.stringify(dbSchema.map((t: any) => t.tableName))}. Allowed roles: ${JSON.stringify(intent.userRoles)}.`;
    return await generateWithRepair(systemPrompt, JSON.stringify(intent), APISchema, "API Schema");
  }
}

// ==========================================
// 4. RUNTIME SCRIPT COMPILER
// ==========================================

function generateExecutableExpressCode(apiSchema: z.infer<typeof APISchema>) {
  console.log("\n[Execution Stage] Generating production-ready Express.js runtime assembly...\n");
  let code = `import express from 'express';\nconst app = express();\napp.use(express.json());\n\n`;
  
  apiSchema.endpoints.forEach(endpoint => {
    const authMiddleware = endpoint.requiresAuth ? `requireAuth(['${endpoint.allowedRoles.join("', '")}']), ` : '';
    const methodStr = endpoint.method.toLowerCase();
    code += `// Context Dependency Tables: ${endpoint.interactsWithTables.join(", ")}\n`;
    code += `app.${methodStr}('${endpoint.path}', ${authMiddleware}async (req, res) => {\n`;
    code += `    res.status(200).json({ pipelineStatus: 'operational' });\n});\n\n`;
  });
  
  code += `app.listen(3000, () => console.log('Local execution environment active on port 3000'));\n`;
  return code;
}

// ==========================================
// MAIN RUN PIPELINE
// ==========================================

async function run() {
  try {
    const rawPrompt = "Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics.";
    
    const intent = await LLMCompiler.extractIntent(rawPrompt);
    const db = await LLMCompiler.designDatabase(intent);
    const api = await LLMCompiler.designAPI(intent, db);
    
    console.log("\n✅ COMPILER PIPELINE SUCCESSFUL");
    console.log(generateExecutableExpressCode(api));
  } catch (error) {
    console.error("\n❌ PIPELINE CRASHED:", error);
  }
}

run();