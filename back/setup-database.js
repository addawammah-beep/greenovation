const { Pool } = require('pg');

const db = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Greenovation',
    password: 'abdo4495',
    port: 5432,
});

async function setupDatabase() {
    try {
        console.log('Setting up database tables...');

        // Create users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                balance DECIMAL(10,2) DEFAULT 0,
                points INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created');

        // Create sellers table
        await db.query(`
            CREATE TABLE IF NOT EXISTS sellers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                registry VARCHAR(255),
                gps POINT,
                points INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Sellers table created');

        // Create collectors table
        await db.query(`
            CREATE TABLE IF NOT EXISTS collectors (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                registry VARCHAR(255),
                gps POINT,
                points INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Collectors table created');
        await db.query('ALTER TABLE collectors ADD COLUMN IF NOT EXISTS age INTEGER');
        await db.query('ALTER TABLE collectors ADD COLUMN IF NOT EXISTS experience_years INTEGER');

        // Create administrator accounts used for seller verification
        await db.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Admins table created');

        // Create requests table
        await db.query(`
            CREATE TABLE IF NOT EXISTS requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                weight DECIMAL(10,2) NOT NULL,
                location VARCHAR(255) NOT NULL,
                description TEXT,
                gps POINT,
                status VARCHAR(50) DEFAULT 'pending',
                collector_id INTEGER REFERENCES collectors(id),
                collector_gps POINT,
                collected_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Requests table created');

        // Create indexes
        await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_collectors_email ON collectors(email)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id)');
        console.log('✅ Indexes created');

        console.log('🎉 Database setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Error setting up database:', error);
    } finally {
        await db.end();
    }
}

setupDatabase();
