/**
 * Alert Scheduler Lambda
 * Runs hourly via CloudWatch Events.
 * Scans DynamoDB for configured alerts, checks current rates, publishes triggered alerts to SQS.
 */

import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { ffCurrentRate } from "../src/frankfurter-client.js";
import { convertFrom } from "../src/xe-client.js";

const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
const sqs = new SQSClient({ region: process.env.AWS_REGION });

interface AlertConfig {
  alertId: string;
  userId: string;
  from: string;
  to: string;
  threshold: number;
  direction: "above" | "below";
  email: string;
  active: boolean;
}

async function getCurrentRate(from: string, to: string): Promise<number> {
  if (process.env.XE_ACCOUNT_ID && process.env.XE_API_KEY) {
    const result = await convertFrom(from, [to], 1);
    return result.to[0]?.mid ?? (() => { throw new Error("No rate"); })();
  }
  const { rate } = await ffCurrentRate(from, to);
  return rate;
}

export async function handler(): Promise<void> {
  const table = process.env.ALERTS_TABLE;
  const queueUrl = process.env.ALERT_QUEUE_URL;
  if (!table || !queueUrl) throw new Error("ALERTS_TABLE and ALERT_QUEUE_URL must be set");

  // Scan active alerts
  const { Items = [] } = await ddb.send(
    new ScanCommand({
      TableName: table,
      // `active` is a DynamoDB reserved word — it must be aliased via
      // ExpressionAttributeNames, otherwise the Scan throws on every run and
      // the alert pipeline never fires. See review 2026-06-29.
      FilterExpression: "#active = :t",
      ExpressionAttributeNames: { "#active": "active" },
      ExpressionAttributeValues: { ":t": { BOOL: true } },
    })
  );

  const alerts = Items.map((item) => unmarshall(item) as AlertConfig);
  console.log(`Checking ${alerts.length} active alerts`);

  for (const alert of alerts) {
    try {
      const current = await getCurrentRate(alert.from, alert.to);
      const triggered =
        alert.direction === "above" ? current > alert.threshold : current < alert.threshold;

      if (triggered) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({
              alertId: alert.alertId,
              userId: alert.userId,
              email: alert.email,
              from: alert.from,
              to: alert.to,
              threshold: alert.threshold,
              direction: alert.direction,
              currentRate: current,
              triggeredAt: new Date().toISOString(),
            }),
          })
        );
        console.log(`Alert ${alert.alertId} triggered: ${alert.from}/${alert.to} ${alert.direction} ${alert.threshold} (current: ${current})`);
      }
    } catch (e) {
      console.error(`Failed to check alert ${alert.alertId}:`, e);
    }
  }
}
