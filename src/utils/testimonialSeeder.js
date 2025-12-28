const Testimonial = require('../models/testimonialModel');

const seedTestimonials = async () => {
    try {
        const defaultTestimonials = [
            {
                name: 'John Kamau',
                role: 'Safety Manager, BuildRight Construction',
                content: 'ISTC transformed our workplace safety culture. Their practical training approach helped us reduce accidents by 60% in the first year.',
                rating: 5,
                image: 'JK',
                avatarColor: '#3b82f6',
                featured: true,
                approved: true,
                isActive: true
            },
            {
                name: 'Sarah Mwangi',
                role: 'HR Director, Precision Manufacturing',
                content: 'The certification process was smooth and professional. Our team is now better equipped to handle emergencies and compliance requirements.',
                rating: 5,
                image: 'SM',
                avatarColor: '#10b981',
                featured: true,
                approved: true,
                isActive: true
            },
            {
                name: 'David Ochieng',
                role: 'Environmental Officer, GreenTech Solutions',
                content: 'Excellent training facilities and experienced instructors. Highly recommend for corporate safety training programs.',
                rating: 4,
                image: 'DO',
                avatarColor: '#f59e0b',
                featured: true,
                approved: true,
                isActive: true
            },
            {
                name: 'Grace Akinyi',
                role: 'Operations Manager, Swift Logistics',
                content: 'The fire safety training saved us during a recent incident. Our staff responded professionally thanks to ISTC training.',
                rating: 5,
                image: 'GA',
                avatarColor: '#ef4444',
                featured: false,
                approved: true,
                isActive: true
            },
            {
                name: 'Peter Mwiti',
                role: 'Site Supervisor, Urban Developers Ltd',
                content: 'Best construction safety training I have attended. Practical demonstrations made complex concepts easy to understand.',
                rating: 5,
                image: 'PM',
                avatarColor: '#8b5cf6',
                featured: false,
                approved: true,
                isActive: true
            },
            {
                name: 'Lucy Wanjiru',
                role: 'Quality Manager, PharmaCare Kenya',
                content: 'The chemical safety training was comprehensive and met all our regulatory requirements. Excellent service!',
                rating: 4,
                image: 'LW',
                avatarColor: '#06b6d4',
                featured: false,
                approved: true,
                isActive: true
            },
            {
                name: 'James Kibet',
                role: 'CEO, SecureTech Systems',
                content: 'We have trained all our security staff with ISTC. Their professionalism and expertise are unmatched.',
                rating: 5,
                image: 'JK',
                avatarColor: '#84cc16',
                featured: false,
                approved: true,
                isActive: true
            },
            {
                name: 'Maryanne Kariuki',
                role: 'Safety Officer, PowerGrid Kenya',
                content: 'The electrical safety course was exactly what our technicians needed. Practical sessions were particularly valuable.',
                rating: 5,
                image: 'MK',
                avatarColor: '#f97316',
                featured: false,
                approved: true,
                isActive: true
            },
            {
                name: 'Robert Mutiso',
                role: 'Facilities Manager, Mega Mall Complex',
                content: 'Regular safety audits by ISTC have helped us maintain our safety standards consistently.',
                rating: 4,
                image: 'RM',
                avatarColor: '#ec4899',
                featured: false,
                approved: true,
                isActive: true
            }
        ];

        let createdCount = 0;
        let skippedCount = 0;

        // Check if any testimonials already exist
        const existingCount = await Testimonial.countDocuments();
        if (existingCount > 0) {
            console.log('⏭️  Testimonials already exist, skipping seeding');
            return { createdCount: 0, skippedCount: defaultTestimonials.length };
        }

        console.log('🌱 Seeding testimonials...');

        for (const testimonialData of defaultTestimonials) {
            try {
                // Create testimonial directly without checking for duplicates
                const testimonial = new Testimonial(testimonialData);
                await testimonial.save();
                createdCount++;
                console.log(`✅ Created testimonial: ${testimonialData.name}`);
            } catch (error) {
                // If error is duplicate key, skip it
                if (error.code === 11000) {
                    skippedCount++;
                    console.log(`⏭️  Skipped duplicate testimonial: ${testimonialData.name}`);
                } else {
                    console.error(`❌ Error creating testimonial ${testimonialData.name}:`, error.message);
                    throw error;
                }
            }
        }
        
        console.log(`✅ Testimonial seeding completed: ${createdCount} created, ${skippedCount} skipped`);
        return { createdCount, skippedCount };
    } catch (error) {
        console.error('❌ Error seeding testimonials:', error);
        throw error;
    }
};

module.exports = seedTestimonials;