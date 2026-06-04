/**
 * ClaudeCodeLLM — uses the local `claude` CLI (Claude Code) in headless mode as
 * an LLM provider. No API key needed: it rides your Claude Code subscription.
 *
 * Node-only (spawns a process) → kept in its own module so the browser bundle
 * never imports child_process. Great for free local dev / demos; for production
 * use the Anthropic API (ClaudeLLM) or Bedrock.
 */
import { execFile } from "node:child_process";

export class ClaudeCodeLLM {
  constructor(opts = {}) {
    this.bin = opts.bin || process.env.CLAUDE_BIN || "claude";
    this.timeout = opts.timeout || 180000;
  }
  get available() { return true; } // assumes the `claude` CLI is on PATH
  generate({ system, user }) {
    const prompt = `${system}\n\n---\n\n${user}`;
    return new Promise((resolve, reject) => {
      execFile(this.bin, ["-p", prompt], { maxBuffer: 10 * 1024 * 1024, timeout: this.timeout }, (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || err.message).slice(0, 200)));
        const out = String(stdout).trim();
        if (!out) return reject(new Error("empty completion from claude CLI"));
        resolve(out);
      });
    });
  }
}
