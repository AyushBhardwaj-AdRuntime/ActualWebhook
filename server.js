const express = require("express")
const app = express(
)
app.use(express.json())

app.get("/", (req, res) => {
    res.send("ActualWebhook is running!");
});
 
app.post("/webhook/github", (req, res) => {
    console.log("\n========== WEBHOOK RECEIVED ==========");

    console.log("Event:", req.get("X-GitHub-Event"));
    console.log("Delivery ID:", req.get("X-GitHub-Delivery"));
    console.log("Content Type:", req.get("Content-Type"));

    console.log("\nPayload:");
    console.dir(req.body, { depth: null });

    console.log("\n======================================");

    res.status(200).json({
        received: true
    });
});
 app.listen(3000, () => {
  console.log("Server is running on port 3000")
})