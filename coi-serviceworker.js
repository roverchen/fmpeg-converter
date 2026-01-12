/*! coi-serviceworker v0.1.7 - Modified for Stability */
let coepCredentialless = false;

if (typeof window === 'undefined') {
  // ==========================================
  //  Service Worker 端 (處理 Header 的核心邏輯)
  // ==========================================
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener("message", (ev) => {
    if (!ev.data) {
      return;
    } else if (ev.data.type === "deregister") {
      self.registration.unregister();
      return;
    } else if (ev.data.type === "coepCredentialless") {
      coepCredentialless = ev.data.value;
    }
  });

  self.addEventListener("fetch", function (event) {
    const r = event.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
      return;
    }

    const request = (coepCredentialless && r.mode === "no-cors")
      ? new Request(r, { credentials: "omit" })
      : r;

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
          
          // ★ 關鍵：補上這兩個 Header 讓瀏覽器開啟 SharedArrayBuffer
          newHeaders.set("Cross-Origin-Embedder-Policy",
            coepCredentialless ? "credentialless" : "require-corp"
          );
          if (!newHeaders.get("Cross-Origin-Opener-Policy")) {
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
          }

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => console.error(e))
    );
  });

} else {
  // ==========================================
  //  主執行緒端 (負責註冊 Service Worker)
  // ==========================================
  (() => {
    // 1. 檢查瀏覽器是否支援
    if (window.location.hostname !== 'localhost' && window.location.protocol !== 'https:') {
        console.warn("COOP/COEP Service Worker requires HTTPS or localhost.");
        return;
    }

    if ('serviceWorker' in navigator) {
        // ★ 修改點：直接指定檔名，避免路徑偵測錯誤
        // 請確保 coi-serviceworker.js 檔案放在跟 index.html 同一層
        navigator.serviceWorker.register('./coi-serviceworker.js')
        .then(
          (registration) => {
              console.log("COOP/COEP Service Worker registered", registration.scope);

              // 2. 監聽狀態變化
              registration.addEventListener("updatefound", () => {
                  const newWorker = registration.installing;
                  if (newWorker) {
                    newWorker.addEventListener("statechange", () => {
                        if (newWorker.state === "activated" && !navigator.serviceWorker.controller) {
                            // 如果 SW 啟動了但還沒接管頁面，重新整理
                            console.log("Reloading to enable COOP/COEP...");
                            window.location.reload();
                        }
                    });
                  }
              });

              // 3. 補強檢查：如果已經註冊但 SharedArrayBuffer 還是不能用，嘗試重整
              // 使用 sessionStorage 避免無限迴圈
              if (registration.active && !window.crossOriginIsolated) {
                  if (!sessionStorage.getItem('coiReloaded')) {
                      console.log("Service Worker active but isolation failed. Reloading...");
                      sessionStorage.setItem('coiReloaded', 'true');
                      window.location.reload();
                  } else {
                      console.error("COOP/COEP load failed after reload.");
                  }
              } else {
                  sessionStorage.removeItem('coiReloaded');
              }
          },
          (err) => {
            console.error("COOP/COEP Service Worker failed to register: ", err);
          }
        );
    }
  })();
}
