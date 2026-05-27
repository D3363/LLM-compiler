# 🤖 Self-Healing LLM Compiler Pipeline

[![Live API](https://img.shields.io/badge/Live_Executable_API-Ready-brightgreen)](https://llm-compiler-pipeline.onrender.com/)

A production-grade, multi-stage compiler pipeline that transforms open-ended natural language instructions into strict, validated architectural blueprints and executable software runtimes. Built with **TypeScript**, **Zod (v4)**, and the **OpenAI/Groq SDK**, this system features a robust fault-tolerant validation and auto-healing loop.

---

## 🎯 The Core Philosophy

Standard prompt engineering solutions fail when building complex software systems because Large Language Models (LLMs) inherently output loosely structured JSON, hallucinate fields, and fail to maintain constraints across layers. 

This project treats an LLM not as a magical text generator, but as an unpredictable computing primitive that requires an engineering control harness. The system acts like a traditional language compiler: it breaks down user intents into isolated abstract layers, mathematical contract definitions parse the output, and an execution engine translates the final valid AST (Abstract Syntax Tree) into a copy-paste-ready runtime.

---

## ⚙️ System Architecture

Instead of a fragile, single-prompt generation block, the pipeline is split into three strictly isolated sequential modules inside the `LLMCompiler` engine:

1. **Stage 1: Intent Extraction (The Lexer)** Parses raw user input into structural core system attributes including the application name, mandatory entities, distinct user roles, and core business constraints.
2. **Stage 2: Relational Database Architecture** Maps application parameters onto structured database designs, generating explicit tables, typings, and strict foreign key mappings.
3. **Stage 3: REST API & Auth Schema (The Linker)** Compiles backend service routing endpoints. Cross-layer integrity guardrails ensure that the API generation *only* references tables and authentication roles compiled cleanly in the previous stages.

---

## 🛡️ The Self-Healing Validation Engine

If the underlying LLM attempts to output broken JSON structures, missing fields, or invalid types, the system catches the violation at runtime using strict **Zod** schema constraints. 

Rather than executing a blind, expensive global retry, the system engages a targeted **Repair Loop**:
* The compilation node catches the exact `ZodError` issue array.
* The loop stringifies the explicit error stack trace context.
* It passes the validation delta back to the model, instructing it to evaluate its previous mistakes and patch the payload block natively.

The compiler successfully auto-heals layout formatting flaws across consecutive execution cycles before delivering the payload.

---

## 🚀 Execution Awareness (The Compiled Runtime)

The output of the compiler is directly executable. Once the JSON validation schemas pass their strict type contracts, the engine drops the payload into an generation interpreter that assembles a functional, production-ready **Express.js backend server** string, complete with pre-configured mock role-based authentication middlewares matching the intent criteria.

---

## 🛠️ Technology Stack & Setup

* **Runtime:** Node.js (v18+) with TypeScript (`NodeNext` module resolution)
* **Validation:** Zod (v4)
* **Orchestration Client:** OpenAI Node SDK (Routed via Groq Infrastructure)
* **Default LLM Core:** `llama-3.3-70b-versatile` (Locked at `temperature: 0.1` for deterministic execution)
* **Hosting Interface:** Express Web API deployed on **Render**
