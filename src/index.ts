#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { getRateTool, handleGetRate, convertTool, handleConvert, listCurrenciesTool, handleListCurrencies } from "./tools/rates.js";
import { historicalRatesTool, handleHistoricalRates, volatilityTool, handleVolatility, optimalSendTool, handleOptimalSend } from "./tools/analysis.js";
import { nzdCorridorsTool, handleNzdCorridors } from "./tools/nzd.js";
import { correlationTool, handleCorrelation } from "./tools/correlation.js";

const server = new Server(
  { name: "xe-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    getRateTool,
    convertTool,
    listCurrenciesTool,
    historicalRatesTool,
    volatilityTool,
    optimalSendTool,
    nzdCorridorsTool,
    correlationTool,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let text: string;

    switch (name) {
      case "get_rate":
        text = await handleGetRate(args as { from: string; to: string });
        break;
      case "convert":
        text = await handleConvert(args as { from: string; to: string; amount: number });
        break;
      case "list_currencies":
        text = await handleListCurrencies();
        break;
      case "get_historical_rates":
        text = await handleHistoricalRates(args as { from: string; to: string; days?: number });
        break;
      case "volatility_analysis":
        text = await handleVolatility(args as { from: string; to: string; days?: number });
        break;
      case "optimal_send_window":
        text = await handleOptimalSend(args as { from: string; to: string; days?: number });
        break;
      case "nzd_corridors":
        text = await handleNzdCorridors();
        break;
      case "correlation_analysis":
        text = await handleCorrelation(args as { pair1_from: string; pair1_to: string; pair2_from: string; pair2_to: string; days?: number });
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text", text }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
