const Role = require('../models/roleModel');

const seedRoles = async () => {
    try {
        const defaultRoles = [
            { name: 'admin', description: 'System administrator with full access', isDefault: true },
            { name: 'user', description: 'Regular user', isDefault: true },
            { name: 'editor', description: 'Content editor', isDefault: false },
            { name: 'viewer', description: 'Read-only access', isDefault: false }
        ];

        for (const roleData of defaultRoles) {
            const roleExists = await Role.findOne({ name: roleData.name });
            if (!roleExists) {
                await Role.create(roleData);
                console.log(`✅ Created role: ${roleData.name}`);
            }
        }
        console.log('✅ Role seeding completed');
    } catch (error) {
        console.error('❌ Error seeding roles:', error);
    }
};

module.exports = seedRoles;