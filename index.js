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

    const usersCollection = db.collection("users");
    const courtsCollection = db.collection("courts");
    const bookingsCollection = db.collection("bookings");

    // Create user
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.status(201).json(result);
      } catch {
        res.status(500).json({ error: "Failed to create user" });
      }
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

    // Get all pending bookings (admin ManageBookings)
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

    // Get all courts
    app.get("/courts", async (req, res) => {
      try {
        const courts = await courtsCollection.find().toArray();
        res.status(200).json(courts);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch courts" });
      }
    });

    // Update booking status (Accept)
    app.patch("/bookings/:id", async (req, res) => {
      const bookingId = req.params.id;
      const { status } = req.body;

      if (!status || !["approved", "pending", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      try {
        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: { status: status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Booking not found" });
        }

        res
          .status(200)
          .json({ message: `Booking status updated to ${status}` });
      } catch (error) {
        res.status(500).json({ error: "Failed to update booking status" });
      }
    });

    // // Delete booking (Reject)
    // app.delete("/bookings/:id", async (req, res) => {
    //   const bookingId = req.params.id;

    //   try {
    //     const result = await bookingsCollection.deleteOne({
    //       _id: new ObjectId(bookingId),
    //     });

    //     if (result.deletedCount === 0) {
    //       return res.status(404).json({ error: "Booking not found" });
    //     }

    //     res.status(200).json({ message: "Booking cancelled successfully" });
    //   } catch (error) {
    //     res.status(500).json({ error: "Failed to cancel booking" });
    //   }
    // });

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
