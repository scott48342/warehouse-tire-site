"use client";

import Script from "next/script";

export function Chatwoot() {
  return (
    <Script
      id="chatwoot-widget"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `
          window.chatwootSettings = {
            position: "right",
            type: "standard",
            launcherTitle: "Chat with us"
          };
          (function(d,t) {
            var BASE_URL = "https://chatwoot-web-l388.onrender.com";
            var g = d.createElement(t), s = d.getElementsByTagName(t)[0];
            g.src = BASE_URL + "/packs/js/sdk.js";
            g.defer = true;
            g.async = true;
            s.parentNode.insertBefore(g, s);
            g.onload = function() {
              window.chatwootSDK.run({
                websiteToken: "JeutESWHf6eiJe1WayfrV6jA",
                baseUrl: BASE_URL
              });
            };
          })(document, "script");
        `,
      }}
    />
  );
}
