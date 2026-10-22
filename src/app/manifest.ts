import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FacturaSmart MX",
    short_name: "FacturaSmart",
    description: "Factura tus tickets de compra con una foto",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
