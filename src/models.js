import mongoose from 'mongoose';

// Skema Produk
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    description: String,
    image: String // URL gambar
});

// Skema Pesanan
const orderSchema = new mongoose.Schema({
    customerName: String,
    whatsapp: String,
    address: String,
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        qty: Number
    }],
    totalPrice: Number,
status: { 
        type: String, 
        enum: ['Menunggu Konfirmasi', 'Diproses', 'Dalam Pengiriman', 'Selesai', 'Dibatalkan'],
        default: 'Menunggu Konfirmasi'
    },
    createdAt: { type: Date, default: Date.now }
});

// Skema Admin
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

export const Product = mongoose.model('Product', productSchema);
export const Order = mongoose.model('Order', orderSchema);
export const Admin = mongoose.model('Admin', adminSchema);