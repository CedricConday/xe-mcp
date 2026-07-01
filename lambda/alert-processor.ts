/**
 * Alert Processor Lambda
 * Triggered by SQS — sends email notifications via SES when rate alerts fire.
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION });

interface SQSEvent {
  Records: Array<{ body: string }>;
}

interface AlertMessage {
  alertId: string;
  userId: string;
  email: string;
  from: string;
  to: string;
  threshold: number;
  direction: "above" | "below";
  currentRate: number;
  triggeredAt: string;
}

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    const alert = JSON.parse(record.body) as AlertMessage;

    const pair = `${alert.from}/${alert.to}`;
    const condition = `${pair} is ${alert.direction} ${alert.threshold}`;
    const subject = `Rate alert: ${condition}`;
    const body = [
      `Your rate alert has triggered.`,
      ``,
      `Pair:         ${pair}`,
      `Condition:    ${alert.direction} ${alert.threshold}`,
      `Current rate: ${alert.currentRate.toFixed(6)}`,
      `Triggered:    ${alert.triggeredAt}`,
      ``,
      `Powered by xe-mcp — github.com/CedricConday/xe-mcp`,
    ].join("\n");

    await ses.send(
      new SendEmailCommand({
        Source: "alerts@example.com",
        Destination: { ToAddresses: [alert.email] },
        Message: {
          Subject: { Data: subject },
          Body: { Text: { Data: body } },
        },
      })
    );

    console.log(`Sent alert email to ${alert.email} for alert ${alert.alertId}`);
  }
}
