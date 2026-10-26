import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { StoreHydration } from "@/components/store-hydration";
import appCss from "../styles.css?url";

const APP_NAME = "Friendfare";

function shareHost(): string {
  const host = String(import.meta.env.VITE_PUBLIC_HOSTNAME ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
  if (host === "vercel.app" || host.endsWith(".vercel.app") || host === "vercel.com" || host.endsWith(".vercel.com")) return "";
  return host;
}

export const Route = createRootRoute({
  head: () => {
    const host = shareHost();
    const xBanner = host ? `https://${host}/x-banner.jpg` : "";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: APP_NAME },
        { name: "description", content: "Log travel spending with friends and split what is still owed." },
        { name: "theme-color", content: "#f7f3e8" },
        ...(xBanner ? [{ property: "x:game:image", content: xBanner }] : []),
      ],
      links: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "stylesheet", href: appCss },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600&display=swap" },
        { rel: "manifest", href: "/__grok/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      ],
    };
  },
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <StoreHydration />
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
