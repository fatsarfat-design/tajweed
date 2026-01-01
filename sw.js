/* v20 */
const CACHE = "tajweed-cache-v20";
const ASSETS = ["./","./index.html","./manifest.webmanifest","./sw.js"];

self.addEventListener("install",(event)=>{
  event.waitUntil(caches.open(CACHE).then((c)=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",(event)=>{
  event.waitUntil(
    caches.keys().then((keys)=>Promise.all(keys.map((k)=>k!==CACHE?caches.delete(k):null))).then(()=>self.clients.claim())
  );
});

// Network-first for HTML to avoid stale empty UI after updates
self.addEventListener("fetch",(event)=>{
  const req = event.request;
  const url = new URL(req.url);
  if(req.method!=="GET") return;
  if(url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept")||"";
  const isHTML = accept.includes("text/html") || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
  if(isHTML){
    event.respondWith(
      fetch(req).then((res)=>{ const copy=res.clone(); caches.open(CACHE).then((c)=>c.put(req,copy)); return res; })
        .catch(()=>caches.match(req).then((r)=>r||caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached)=>cached || fetch(req).then((res)=>{ const copy=res.clone(); caches.open(CACHE).then((c)=>c.put(req,copy)); return res; }))
  );
});
