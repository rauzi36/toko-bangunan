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
app.use(express.static('public')); // Serve file frontend static
app.use(session({
    secret: 'rahasia_toko_bangunan',
    resave: false,
    saveUninitialized: false
}));

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:password123#@cluster0.ve4cwnd.mongodb.net/?appName=Cluster0')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error(err));

// Seed Admin (Buat admin default jika belum ada)
const seedAdmin = async () => {
    const exist = await Admin.findOne({ username: 'admin' });
    if (!exist) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await Admin.create({ username: 'admin', password: hashedPassword });
        console.log('👤 Default Admin Created (User: admin, Pass: admin123)');
    }
};
seedAdmin();

// Routes
app.use('/api', apiRoutes);

// Halaman Utama
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

const PORT = process.env.PORT || 3000;

// GANTI BAGIAN app.listen DENGAN INI:
if (process.env.VERCEL) {
    // Jika jalan di Vercel, jangan panggil listen(), tapi export app
} else {
    // Jika jalan di Laptop (Local), panggil listen()
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
};