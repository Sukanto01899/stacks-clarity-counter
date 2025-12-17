import express from "express";
import cors from "cors";

const app = express();
const PORT = 3000;

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json());

// --------------------
// Health check
// --------------------
app.get("/", (_, res) => {
  res.send("✅ Chainhook server running");
});

// --------------------
// Chainhook Webhook
// --------------------
app.post("/webhook/chainhook", (req, res) => {
  try {
    const payload = req.body;

    console.log("🔔 Chainhook event received");
    console.log(JSON.stringify(payload, null, 2));

    /**
     * এখানে আপনি যা করতে পারেন:
     * - DB insert
     * - Cache update
     * - Reward logic
     * - Notification
     */

    // Example: contract call detect
    if (payload?.event_type === "contract_call") {
      const fn = payload?.contract_call?.function_name;
      const sender = payload?.contract_call?.sender;

      console.log(`👉 Function called: ${fn}`);
      console.log(`👉 Called by: ${sender}`);
    }

    // Always respond 200 (important)
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ ok: false });
  }
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => {
  console.log(`🚀 Chainhook server listening on http://localhost:${PORT}`);
});
