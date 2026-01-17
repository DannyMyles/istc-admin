const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [200, "Title cannot be more than 200 characters"],
      unique: true,  // Make title unique
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    targetGroup: {
      type: String,
      required: [true, "Target group is required"],
      trim: true,
    },
    duration: {
      value: {
        type: Number,
        required: [true, "Duration value is required"],
        min: 1,
      },
      unit: {
        type: String,
        enum: ["days", "weeks", "months"],
        default: "days",
      },
      display: {
        type: String,
        required: [true, "Duration display is required"],
        trim: true,
      },
    },
    cost: {
      amount: {
        type: Number,
        required: [true, "Cost amount is required"],
        min: 0,
      },
      currency: {
        type: String,
        default: "KSH",
        uppercase: true,
        trim: true,
      },
      display: {
        type: String,
        required: [true, "Cost display is required"],
        trim: true,
      },
      taxInclusive: {
        type: Boolean,
        default: false,
      },
    },
    sessions: [
      {
        startDate: {
          type: Date,
          required: [true, "Session start date is required"],
        },
        endDate: {
          type: Date,
          required: [true, "Session end date is required"],
        },
        status: {
          type: String,
          enum: ["scheduled", "ongoing", "completed", "cancelled"],
          default: "scheduled",
        },
        seats: {
          total: {
            type: Number,
            default: 20,
            min: 1,
          },
          booked: {
            type: Number,
            default: 0,
            min: 0,
          },
          available: {
            type: Number,
            default: 20,
          },
        },
        venue: {
          type: String,
          trim: true,
          default: "ISTC Training Center",
        },
        instructor: {
          type: String,
          trim: true,
        },
      },
    ],
    category: {
      type: String,
      enum: [
        "safety",
        "health",
        "first-aid",
        "construction",
        "fire-safety",
        "chemical",
        "general",
        "environmental",
        "management",
        "technical",
      ],
      default: "safety",
    },
    modeOfStudy: {
      type: [String],
      enum: [
        "full-time",
        "part-time",
        "distance-learning",
        "online",
        "on-site",
      ],
      default: ["full-time"],
    },
    prerequisites: [
      {
        type: String,
        trim: true,
      },
    ],
    learningOutcomes: [
      {
        type: String,
        trim: true,
      },
    ],
    certification: {
      type: String,
      trim: true,
      default: "Certificate of Completion",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    registrationFee: {
      type: Number,
      default: 1000,
      min: 0,
    },
    requirements: [
      {
        type: String,
        trim: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate code and slug
trainingSchema.pre("save", async function () {
  // Generate slug from title
  if (this.title && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  
  // Generate unique code if it doesn't exist
  if (!this.code && this.title) {
    // Get first letters of words (max 3)
    const words = this.title.split(" ");
    let prefix = "";
    
    if (words.length >= 2) {
      prefix = words
        .map((word) => word.charAt(0).toUpperCase())
        .join("")
        .slice(0, 3);
    } else {
      prefix = this.title.substring(0, 3).toUpperCase();
    }
    
    // Clean prefix (remove special characters)
    prefix = prefix.replace(/[^A-Z]/g, '');
    
    // If prefix is empty, use generic
    if (!prefix) prefix = "TRN";
    
    // Find existing codes with same prefix
    const existing = await this.constructor.find({
      code: new RegExp(`^${prefix}-`),
    });
    
    // Generate next sequential number
    const nextNum = existing.length + 1;
    this.code = `${prefix}-${nextNum.toString().padStart(3, "0")}`;
  }
});

// Update available seats when booking changes
trainingSchema.methods.updateSeats = function (sessionIndex, bookedChange) {
  if (this.sessions[sessionIndex]) {
    this.sessions[sessionIndex].booked += bookedChange;
    this.sessions[sessionIndex].available =
      this.sessions[sessionIndex].total - this.sessions[sessionIndex].booked;
  }
};

// Virtual for formatted dates
trainingSchema.virtual("formattedSessions").get(function () {
  return this.sessions.map((session) => ({
    ...session.toObject(),
    formattedDates: `${this.formatDate(session.startDate)} - ${this.formatDate(session.endDate)}`,
    durationInDays:
      Math.ceil((session.endDate - session.startDate) / (1000 * 60 * 60 * 24)) +
      1,
  }));
});

// Helper method to format date
trainingSchema.methods.formatDate = function (date) {
  if (!date) return "";
  const day = date.getDate();
  const suffix = day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
  const month = date.toLocaleString("en-US", { month: "long" });
  return `${day}${suffix} ${month}`;
};

// Indexes for better query performance
trainingSchema.index({ title: 1 }, { 
  unique: true,
  collation: { locale: 'en', strength: 2 } // Case-insensitive uniqueness
});
trainingSchema.index({ slug: 1 }, { unique: true });
trainingSchema.index({ code: 1 }, { unique: true });
trainingSchema.index({ 
  title: "text", 
  description: "text", 
  targetGroup: "text" 
});
trainingSchema.index({ category: 1 });
trainingSchema.index({ isFeatured: 1 });
trainingSchema.index({ isActive: 1 });
trainingSchema.index({ "sessions.startDate": 1 });
trainingSchema.index({ "sessions.endDate": 1 });

const Training = mongoose.model("Training", trainingSchema);

module.exports = Training;