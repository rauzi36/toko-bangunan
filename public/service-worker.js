const CACHE_NAME = 'toko-bangunan-v2'; // Ganti versi biar cache lama terhapus
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Pastikan file gambar ini BENAR-BENAR ADA di folder public. 
  // Jika tidak ada, hapus baris ini atau error akan muncul lagi.
  '/icon-192.png', 
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// 1. Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Membuka cache...');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Gagal cache file statis. Pastikan semua file di urlsToCache ada!', err);
      })
  );
});

// 2. Fetch Data (Network First, lalu Cache, lalu Fallback)
self.addEventListener('fetch', (event) => {
  // Hanya cache request GET (POST/PUT order biar langsung ke server)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Jika online & berhasil, kembalikan respon asli
        return response;
      })
      .catch(() => {
        // Jika offline / error network, cari di cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // PERBAIKAN UTAMA DI SINI:
            // Jika tidak ada di cache juga, jangan return undefined (penyebab error).
            // Berikan halaman offline sederhana.
            return new Response(
                '<body style="font-family:sans-serif; text-align:center; padding-top:50px;">' +
                '<h1>📴 Anda Offline</h1>' +
                '<p>Koneksi internet terputus dan halaman ini belum tersimpan.</p>' +
                '<button onclick="window.location.reload()">Coba Lagi</button>' +
                '</body>', 
                {
                    headers: { 'Content-Type': 'text/html' }
                }
            );
          });
      })
  );
});

// 3. Update Service Worker (Hapus Cache Lama)
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});