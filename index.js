const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();

    const db = client.db("eliteArena");

    // Collections
    const usersCollection = db.collection("users");
    const courtsCollection = db.collection("courts");

    // Add a new user
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.status(201).json(result);
      } catch {
        res.status(500).json({ error: "Failed to create user" });
      }
    });

    // Add a new court
    app.post("/courts", async (req, res) => {
      try {
        console.log("Received court data:", req.body);
        const court = req.body;
        const result = await courtsCollection.insertOne(court);
        console.log("Inserted court:", result.insertedId);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error inserting court:", error);
        res
          .status(500)
          .json({ error: "Failed to create court", details: error.message });
      }
    });

    // Get All Courts
    app.get("/courts", async (req, res) => {
      try {
        const courts = await courtsCollection.find({}).toArray();
        res.status(200).json(courts);
      } catch (error) {
        console.error("Failed to get courts:", error);
        res.status(500).json({ error: "Failed to fetch courts" });
      }
    });

    // Health check endpoint
    app.get("/", (req, res) => {
      res.send("Elite Arena SCMS Backend Running");
    });

    // Start server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed", error);

    // Commented out process.exit to keep server running even if DB connection fails
    // process.exit(1);
  }
}

run();
