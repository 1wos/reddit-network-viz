/**
 * MCP server — exposes the RedditPulse ontology GraphRAG engine over the Model
 * Context Protocol (stdio). Any MCP client (Claude Desktop, IDEs, agents) can
 * call the ontology as structured tools.
 *
 *   node mcp/server.js          # run as an MCP stdio server
 *
 * Claude Desktop config example (claude_desktop_config.json):
 *   { "mcpServers": { "redditpulse-ontology": { "command": "node",
 *       "args": ["/abs/path/to/mcp/server.js"] } } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createOntologyTools } from "./tools.js";

const tools = createOntologyTools();
const server = new McpServer({ name: "redditpulse-ontology", version: "1.0.0" });

const asText = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });

server.tool("ontology_answer", "Grounded GraphRAG answer (+supportStatus, evidence, missing slots).",
  { question: z.string().describe("Natural-language question about the finance ontology") },
  async ({ question }) => asText(tools.call("ontology_answer", { question })));

server.tool("ontology_lineage", "Evidence lineage for a node id (source posts → authors/subreddits).",
  { id: z.string().describe("Node id, e.g. 'nvidia' or 'recession_risk'") },
  async ({ id }) => asText(tools.call("ontology_lineage", { id })));

server.tool("ontology_neighbors", "Typed, directed relationships of a node id.",
  { id: z.string() },
  async ({ id }) => asText(tools.call("ontology_neighbors", { id })));

server.tool("ontology_semantic_search", "Semantic vector search over contextual entity embeddings.",
  { query: z.string(), k: z.number().optional() },
  async ({ query, k }) => asText(tools.call("ontology_semantic_search", { query, k })));

server.tool("ontology_action", "Kinetic write-back action against the ontology.",
  { action: z.enum(["acknowledgeSignal", "escalateRisk", "createWatchlist", "addToWatchlist", "annotateEvidence"]),
    params: z.record(z.any()).optional() },
  async ({ action, params }) => asText(tools.call("ontology_action", { action, params })));

server.tool("ontology_briefing", "Generate a Daily Social Signal Brief.",
  {}, async () => asText(tools.call("ontology_briefing", {})));

server.tool("ontology_catalog", "The ontology contract: object/link types + live counts + context hash.",
  {}, async () => asText(tools.call("ontology_catalog", {})));

await server.connect(new StdioServerTransport());
console.error("[redditpulse-ontology] MCP server ready on stdio");
