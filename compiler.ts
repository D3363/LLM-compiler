import OpenAI from 'openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

// Define globally scoped directory helpers once at the top
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const systemPrompt = `Extract core system dependencies. You must return a JSON object with these exact keys: appName (string), coreEntities (array of strings), userRoles (array of strings), businessLogicRules (array of strings).`;
    return await generateWithRepair(systemPrompt, rawInput, IntentSchema, "Intent Extraction");
  }

  static async designDatabase(intent: z.infer<typeof IntentSchema>): Promise<z.infer<typeof DBTableSchema>[]> {
    console.log("[Stage 2] Building Database Architectures...");
    const systemPrompt = `Map application parameters to database designs. You MUST return a JSON object containing a single root key named "tables", which contains an array of database tables.
    Each table must have a "tableName" string and a "columns" array. Example structure: { "tables": [{ "tableName": "users", "columns": [] }] }`;
    
    const wrapperSchema = z.object({ tables: z.array(DBTableSchema) });
    const result = await generateWithRepair(systemPrompt, JSON.stringify(intent), wrapperSchema, "Database Schema");
    return result.tables;
  }

  static async designAPI(intent: z.infer<typeof IntentSchema>, dbSchema: z.infer<typeof DBTableSchema>[]) {
    console.log("[Stage 3] Compiling REST Microservice Routing & Middleware...");
    const existingTableNames = dbSchema.map(t => t.tableName);
    
    const systemPrompt = `Generate a REST API model. You MUST return a JSON object containing a single root key named "endpoints", which contains an array of routing objects.
    CRITICAL CONSTRAINT: The "interactsWithTables" array for each endpoint can ONLY contain strings from this approved list of database tables: ${JSON.stringify(existingTableNames)}.
    Allowed user roles for authentication options are: ${JSON.stringify(intent.userRoles)}.`;
    
    return await generateWithRepair(systemPrompt, JSON.stringify(intent), APISchema, "API Schema");
  }
}

// ==========================================
// 4. EXECUTION AWARENESS (RUNTIME MOCK)
// ==========================================

function generateExecutableExpressCode(apiSchema: z.infer<typeof APISchema>) {
  console.log("\n[Execution Stage] Generating production-ready Express.js runtime assembly...\n");
  
  let code = "import express from 'express';\n";
  code += "const app = express();\n";
  code += "app.use(express.json());\n\n";
  code += "// Mock Authentication Middleware\n";
  code += "const requireAuth = (roles: string[]) => (req: any, res: any, next: any) => {\n";
  code += "    console.log('Checking permissions for roles:', roles);\n";
  code += "    next();\n};\n\n";
  
  apiSchema.endpoints.forEach(endpoint => {
    const authMiddleware = endpoint.requiresAuth ? `requireAuth(['${endpoint.allowedRoles.join("', '")}']), ` : '';
    const methodStr = endpoint.method.toLowerCase();
    code += `// Context Dependency Tables: ${endpoint.interactsWithTables.join(", ")}\n`;
    code += `app.${methodStr}('${endpoint.path}', ${authMiddleware}async (req, res) => {\n`;
    code += "    res.status(200).json({ pipelineStatus: 'operational' });\n});\n\n";
  });
  
  code += "app.listen(3000, () => console.log('Local execution environment active on port 3000'));\n";
  return code;
}

// ==========================================
// 5. EXPOSING THE COMPILER AS A PUBLIC WEB API
// ==========================================

const server = express();

// Crucial Middleware - tells the server to read incoming JSON payloads
server.use(express.json());

// The POST Endpoint - Handles the heavy AI compilation logic
server.post('/compile', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
       res.status(400).json({ success: false, error: "Missing 'prompt' field in request payload." });
       return;
    }

    console.log(`\n🚀 Remotely invoking compilation pipeline for prompt: "${prompt}"`);
    
    const intent = await LLMCompiler.extractIntent(prompt);
    const db = await LLMCompiler.designDatabase(intent);
    const api = await LLMCompiler.designAPI(intent, db);
    const runtimeCode = generateExecutableExpressCode(api);

    res.json({
      success: true,
      compiledAt: new Date().toISOString(),
      schemas: { intent, database: db, api },
      executableRuntimeCode: runtimeCode
    });

  } catch (error: any) {
    console.error("Pipeline failure during remote compilation:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// The GET Endpoint - Serves the detached index.html frontend layout file seamlessly
server.get('/', async (req: Request, res: Response) => {
  try {
    const htmlPath = path.join(__dirname, 'index.html');
    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlContent);
  } catch (error: any) {
    console.error("Failed to read interface file:", error.message);
    res.status(500).send("<h1>Internal Server Error</h1><p>Missing user interface assets.</p>");
  }
});

// Bind to Render's dynamic port environment variable, default locally to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Compiler web service running on port ${PORT}`));