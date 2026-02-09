
const { sequelize } = require('../db/connect');
const Role = require('./roleModel');
const User = require('./userModel');
const Blog = require('./blogModel');
const Contact = require('./contactModel');
const PasswordResetToken = require('./passwordResetTokenModel');
const Testimonial = require('./testimonialModel');
const Training = require('./trainingModel');

// Define Associations

// User - Role (Many-to-One)
User.belongsTo(Role, {
    foreignKey: 'roleId',
    as: 'role'
});
Role.hasMany(User, {
    foreignKey: 'roleId',
    as: 'users'
});

// Blog - User (Many-to-One)
Blog.belongsTo(User, {
    foreignKey: 'authorId',
    as: 'author'
});
User.hasMany(Blog, {
    foreignKey: 'authorId',
    as: 'blogs'
});

// PasswordResetToken - User (Many-to-One)
PasswordResetToken.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});
User.hasMany(PasswordResetToken, {
    foreignKey: 'userId',
    as: 'passwordResetTokens'
});

// Contact - User (Many-to-One, optional)
Contact.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});
User.hasMany(Contact, {
    foreignKey: 'userId',
    as: 'contacts'
});

// Testimonial - User (Many-to-One for createdBy/updatedBy)
Testimonial.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'creator'
});
Testimonial.belongsTo(User, {
    foreignKey: 'updatedBy',
    as: 'updater'
});
User.hasMany(Testimonial, {
    foreignKey: 'createdBy',
    as: 'testimonialsCreated'
});
User.hasMany(Testimonial, {
    foreignKey: 'updatedBy',
    as: 'testimonialsUpdated'
});

// Testimonial - Training (Many-to-One, optional)
Testimonial.belongsTo(Training, {
    foreignKey: 'trainingId',
    as: 'training'
});
Training.hasMany(Testimonial, {
    foreignKey: 'trainingId',
    as: 'testimonials'
});

// Training - User (Many-to-One for createdBy/updatedBy)
Training.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'creator'
});
Training.belongsTo(User, {
    foreignKey: 'updatedBy',
    as: 'updater'
});

module.exports = {
    sequelize,
    Role,
    User,
    Blog,
    Contact,
    PasswordResetToken,
    Testimonial,
    Training,
    // Export Op for queries
    Op: require('sequelize').Op
};


