# Tickets de muestra para pruebas de OCR

Coloca aquí fotos reales de tickets (`.jpg`, `.png`, `.webp`), p. ej. `oxxo-01.jpg`, `pemex-01.jpg`, `restaurante-01.jpg`.

Opcional: junto a cada imagen agrega `<nombre>.expected.json` con los campos que el OCR debe extraer
(cualquier subconjunto del JSON de ticket):

```json
{
  "tienda_nombre": "OXXO",
  "fecha_compra": "2026-10-20",
  "monto_total": 89.5,
  "folio_ticket": "123456",
  "datos_contacto": { "url_portal": "https://www.oxxo.com/facturacion" }
}
```

Correr: `ANTHROPIC_API_KEY=... npm run test:ocr`

> ⚠️ Todo lo que está en `public/` se sirve públicamente por Next.js. Las imágenes de esta carpeta
> están en `.gitignore` (sólo se versiona este README); tapa datos de tarjeta antes de usarlas.
