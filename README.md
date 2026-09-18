# EUREKA — Bot de WhatsApp de NODAL (Fase 1)

Fase 1: recibir un mensaje de WhatsApp, responder con IA (Claude) y registrar
datos de prospecto (nombre, tipo de negocio, horario) en un archivo local.
No incluye páginas web, formularios ni panel de administración.

## Requisitos

- Node.js 20+
- Una app de Meta (Facebook Developers) con el producto WhatsApp habilitado
- Una cuenta de Anthropic con acceso a la API

## Correr en local

1. Instala dependencias:

   ```
   npm install
   ```

2. Copia `.env.example` a `.env` y completa los valores:

   ```
   cp .env.example .env
   ```

   - `VERIFY_TOKEN`: una cadena que tú inventas (ej. `nodal-verify-123`). Debe
     coincidir con la que pongas en el panel de Meta.
   - `WHATSAPP_TOKEN`: token de acceso temporal o permanente de la app de
     WhatsApp Cloud API (panel de Meta → WhatsApp → API Setup).
   - `PHONE_NUMBER_ID`: el ID del número de teléfono de prueba/producción
     (mismo panel).
   - `APP_SECRET`: el App Secret de la app de Meta (panel → Configuración
     básica).
   - `ANTHROPIC_API_KEY`: tu API key de Anthropic (console.anthropic.com).
   - `PORT`: puerto local, por ejemplo `3000`.

3. Reemplaza `prompts/system.md` con la personalidad definitiva del bot.

4. Arranca el servidor:

   ```
   npm start
   ```

   Deberías ver: `NODAL bot escuchando en el puerto 3000`.

## Exponer con ngrok

Meta necesita una URL pública HTTPS para llamar a tu webhook. En local, usa
ngrok:

```
ngrok http 3000
```

ngrok te dará una URL como `https://algo-random.ngrok-free.app`. Esa es la
base que usarás en el panel de Meta. La URL cambia cada vez que reinicias
ngrok (a menos que tengas un dominio fijo), así que tendrás que actualizar
la configuración del webhook cada vez.

## Configuración del webhook en el panel de Meta

En **Meta for Developers → tu app → WhatsApp → Configuration → Webhook**:

1. **Callback URL**:

   ```
   https://TU-URL-DE-NGROK.ngrok-free.app/webhook
   ```

2. **Verify token**: exactamente el mismo valor que pusiste en `VERIFY_TOKEN`
   en tu `.env`.

3. Haz clic en **Verify and save**. Meta hará un `GET` a tu webhook con
   `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`; el servidor
   debe responder con el `challenge` en texto plano y status 200 (ya está
   implementado en `routes/webhook.js`).

4. En **Webhook fields**, suscríbete al campo **messages** (necesario para
   recibir mensajes entrantes).

5. Verifica que el **App Secret** que copiaste a tu `.env` es el mismo que
   aparece en el panel — se usa para validar la firma `x-hub-signature-256`
   de cada webhook entrante.

## Estructura

```
index.js              arranque del servidor Express
routes/webhook.js      GET de verificación + POST de mensajes entrantes
lib/signature.js       validación HMAC SHA256 de Meta
lib/whatsapp.js        envío de mensajes vía WhatsApp Cloud API
lib/ai.js              llamada a la API de Anthropic (Claude)
lib/store.js           historial de conversaciones en memoria (TTL 24h)
lib/leads.js           registro de prospectos en leads.jsonl
prompts/system.md      personalidad del bot (system prompt)
```

`leads.jsonl` es un archivo temporal (una línea JSON por dato de prospecto
capturado) que se genera en la raíz del proyecto al recibir el primer lead.
No se versiona en git.
