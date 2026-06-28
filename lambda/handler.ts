/**
 * AWS Lambda handler — exposes xe-mcp tools as a REST API.
 *
 * Deploy with AWS SAM: sam build && sam deploy
 * Each tool is available at POST /tool/{name} with JSON body matching the tool's input schema.
 *
 * This is a pure Lambda (no VPC, no container) — runs on ARM64 (Graviton2) for cost efficiency.
 */

import { handleGetRate, handleConvert, handleListCurrencies } from "../src/tools/rates.js";
import { handleHistoricalRates, handleVolatility, handleOptimalSend } from "../src/tools/analysis.js";
import { handleNzdCorridors } from "../src/tools/nzd.js";
import { handleCorrelation } from "../src/tools/correlation.js";
import { handleRateAlertCheck } from "../src/tools/alerts.js";
import { handleRateChart } from "../src/tools/chart.js";

interface LambdaEvent {
  pathParameters?: { tool?: string };
  body?: string;
  httpMethod?: string;
}

interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: unknown): LambdaResponse {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): LambdaResponse {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
}

export async function handler(event: LambdaEvent): Promise<LambdaResponse> {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  const tool = event.pathParameters?.tool;
  if (!tool) return err(400, "Missing tool name in path");

  let args: Record<string, unknown> = {};
  if (event.body) {
    try {
      args = JSON.parse(event.body);
    } catch {
      return err(400, "Invalid JSON body");
    }
  }

  try {
    let result: string;

    switch (tool) {
      case "get_rate":
        result = await handleGetRate(args as { from: string; to: string });
        break;
      case "convert":
        result = await handleConvert(args as { from: string; to: string; amount: number });
        break;
      case "list_currencies":
        result = await handleListCurrencies();
        break;
      case "get_historical_rates":
        result = await handleHistoricalRates(args as { from: string; to: string; days?: number });
        break;
      case "volatility_analysis":
        result = await handleVolatility(args as { from: string; to: string; days?: number });
        break;
      case "optimal_send_window":
        result = await handleOptimalSend(args as { from: string; to: string; days?: number });
        break;
      case "nzd_corridors":
        result = await handleNzdCorridors();
        break;
      case "correlation_analysis":
        result = await handleCorrelation(args as { pair1_from: string; pair1_to: string; pair2_from: string; pair2_to: string; days?: number });
        break;
      case "rate_alert_check":
        result = await handleRateAlertCheck(args as { from: string; to: string; threshold: number; direction: "above" | "below" });
        break;
      case "rate_chart":
        result = await handleRateChart(args as { from: string; to: string; days?: number });
        break;
      default:
        return err(404, `Unknown tool: ${tool}. Available: get_rate, convert, list_currencies, get_historical_rates, volatility_analysis, optimal_send_window, nzd_corridors, correlation_analysis, rate_alert_check, rate_chart`);
    }

    return ok({ tool, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(500, message);
  }
}
