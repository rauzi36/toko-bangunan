import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import MongoStore from 'connect-mongo'; // <--- BARU: Import ini
import apiRoutes from './src/routes.js';
import { Admin } from './src/models.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware Dasar
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// PENTING UNTUK VERCEL: Trust Proxy
// Agar cookies tetap aman walaupun lewat server proxy Vercel
app.set('trust proxy', 1);

// --- SETTING SESSION ANTI-LOGOUT ---
app.use(session({
    secret: 'rahasia_toko_bangunan_super_secure',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URI, // Simpan sesi di MongoDB, bukan di RAM
        ttl: 24 * 60 * 60 // Sesi valid selama 1 hari (24 jam)
    }),
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 1 hari
        secure: process.env.NODE_ENV === 'production', // True jika di Vercel (HTTPS)
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Agar cookie tidak diblokir browser
    }
}));

// --- KONEKSI DATABASE ---
const connectDB = async () => {
    if (mongoose.connections[0].readyState) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');
        
        // Buat Admin Default jika belum ada
        const exist = await Admin.findOne({ username: 'admin' });
        if (!exist) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({ username: 'admin', password: hashedPassword });
            console.log('👤 Default Admin Created');
        }
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
    }
};
connectDB();

// Routes
app.use('/api', apiRoutes);
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(process.cwd(), 'public/admin.html')));

const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
}

export default app;