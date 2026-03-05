import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Product, Order, Admin } from './models.js';

const router = express.Router();

// --- KONFIGURASI UPLOAD (VERCEL FRIENDLY) ---
// Jika di Vercel, gunakan folder /tmp (karena folder lain dikunci/read-only).
// Jika di Laptop (Local), gunakan public/uploads agar gambar tersimpan.
const uploadDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'public/uploads');

// Buat folder jika belum ada
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware Admin
const isAdmin = (req, res, next) => {
    // Cek session (Local) atau header khusus jika mau dikembangkan
    if (req.session.admin) next();
    else res.status(401).json({ error: 'Unauthorized' });
};

// --- PUBLIC API ---

router.get('/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

// 1. BUAT PESANAN (KURANGI STOK & GENERATE RESI)
router.post('/orders', async (req, res) => {
    try {
        const { customerName, whatsapp, address, items, totalPrice } = req.body;
        
        // --- BARU: Generate Resi Acak ---
        // Contoh hasil: MMJ-8374921
        const randomNum = Math.floor(1000000 + Math.random() * 9000000);
        const resi = `MMJ-${randomNum}`;

        // Simpan Pesanan (Tambahkan resi ke dalam database)
        const newOrder = await Order.create({ resi, customerName, whatsapp, address, items, totalPrice });

        // LOGIKA BARU: Kurangi Stok Produk
        for (const item of items) {
            // $inc adalah fitur MongoDB untuk increment/decrement angka
            // stock: -item.qty artinya kurangi stok sebanyak jumlah beli
            await Product.findByIdAndUpdate(item.productId, { 
                $inc: { stock: -item.qty } 
            });
        }

        // Kembalikan orderId dan resi ke frontend
        res.json({ success: true, orderId: newOrder._id, resi: newOrder.resi });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// --- BARU: 2. API UNTUK LACAK PESANAN ---
router.get('/track/:resi', async (req, res) => {
    try {
        // Ambil parameter resi, jadikan huruf besar (antisipasi user ngetik huruf kecil)
        const nomorResi = req.params.resi.toUpperCase();
        
        // Cari pesanan berdasarkan resi
        const order = await Order.findOne({ resi: nomorResi });

        if (!order) {
            return res.status(404).json({ message: 'Nomor resi tidak ditemukan' });
        }

        // Kirim data pesanan yang boleh dilihat pelanggan
        res.json({
            resi: order.resi,
            status: order.status,
            customerName: order.customerName,
            address: order.address,
            totalPrice: order.totalPrice,
            tanggal: order.createdAt
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN API ---

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.admin = true;
        res.json({ success: true });
    } else { res.status(401).json({ success: false }); }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/check-auth', (req, res) => {
    res.json({ loggedIn: !!req.session.admin });
});

// CRUD Produk
router.post('/products', isAdmin, upload.single('imageFile'), async (req, res) => {
    let imageUrl = req.body.imageURL;
    if (req.file) imageUrl = '/uploads/' + req.file.filename;
    
    await Product.create({
        name: req.body.name,
        price: req.body.price,
        stock: req.body.stock,
        image: imageUrl
    });
    res.json({ success: true });
});

// CRUD Produk
router.post('/products', isAdmin, upload.single('imageFile'), async (req, res) => {
    let imageUrl = req.body.imageURL;
    if (req.file) imageUrl = '/uploads/' + req.file.filename;
    
    await Product.create({
        name: req.body.name,
        price: req.body.price,
        stock: req.body.stock,
        description: req.body.description, // --- BARU: Tambah deskripsi ---
        image: imageUrl
    });
    res.json({ success: true });
});

router.put('/products/:id', isAdmin, upload.single('imageFile'), async (req, res) => {
    // --- BARU: Tambah deskripsi ke dalam data update ---
    let updateData = { 
        name: req.body.name, 
        price: req.body.price, 
        stock: req.body.stock,
        description: req.body.description 
    };
    
    if (req.file) updateData.image = '/uploads/' + req.file.filename;
    else if (req.body.imageURL) updateData.image = req.body.imageURL;

    await Product.findByIdAndUpdate(req.params.id, updateData);
    res.json({ success: true });
});

router.delete('/products/:id', isAdmin, async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

router.delete('/products/:id', isAdmin, async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// CRUD Order
router.get('/orders', isAdmin, async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
});

// 2. UPDATE STATUS (BALIKIN STOK JIKA BATAL)
router.put('/orders/:id', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);

        // Jika status sebelumnya BUKAN 'Dibatalkan', tapi sekarang diubah jadi 'Dibatalkan'
        // Maka stok harus dikembalikan (Restock)
        if (status === 'Dibatalkan' && order.status !== 'Dibatalkan') {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.productId, { 
                    $inc: { stock: item.qty } // Tambah stok balik
                });
            }
        }
        
        await Order.findByIdAndUpdate(req.params.id, { status });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. HAPUS PESANAN (BALIKIN STOK SEBELUM HAPUS)
router.delete('/orders/:id', isAdmin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        // Jika pesanan dihapus, stok barang harus dikembalikan
        // KECUALI jika statusnya memang sudah 'Dibatalkan' (karena stoknya sudah balik saat update status)
        if (order && order.status !== 'Dibatalkan') {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.productId, { 
                    $inc: { stock: item.qty } // Tambah stok balik
                });
            }
        }

        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;