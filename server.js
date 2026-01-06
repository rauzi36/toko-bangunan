import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './src/routes.js';
import { Admin } from './src/models.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(session({
    secret: 'rahasia_toko_bangunan',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- KONEKSI DATABASE (VERCEL OPTIMIZED) ---
const connectDB = async () => {
    if (mongoose.connections[0].readyState) return; // Jika sudah konek, pakai yg lama
    
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');
        
        // Seed Admin (Hanya dijalankan sekali saat koneksi berhasil)
        const exist = await Admin.findOne({ username: 'admin' });
        if (!exist) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({ username: 'admin', password: hashedPassword });
            console.log('👤 Default Admin Created');
        }
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        throw error; // Lempar error agar Vercel tahu
    }
};

// Panggil koneksi (Tapi jangan pakai await di top-level untuk Vercel, biarkan async)
connectDB();

// Routes
app.use('/api', apiRoutes);
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

const PORT = process.env.PORT || 3000;

// Cek apakah jalan di Vercel atau Local
if (process.env.VERCEL) {
    // Di Vercel, kita export app
    // Vercel akan menangani listening port
} else {
    // Di Local, kita listen manual
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
}

export default app;