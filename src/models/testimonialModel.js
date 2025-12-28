const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    trim: true,
    maxlength: [200, 'Role cannot exceed 200 characters']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [200, 'Company cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Testimonial content is required'],
    trim: true,
    maxlength: [1000, 'Content cannot exceed 1000 characters']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    default: 5
  },
  image: {
    type: String,
    trim: true,
    maxlength: [50, 'Image identifier cannot exceed 50 characters']
  },
  avatarColor: {
    type: String,
    default: '#3b82f6', // Default blue color
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: props => `${props.value} is not a valid hex color!`
    }
  },
  featured: {
    type: Boolean,
    default: false
  },
  approved: {
    type: Boolean,
    default: true // For admin approval
  },
  trainingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Training'
  },
  trainingName: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0 // For manual ordering
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// FIXED: Pre-save hook with async/await pattern
testimonialSchema.pre('save', async function() {
  // Only generate image if not provided
  if (!this.image) {
    const names = this.name.split(' ');
    const initials = names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
    this.image = initials || 'NA';
  }
  
  // Generate random avatar color if not provided
  if (!this.avatarColor) {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
    ];
    this.avatarColor = colors[Math.floor(Math.random() * colors.length)];
  }
  
  // Extract company from role if company not provided
  if (!this.company && this.role && this.role.includes(',')) {
    const parts = this.role.split(',');
    if (parts.length > 1) {
      this.company = parts[1].trim();
    }
  }
});

// FIXED: Virtual for initials
testimonialSchema.virtual('initials').get(function() {
  if (this.image) return this.image;
  
  const names = this.name.split(' ');
  return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
});

// FIXED: Single index definitions (remove duplicate definitions)
testimonialSchema.index({ featured: 1, isActive: 1 });
testimonialSchema.index({ rating: -1 });
testimonialSchema.index({ trainingId: 1 });
testimonialSchema.index({ approved: 1, isActive: 1 });

const Testimonial = mongoose.model('Testimonial', testimonialSchema);

module.exports = Testimonial;