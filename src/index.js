const express = require("express");
const app = express();
const connectDB = require("./db/connect");
require("dotenv").config();
const cors = require("cors");
const morgan = require("morgan");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const blogRoutes = require("./routes/blogRoutes");
const { errorHandler } = require("./middleware/index");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const seedRoles = require("./utils/seedRoles");
const seedTestimonials = require("./utils/testimonialSeeder");
const trainingRoutes = require("./routes/trainingRoutes");
const testimonialRoutes = require("./routes/testimonialRoutes");

/* =======================
   CORS CONFIGURATION
======================= */

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [
        process.env.FRONTEND_URL,
        "https://istc-xy6v.vercel.app",
        "https://istc-admin.onrender.com",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://istc-o0wxq1al9-dannymyles-projects.vercel.app",
        "https://istc-vercel-app.vercel.app"
      ].filter(Boolean)
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000"
      ];

const corsOptions = {
  origin(origin, callback) {
    if (!origin && process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error(`❌ CORS blocked: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin"
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  optionsSuccessStatus: 204
};

/* =======================
   GLOBAL MIDDLEWARE
======================= */

app.use(cors(corsOptions)); // ✅ handles OPTIONS automatically
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(helmet());

/* =======================
   UPLOADS DIRECTORY
======================= */

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use("/uploads", express.static(uploadDir));

/* =======================
   ROUTES
======================= */

app.get("/", (req, res) => {
  res.json({
    message: "Application up and Running!",
    version: "1.0.0",
    endpoints: {
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      blogs: "/api/v1/blogs",
      trainings: "/api/v1/trainings",
      testimonials: "/api/v1/testimonials"
    }
  });
});

// Public routes
app.use("/api/v1/auth", authRoutes);

// Protected routes
app.use("/api/v1", userRoutes);
app.use("/api/v1/blogs", blogRoutes);
app.use("/api/v1/trainings", trainingRoutes);
app.use("/api/v1/testimonials", testimonialRoutes);

/* =======================
   ERROR HANDLING
======================= */

app.use(errorHandler);

// 404 handler (MUST be last)
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method
  });
});

/* =======================
   SERVER START
======================= */

const port = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ DB Connected Successfully!");

    await seedRoles();
    console.log("✅ Role seeding completed");

    await seedTestimonials();

    app.listen(port, () => {
      console.log(`✅ Server running on Port: ${port}`);
      console.log(`📁 Uploads directory: ${uploadDir}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🌍 Allowed origins: ${allowedOrigins.join(", ")}`);
    });
  } catch (error) {
    console.error("❌ Startup error:", error);
    process.exit(1);
  }
};

startServer();