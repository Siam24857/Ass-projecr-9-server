const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

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
 
const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`))



const Verifiedtoken = async(req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }
    
   try {
     
    const  { payload  } = await jwtVerify(token, JWKS)
    next();
   }
   catch(erroe){
    return res.status(403).json({ error: "Access denied. No token provided." });
   }
}


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

 

 

app.get("/", (req, res) => {
  res.json({ 
    message: "Studying Room API is running!", 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

 



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





app.post("/add-rooms", Verifiedtoken,async (req, res) => {
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





app.get("/listed-room", Verifiedtoken, async (req, res) => {
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




app.post("/listed-room-add", Verifiedtoken,   async (req, res) => {
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




app.get("/roomdetails/:id", Verifiedtoken, async (req, res) => {
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




app.get("/listedroomdetails/:id", Verifiedtoken, async (req, res) => {
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




app.delete("/listed/:id", Verifiedtoken, async (req, res) => {
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




app.patch("/listed/:id", Verifiedtoken, async (req, res) => {
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



 


app.patch("/rooms/:id", Verifiedtoken, async (req, res) => {
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

 


app.post("/bookings", Verifiedtoken, async (req, res) => {
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

 


app.get("/bookings", Verifiedtoken, async (req, res) => {
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
app.delete("/bookings-deleting/:id", Verifiedtoken, async (req, res) => {
  try {

    const { id } =req.params
    const { db } = await connectToDatabase();
    const bookingsroom = db.collection("bookionsroom");
    const result = await bookingsroom.deleteOne({ _id: new ObjectId(id) });
    return res.json(result);
  } catch (error) {
    console.error("Error in /bookings-deleting/:id (DELETE):", error);
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
    console.log(` Server running on http://localhost:${port}`);
   
    connectToDatabase().catch(console.error);
  });
}

module.exports = app;






