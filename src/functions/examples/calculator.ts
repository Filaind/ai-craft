import type { Agent } from "../../agent"
import { LLMFunctions } from "../llm-functions"
import 'ses';

import { z } from "zod"
import { Vec3 } from 'vec3';

// // safeEvalSimple.ts
// export type EvalResult = number;

// const ALLOWED_FUNCTIONS = new Set([
//   "sin",
//   "cos",
//   "tan",
//   "asin",
//   "acos",
//   "atan",
//   "sqrt",
//   "abs",
//   "log",    // natural log
//   "log10",
//   "exp",
//   "pow",
//   "min",
//   "max",
//   // add more Math functions if desired
// ]);

// const ALLOWED_CONSTANTS = new Set([
//   "pi",
//   "e",
// ]);

// /**
//  * Evaluate a simple math expression string while restricting available identifiers.
//  * Throws on invalid or disallowed input.
//  */
// export function safeEvalExpression(expr: string): EvalResult | string {
//   if (typeof expr !== "string") return "Error: Expression must be a string";

//   const s = expr.trim();
//   if (!s) return "Error: Empty expression";

//   // 1) Reject clearly dangerous characters or patterns
//   //    - semicolons, braces, brackets, quotes, backticks, pipes, backslash, colon are banned.
//   //    - disallow comment patterns '//' and '/*'
//   if (/[;{}\[\]'"`\\|:]/.test(s)) return "Error: Disallowed character in expression";
//   if (s.includes("//") || s.includes("/*") || s.includes("*/")) return "Error: Comments are not allowed";

//   // 2) Quick allowed character whitelist (letters, digits, underscore, operators, parentheses, comma, dot, whitespace)
//   if (!/^[0-9A-Za-z_\s+\-*/%^(),.]+$/.test(s)) return "Error: Expression contains invalid characters";

//   // 3) Ensure '.' is used only as part of numbers (i.e. it must touch a digit on at least one side)
//   for (let i = 0; i < s.length; i++) {
//     if (s[i] === ".") {
//       const prev = s[i - 1];
//       const next = s[i + 1];
//       const prevIsDigit = prev !== undefined && /\d/.test(prev);
//       const nextIsDigit = next !== undefined && /\d/.test(next);
//       if (!prevIsDigit && !nextIsDigit) return "Error: Invalid dot usage (not part of a number)";
//     }
//   }

//   // 4) Check all identifiers (words starting with letter/underscore) are in allowed sets
//   //    We match identifiers and check them in lowercase form
//   const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/g;
//   let m: RegExpExecArray | null;
//   while ((m = IDENT_RE.exec(s)) !== null) {
//     const name = m[0].toLowerCase();
//     // if the identifier looks like a number token (rare) or is allowed, continue; otherwise reject
//     if (ALLOWED_FUNCTIONS.has(name) || ALLOWED_CONSTANTS.has(name)) continue;
//     // also allow the word "pow" even if mixed-case etc (it's already in ALLOWED_FUNCTIONS)
//     // Disallow anything else (including 'Math', 'process', 'global', etc.)
//     return `Error: Identifier "${m[0]}" is not allowed`;
//   }

//   // 5) Build safe evaluation wrapper:
//   //    - destructure allowed Math functions into local variables
//   //    - create local constants (pi, e)
//   //    - evaluate expression and return result
//   const funcs = Array.from(ALLOWED_FUNCTIONS);
//   const consts = Array.from(ALLOWED_CONSTANTS);

//   // Prepare destructuring of functions (only from Math)
//   // Example: const { sin, cos, sqrt } = Math;
//   const funcDestructure = funcs.length ? `const { ${funcs.join(", ")} } = Math;` : "";

//   // Prepare constant bindings (e.g., const pi = Math.PI; const e = Math.E;)
//   const constBindings = consts
//     .map((c) => {
//       if (c === "pi") return `const pi = Math.PI;`;
//       if (c === "e") return `const e = Math.E;`;
//       return `const ${c} = Math.${c};`;
//     })
//     .join(" ");

//   // Map caret '^' to Math.pow in wrapper by rewriting `a ^ b` to `pow(a,b)`
//   // But we must be careful: ^ is a bitwise operator in JS. We'll do a safe textual replacement that
//   // transforms infix '^' to pow(), preserving parentheses/operands.
//   // Simpler approach: replace '^' with '**' (exponentiation operator) — supported in modern JS.
//   // Using '**' avoids needing to rewrite into pow(). But still, '**' is an operator; it's fine.
//   const normalized = s.replace(/\^/g, "**");

//   // Final function body
//   const fnBody = `"use strict";
//     ${funcDestructure}
//     ${constBindings}
//     return (${normalized});
//   `;

//   // Use Function constructor to evaluate in a fresh local scope (no implicit access to outer scope)
//   let fn: Function;
//   try {
//     fn = new Function(fnBody);
//   } catch (err) {
//     return "Error: Failed to compile expression";
//   }

//   let rawResult: unknown;
//   try {
//     rawResult = fn();
//   } catch (err) {
//     // Rethrow in a user-friendly manner
//     return "Error: Error while evaluating expression";
//   }

//   if (typeof rawResult !== "number" || !Number.isFinite(rawResult)) {
//     return "Error: Expression did not evaluate to a finite number";
//   }

//   return rawResult;
// }

// LLMFunctions.register({
//   group: "unsafe", // safe, but unsafe
//   name: "eval",
//   description: "Evaluates math expression. Use it when you need to calculate some numeric value.",
//   schema: z.object({
//     expr: z.string().describe("Math expression. Supports all standart JS math functions. E.g. \"(pow(2,3) + sqrt(16)) / 2\""),
//   }),
//   handler: async (agent: Agent, args) => {
//     return {
//       message: safeEvalExpression(args.expr)
//     }
//   }
// })

LLMFunctions.register({
  group: "unsafe", // safe, but unsafe
  name: "eval js",
  description: `
Evaluates JS code. Use it when you need to math operations or other complex calculations.
Available modules: Math, Date, console, Vec3.
  `,
  schema: z.object({
    code: z.string().describe("JS code to evaluate. E.g. \"const result = (pow(2,3) + sqrt(16)) / 2; return result;\""),
  }),
  handler: async (agent: Agent, args) => {
    console.log("Executing JS code: " + args.code);

    const func = new Compartment({
      Math,
      Date,
      Vec3,
      console
    }).evaluate(`(async () => {
      ${args.code}
    })`);

    const result = await func();

    return "Function result: " + result;
  }
})  