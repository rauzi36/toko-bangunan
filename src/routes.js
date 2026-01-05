import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { Product, Order, Admin } from './models.js';

const router = express.Router();

// --- KONFIGURASI UPLOAD (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/'); // Simpan di folder public/uploads
    },
    filename: (req, file, cb) => {
        // Nama file unik: timestamp + nama asli
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware Cek Login Admin
const isAdmin = (req, res, next) => {
    if (req.session.admin) next();
    else res.status(401).json({ error: 'Unauthorized' });
};

// Route Khusus Cek Status Login (Agar tidak merah di console)
router.get('/check-auth', (req, res) => {
    if (req.session.admin) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

// --- PUBLIC ROUTES (Pelanggan) ---
router.get('/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

router.post('/orders', async (req, res) => {
    try {
        const { customerName, whatsapp, address, items, totalPrice } = req.body;
        const newOrder = await Order.create({
            customerName, whatsapp, address, items, totalPrice
        });
        res.json({ success: true, orderId: newOrder._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN ROUTES ---
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.admin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Login gagal' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// --- MANAJEMEN PRODUK (Modified for Upload) ---

// Create Produk (Support Upload & URL)
router.post('/products', isAdmin, upload.single('imageFile'), async (req, res) => {
    try {
        let imageUrl = req.body.imageURL; // Ambil dari input teks URL

        // Jika ada file yang diupload, ganti imageUrl dengan path file
        if (req.file) {
            imageUrl = '/uploads/' + req.file.filename;
        }

        const product = await Product.create({
            name: req.body.name,
            price: req.body.price,
            stock: req.body.stock,
            image: imageUrl // Simpan path atau URL
        });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Produk
router.put('/products/:id', isAdmin, upload.single('imageFile'), async (req, res) => {
    try {
        let updateData = {
            name: req.body.name,
            price: req.body.price,
            stock: req.body.stock
        };

        // Logika Gambar:
        // 1. Jika ada file baru diupload -> Pakai file baru
        // 2. Jika tidak ada file, tapi ada URL text -> Pakai URL text (bisa URL baru atau lama)
        if (req.file) {
            updateData.image = '/uploads/' + req.file.filename;
        } else if (req.body.imageURL) {
            updateData.image = req.body.imageURL;
        }

        await Product.findByIdAndUpdate(req.params.id, updateData);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//Delete Order (Hapus Pesanan)
router.delete('/orders/:id', isAdmin, async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/products/:id', isAdmin, async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Manajemen Pesanan
router.get('/orders', isAdmin, async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
});

router.put('/orders/:id', isAdmin, async (req, res) => {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true });
});

export default router;