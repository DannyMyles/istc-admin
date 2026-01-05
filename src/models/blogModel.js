const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  excerpt: {
    type: String,
    required: [true, 'Excerpt is required'],
    trim: true,
    maxlength: [300, 'Excerpt cannot be more than 300 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  author: {
    type: String,
    required: [true, 'Author is required'],
    trim: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  image: {
    data: Buffer,
    contentType: String,
    filename: String,
    size: Number
  },
  imageUrl: {
    type: String,
    default: 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0'
  },
  readTime: {
    type: String,
    default: '5 min read'
  },
  featured: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  metaTitle: {
    type: String,
    trim: true
  },
  metaDescription: {
    type: String,
    trim: true,
    maxlength: [160, 'Meta description cannot be more than 160 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate slug from title before saving
blogSchema.pre('save', function() {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
});

// Index for better query performance
blogSchema.index({ title: 'text', excerpt: 'text', content: 'text' });
blogSchema.index({ category: 1 });
blogSchema.index({ featured: 1 });
blogSchema.index({ published: 1 });
blogSchema.index({ createdAt: -1 });

// Virtual for formatted date
blogSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

blogSchema.virtual('hasUploadedImage').get(function() {
  return !!(this.image && this.image.size && this.image.size > 0);
});

// Virtual for image URL - returns either external URL or internal image path
blogSchema.virtual('imageUrlFormatted').get(function() {
  // First check for uploaded image
  if (this.hasUploadedImage) {
    return `/api/v1/blogs/${this._id}/image`;
  }
  
  // Then check for external URL
  if (this.imageUrl && this.imageUrl !== 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0') {
    return this.imageUrl;
  }
  
  // Return default placeholder
  return 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0';
});

// Method to get image info
blogSchema.methods.getImageInfo = function() {
  // Check if we have an uploaded image
  if (this.hasUploadedImage) {
    return {
      hasImage: true,
      contentType: this.image.contentType,
      filename: this.image.filename,
      size: this.image.size,
      url: `/api/v1/blogs/${this._id}/image`,
      type: 'uploaded'
    };
  }
  
  // Check if we have an external image URL
  if (this.imageUrl && this.imageUrl !== 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0') {
    return {
      hasImage: true,
      type: 'external',
      url: this.imageUrl
    };
  }
  
  // Return default placeholder
  return {
    hasImage: false,
    url: 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0'
  };
};

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;