import dotenv from "dotenv"
import express from "express"
const app = express();
import {
  ChainhooksClient,
  CHAINHOOKS_BASE_URL,
} from "@hirosystems/chainhooks-client";

app.use(express.json());

const client = new ChainhooksClient({
  baseUrl: CHAINHOOKS_BASE_URL.mainnet,
  apiKey: process.env.HIRO_API_KEY,
});

export async function manageChainhooks() {
  try {
    // Check API status
    const status = await client.getStatus();
    console.log("API Status:", status.status);
    console.log("Server Version:", status.server_version);

    // List all chainhooks
    const { results, total } = await client.getChainhooks({ limit: 50 });
    console.log(`Found ${total} chainhooks`);

    // Get details of first chainhook
    if (results.length > 0) {
      const firstChainhook = await client.getChainhook(results[0].uuid);
      console.log("First chainhook:", firstChainhook.definition.name);
    }
  } catch (error) {
    console.error("Error managing chainhooks:", error);
  }
}

app.get("/", (req, res) => {
  manageChainhooks();
  res.send("ok")
});

app.listen(4000, () => {
  console.log("server running");
});
