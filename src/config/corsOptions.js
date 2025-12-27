const corsOptions = {
  origin: function(origin, callback) {
    // Check if the origin is allowed (you can perform additional checks if needed)
    if (!origin || whitelist.indexOf(origin) !== -1) {
      // Allow the request
      callback(null, true);
    } else {
      // Block the request
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 
};

module.exports = corsOptions;