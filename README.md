# FacturaSmart MX

Plataforma para facturar (CFDI 4.0) cualquier ticket de compra en México con una foto.

1. El usuario sube su **Constancia de Situación Fiscal** (PDF). Claude extrae RFC, nombre, CP y régimen,
   y el nombre se limpia según CFDI 4.0 (MAYÚSCULAS, sin régimen capital).
2. Toma foto del **ticket**. Claude Vision extrae comercio, RFC emisor, fecha, total, folio, código de
   facturación y datos de contacto impresos.
3. El **enrutador** elige el canal: API directa → portal web (RPA) → WhatsApp → email.
4. Un **agente** en segundo plano (BullMQ) envía la solicitud con la foto del ticket y la CSF, y espera la respuesta.
5. Cuando el comercio responde con el **XML/PDF**, se asocia al ticket (incluso si llega dentro de un .zip),
   se valida que el receptor del CFDI sea el RFC del usuario y el ticket pasa a `COMPLETED`.
6. El **dashboard** agrupa por mes, permite descargar XML/PDF y exportar un ZIP + CSV para el contador.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind + shadcn/ui · React Hook Form + Zod · Prisma + PostgreSQL ·
Redis + BullMQ · Claude (`@anthropic-ai/sdk`) · S3-compatible storage · Resend + IMAP · Twilio WhatsApp.

## Estructura

```
prisma/schema.prisma            Modelo: User, TaxProfile, Ticket
src/app/
  actions/parse-csf.ts          Server Action: PDF CSF → datos fiscales
  actions/tax-profile.ts        Guarda el perfil fiscal confirmado
  actions/parse-ticket.ts       Server Action: foto → OCR → Ticket (PENDING)
  actions/request-invoice.ts    Aplica correcciones del usuario y encola
  dashboard/page.tsx            Listado por mes, estados, descargas, exportar ZIP
  perfil/ · tickets/nuevo/      Páginas de CSF y captura de ticket
  api/webhooks/twilio/          Respuestas de WhatsApp (descarga de XML/PDF)
  api/files/[...key]/           Descarga protegida → URL firmada
  api/export/                   ZIP mensual (XML + PDF + resumen.csv)
src/components/
  csf-uploader.tsx              Drag & drop de CSF + formulario de revisión
  ticket-camera.tsx             Cámara (capture=environment) / galería, OCR editable
src/lib/
  sat-cleaner.ts                Limpieza de razón social CFDI 4.0
  sat-catalogs.ts               c_RegimenFiscal, c_UsoCFDI, validación RFC
  ocr/csf.ts · ocr/ticket.ts    Prompts + esquemas de extracción
  ai.ts                         Llamada estructurada a Claude (PDF/imagen → JSON)
  routing-engine.ts             Decide WEB_SCRAPE | WHATSAPP | EMAIL | DIRECT_API
  queue.ts                      Colas BullMQ
  invoice-request.ts            Plantilla formal del mensaje
  invoice-files.ts              Asociación/validación de XML/PDF recibidos
src/workers/
  index.ts                      Proceso de workers (npm run workers)
  dispatcher.ts                 Enruta y re-encola al agente
  email-agent.ts                Resend (salida) + IMAP (entrada)
  whatsapp-agent.ts             Twilio WhatsApp (salida)
tests/                          Vitest: limpiador, enrutador, normalizadores, OCR con muestras
```

## Puesta en marcha

```bash
cp .env.example .env          # llenar credenciales (.env está en .gitignore)
npm install
npm run services              # terminal 1: PostgreSQL + Redis locales (datos en .data/)
npx prisma migrate dev        # aplica migraciones
npm run dev                   # terminal 2: web en http://localhost:3000
npm run workers               # terminal 3: agentes de facturación
```

Requisitos: Node 20+ y `redis-server` en el PATH. `npm run services` usa `embedded-postgres`, así que no
hace falta instalar PostgreSQL ni Docker. En desarrollo `STORAGE_DRIVER=local` guarda los archivos en
`.data/storage`; en producción usa `STORAGE_DRIVER=s3` con un bucket S3-compatible (Supabase Storage, R2 o S3).
`rm -rf .data` reinicia todo el estado local.

### Modo demo (sin API keys)

Con `DEMO_MODE="true"` en `.env` se puede recorrer toda la app: el OCR devuelve datos de ejemplo
(comercios ficticios) y los agentes, en lugar de enviar, simulan que el comercio responde a los pocos
segundos con un CFDI de prueba. La interfaz muestra una etiqueta **DEMO**. Ponlo en `"false"` para usar Claude, Resend y Twilio reales.

### Configuración de canales

- **Email**: `RESEND_*` para enviar; el `replyTo` es `INBOUND_EMAIL_ADDRESS` con plus-addressing
  (`facturas+fs-1a2b3c4d@...`) y el asunto lleva `[FS-1A2B3C4D]`. El listener IMAP usa esa etiqueta
  (o remitente + folio) para asociar la respuesta al ticket. El buzón debe soportar plus-addressing (Gmail, Google Workspace, Fastmail sí).
- **WhatsApp**: en Twilio configura el webhook "A message comes in" a `TWILIO_WEBHOOK_URL`
  (`/api/webhooks/twilio`). WhatsApp sólo permite mensajes libres dentro de una ventana de 24 h; para
  iniciar conversación con un comercio necesitas una plantilla aprobada (`TWILIO_WHATSAPP_CONTENT_SID`).
- **Portal web (RPA) / API directa**: las colas existen y el enrutador ya reconoce portales conocidos
  (`KNOWN_PORTALS` en `routing-engine.ts`), pero los scripts Playwright aún no están implementados.
  Mientras tanto el enrutador cae a WhatsApp/email cuando hay contacto impreso.
- `ENABLED_CHANNELS` controla qué canales puede elegir el enrutador.

## Pruebas

```bash
npm test                                  # unitarias, sin red
ANTHROPIC_API_KEY=... npm run test:ocr    # OCR real contra public/samples/
```

Para la prueba de OCR coloca fotos de tickets en `public/samples/` (ver `public/samples/README.md`
para el formato de `*.expected.json`). Las imágenes de esa carpeta están en `.gitignore`.

## Pendientes antes de producción

- **Autenticación**: `src/lib/session.ts` usa un usuario demo (`DEMO_USER_EMAIL`); reemplazar por NextAuth o Supabase Auth.
- Scripts RPA por portal (Playwright + resolución de captchas).
- `TaxProfile.rfc` es `@unique` global: un mismo RFC no puede estar en dos cuentas (p. ej. contador y cliente).
- `Ticket` no guarda con qué perfil fiscal se solicitó; se usa el perfil predeterminado del usuario.
