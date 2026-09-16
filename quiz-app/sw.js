// Service Worker - 题库大师
const CACHE_NAME = 'quiz-master-v2';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/storage.js',
    './js/parser.js',
    './js/fileparser.js',
    './js/ai.js',
    './js/app.js',
    './js/libs/mammoth.browser.min.js',
    './js/libs/xlsx.full.min.js',
    './js/libs/pdf.min.js',
    './js/libs/pdf.worker.min.js',
    './manifest.json',
    './icons/icon.svg'
];

// 安装 - 缓存资源
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// 激活 - 清理旧缓存
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(name => name !== CACHE_NAME)
                     .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// 拦截请求 - 优先缓存
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) {
                return response;
            }
            return fetch(event.request).then(function(response) {
                // 不缓存非GET请求或跨域请求
                if (!event.request.url.startsWith(self.location.origin) ||
                    event.request.method !== 'GET') {
                    return response;
                }
                // 克隆响应并缓存
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(function() {
                // 离线时的回退
                return caches.match('./index.html');
            });
        })
    );
});
