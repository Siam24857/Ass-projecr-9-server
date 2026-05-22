const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const uri = process.env.MONGO_URL?.replace(/["';]+$/, "");
const clientUrl = process.env.CLIENT_URL || process.env.CLINT_URL;

const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === "production" || isVercel;

if (!uri) {
  console.error("MONGO_URL is missing");
}

// ============= Middleware =============
app.use(cookieParser());
app.use(express.json());

// CORS setup
app.use(
  cors({
    origin: [clientUrl, 'http://localhost:3000', 'http://localhost:3001'].filter(Boolean),
    credentials: true,
  })
);

// ============= Database Connection =============
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (!uri) {
    throw new Error("MONGO_URL is not configured");
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  console.log("🔄 Creating new database connection");
  cachedClient = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    maxPoolSize: 1,
    minPoolSize: 0,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  await cachedClient.connect();
  cachedDb = cachedClient.db("Studing-room");
  
  console.log("✅ New database connection established");
  return { client: cachedClient, db: cachedDb };
}

// ============= Routes =============

// Test route
app.get("/", (req, res) => {
  res.json({ 
    message: "Studying Room API is running!", 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get("/health", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    await db.command({ ping: 1 });
    res.json({ 
      status: "healthy", 
      database: "connected"
    });
  } catch (error) {
    res.status(500).json({ 
      status: "unhealthy", 
      database: "disconnected",
      error: error.message 
    });
  }
});

// Get home rooms (limited to 8)
app.get("/home", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const roomcollection = db.collection("rooms");
    const result = await roomcollection.find().limit(8).toArray();
    return res.json(result);
  } catch (error) {
    console.error("Error in /home:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get all rooms
app.get("/rooms", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const roomcollection = db.collection("rooms");
    const result = await roomcollection.find().toArray();
    return res.json(result);
  } catch (error) {
    console.error("Error in /rooms:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get rooms by amenity
app.get("/rooms/amenity/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();
    const roomcollection = db.collection("rooms");
    const result = await roomcollection
      .find({
        amenities: { $in: [id] },
      })
      .toArray();
    return res.json(result);
  } catch (error) {
    console.error("Error in /rooms/amenity:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Add new room
app.post("/add-rooms", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const roomcollection = db.collection("rooms");
    const result = await roomcollection.insertOne(req.body);
    return res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error("Error in /add-rooms:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get all listed rooms
app.get("/listed-room", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const listedrooms = db.collection("listedrooms");
    const result = await listedrooms.find().toArray();
    return res.json(result);
  } catch (error) {
    console.error("Error in /listed-room:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Add to listed rooms
app.post("/listed-room-add", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const listedrooms = db.collection("listedrooms");
    const result = await listedrooms.insertOne(req.body);
    return res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error("Error in /listed-room-add:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get room details by ID
app.get("/roomdetails/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid room ID format" });
    }

    const { db } = await connectToDatabase();
    const roomcollection = db.collection("rooms");
    const result = await roomcollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error in /roomdetails:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get listed room details by roomID
app.get("/listedroomdetails/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id) 
    
    const { db } = await connectToDatabase();
    const listedrooms = db.collection("listedrooms");
    
    const result = await listedrooms.findOne({
      _id: new ObjectId(id)
    });

    if (!result) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error in /listedroomdetails:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete listed room
app.delete("/listed/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const { db } = await connectToDatabase();
    const listedrooms = db.collection("listedrooms");
    const result = await listedrooms.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Room not found in listed" });
    }

    return res.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Error in /listed/:id:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update listed room
app.patch("/listed/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const listeeddata = req.body;
    const { db } = await connectToDatabase();
    const listedrooms = db.collection("listedrooms");
    const result = await listedrooms.updateOne(
      { _id: new ObjectId(id) },
      { $set: listeeddata }
    );
    return res.send(result);
  } catch (error) {
    console.error("Error in PATCH /listed/:id:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update room
app.patch("/rooms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const listeeddata = req.body;
    const { db } = await connectToDatabase();
    const roomcollection = db.collection("rooms");
    const result = await roomcollection.updateOne(
      { roomID: id },
      { $set: listeeddata }
    );
    return res.send(result);
  } catch (error) {
    console.error("Error in PATCH /rooms/:id:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create booking
app.post("/bookings", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const bookingsroom = db.collection("bookionsroom");
    
    const bookingData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await bookingsroom.insertOne(bookingData);
    return res.json({ success: true, bookingId: result.insertedId });
  } catch (error) {
    console.error("Error in /bookings (POST):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get all bookings
app.get("/bookings", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const bookingsroom = db.collection("bookionsroom");
    const result = await bookingsroom.find().toArray();
    return res.json(result);
  } catch (error) {
    console.error("Error in /bookings (GET):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get bookings by user email
app.get("/bookings/user/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { db } = await connectToDatabase();
    const bookingsroom = db.collection("bookionsroom");
    const result = await bookingsroom.find({ userEmail: email }).toArray();
    return res.json(result);
  } catch (error) {
    console.error("Error in /bookings/user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get user's listed rooms by email
app.get("/my-listrooms/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { db } = await connectToDatabase();
    const listedrooms = db.collection("listedrooms");
    const result = await listedrooms.find({ userEmail: email }).toArray();
    return res.json(result);
  } catch (error) {
    console.error("Error in /my-listrooms/:email:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 404 handler
app.use((req, res) => {
  return res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  return res.status(500).json({ error: "Something went wrong!" });
});

// ============= Server Start =============
if (!isVercel && !isProduction) {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Allowed origins: ${clientUrl || 'http://localhost:3000'}`);
    connectToDatabase().catch(console.error);
  });
}

module.exports = app;