/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
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
      ? new Request(r, {
        credentials: "omit",
      })
      : r;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
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
  (() => {
    // You can customize the path to your service worker here
    const src = window.document.currentScript.src; // Defaults to the same folder as this script
    
    const re = /coi-serviceworker\.js$/; // Regex to match the script name
    const swSrc = src.replace(re, 'coi-serviceworker.js'); // Ensure it points to the file

    if (window.location.hostname !== 'localhost' && window.location.protocol !== 'https:') {
        // GitHub Pages always uses https, so this is just a safety check
        console.warn("COOP/COEP Service Worker requires HTTPS or localhost.");
    } else {
         if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(swSrc).then(
              (registration) => {
                  console.log("COOP/COEP Service Worker registered", registration.scope);
                  
                  // If the registration is active, but it's not controlling the page
                  if (registration.active && !navigator.serviceWorker.controller) {
                      window.location.reload();
                  }
              },
              (err) => {
                console.log("COOP/COEP Service Worker failed to register: ", err);
              }
            );
        }
    }
  })();
}
