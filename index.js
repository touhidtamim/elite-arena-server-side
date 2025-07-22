const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    await client.connect();

    const db = client.db("eliteArena");

    const usersCollection = db.collection("userscollection");
    const courtsCollection = db.collection("courts");
    const bookingsCollection = db.collection("bookings");

    //  Save or update user (Register or Google Login)
    app.put("/users", async (req, res) => {
      const user = req.body;

      // Optional chaining to prevent crash
      const email = user?.email;
      const name = user?.name;
      const image = user?.image;

      if (!email || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const query = { email };

      try {
        const existingUser = await usersCollection.findOne(query);
        const now = new Date();

        if (existingUser) {
          // Update lastLoggedIn only
          const updateResult = await usersCollection.updateOne(query, {
            $set: { lastLoggedIn: now },
          });

          return res.status(200).json({
            message: "User already exists. Updated lastLoggedIn.",
            updated: true,
            result: updateResult,
          });
        }

        // New user — insert
        const newUser = {
          name,
          email,
          image: image || null,
          role: "user",
          createdAt: now,
          lastLoggedIn: now,
        };

        const result = await usersCollection.insertOne(newUser);
        res.status(201).json({
          message: "User created successfully.",
          inserted: true,
          result,
        });
      } catch (error) {
        res.status(500).json({
          error: "User save failed",
          details: error.message,
        });
      }
    });

    // get users by email for profile
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }
      res.send(user);
    });

    // update profile data
    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const { name, image } = req.body;

      const updateDoc = {
        $set: {},
      };

      if (name) updateDoc.$set.name = name;
      if (image) updateDoc.$set.image = image;

      const result = await usersCollection.updateOne({ email }, updateDoc);

      res.send(result);
    });

    // Create court
    app.post("/courts", async (req, res) => {
      try {
        const court = req.body;
        const result = await courtsCollection.insertOne(court);
        res.status(201).json(result);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to create court", details: error.message });
      }
    });

    // Get all courts
    app.get("/courts", async (req, res) => {
      try {
        const courts = await courtsCollection.find().toArray();
        res.status(200).json(courts);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch courts" });
      }
    });

    // Create booking
    app.post("/bookings", async (req, res) => {
      try {
        const booking = req.body;
        booking.status = "pending"; // enforce status
        booking.createdAt = new Date();

        const result = await bookingsCollection.insertOne(booking);
        res.status(201).json(result);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to create booking", details: error.message });
      }
    });

    // Get all bookings (admin)
    app.get("/bookings", async (req, res) => {
      try {
        const bookings = await bookingsCollection.find().toArray();
        res.status(200).json(bookings);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch bookings" });
      }
    });

    // Get all pending bookings (admin)
    app.get("/bookings/pending", async (req, res) => {
      try {
        const pendingBookings = await bookingsCollection
          .find({ status: "pending" })
          .toArray();
        res.status(200).json(pendingBookings);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending bookings" });
      }
    });

    // Get pending bookings for a specific user
    app.get("/bookings/pending/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        const userPending = await bookingsCollection
          .find({ status: "pending", userId })
          .toArray();
        res.status(200).json(userPending);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to fetch user pending bookings" });
      }
    });

    // Update booking status and promote user to member if approved
    app.patch("/bookings/:id", async (req, res) => {
      const bookingId = req.params.id;
      const { status } = req.body;

      if (!status || !["approved", "pending", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      try {
        // Find the booking first
        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(bookingId),
        });

        if (!booking) {
          return res.status(404).json({ error: "Booking not found" });
        }

        // Update booking status
        const bookingUpdateResult = await bookingsCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: { status } }
        );

        // If approved, promote user to member role
        if (status === "approved") {
          await usersCollection.updateOne(
            { uid: booking.userId }, // user identifier in bookings
            { $set: { role: "member" } }
          );
        }

        res.status(200).json({
          message: `Booking ${status} and user promoted if applicable`,
          bookingUpdateResult,
        });
      } catch (error) {
        res.status(500).json({
          error: "Failed to update booking status",
          details: error.message,
        });
      }
    });

    // Delete booking (reject)
    app.delete("/bookings/:id", async (req, res) => {
      const bookingId = req.params.id;

      try {
        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(bookingId),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Booking not found" });
        }

        res.status(200).json({ message: "Booking cancelled successfully" });
      } catch (error) {
        res.status(500).json({ error: "Failed to cancel booking" });
      }
    });

    // Health check
    app.get("/", (req, res) => {
      res.send("Elite Arena SCMS Backend Running");
    });

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed", error);
  }
}

run();
