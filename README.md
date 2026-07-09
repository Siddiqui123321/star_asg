# Notification System Assessment

This repository contains a Django backend for a notification system that supports:
- WhatsApp sandbox messages via WhatsApp Cloud API
- Email via Postmark
- Browser Web Push via OneSignal
- Admin APIs for triggers, templates, toggle state, and test sends
- Trigger firing from the website for login/logout events

### live URLs:
- Backend (Render): https://star-asg.onrender.com
- Frontend (Vercel): https://star-asg.vercel.app
 - admin login creds:
 - username: admin 
 - pasword: admin

## Backend setup

1. Copy `.env.example` to `.env` and fill in sandbox keys.
2. Install dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```
3. Run migrations:
   ```bash
   python manage.py migrate
   ```
4. Seed default triggers:
   ```bash
   python manage.py seed_notifications
   ```
5. (Optional) create a Django superuser:
   ```bash
   python manage.py createsuperuser
   ```

## Admin API

- `POST /api/admin/login/` returns a token
- `GET /api/admin/triggers/` returns triggers with template rows
- `POST /api/admin/triggers/create/` create a new trigger with default channel templates
- `PATCH /api/admin/templates/<id>/` update template and toggle
- `POST /api/admin/templates/<id>/test/` send a test message
- `POST /api/trigger-fire/` fire a trigger event
- `POST /api/subscribe/` register a browser push subscriber

## Environment variables

Copy `.env.example` to the **project root** (`star_asg/.env`). The backend loads this file automatically.

Use `.env.example` to configure:
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_API_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`, `PHONE_NUMBER_ID`, `TEST_WHATSAPP_RECIPIENT`
- `POSTMARKAPP_TOKEN`, `POSTMARK_FROM_EMAIL`, `TEST_EMAIL_RECIPIENT`
- `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`

## Sandbox setup

### WhatsApp Cloud API
1. Go to https://developers.facebook.com and sign in or create a free account.
2. Create a new app and add the **WhatsApp** product.
3. In the WhatsApp product settings, use the provided **test phone number** and **temporary access token**.
4. Add your own phone number to the WhatsApp sandbox recipient list.
5. Put these values into `.env`:
   ```env
   WHATSAPP_ACCESS_TOKEN=your_test_token
   PHONE_NUMBER_ID=your_test_phone_number_id
   TEST_WHATSAPP_RECIPIENT=whatsapp:+1234567890
   ```
6. Use the test token only for development; it expires often.

### Postmark Email
1. Sign up at https://postmarkapp.com and create a free **Developer Server**.
2. Verify a sender email address in Postmark.
3. Copy the server token.
4. Put these values into `.env`:
   ```env
   POSTMARKAPP_TOKEN=your_server_token
   POSTMARK_FROM_EMAIL=sender@example.com
   TEST_EMAIL_RECIPIENT=recipient@example.com
   ```
5. Use `TEST_EMAIL_RECIPIENT` as the address that receives your test emails.

### OneSignal Web Push
1. Sign up at https://onesignal.com and create a new **Website** app.
2. Enable **Web Push only** and skip Android/iOS.
3. Configure the allowed site origin (for local testing use `http://localhost:5173`).
4. Copy your **App ID** and **REST API Key**.
5. Put these values into `.env`:
   ```env
   ONESIGNAL_APP_ID=your_app_id
   ONESIGNAL_REST_API_KEY=your_rest_api_key
   ```
6. In the browser, click Subscribe to get a OneSignal subscription ID. The app saves it in the backend.

## Frontend setup

1. Change to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend locally:
   ```bash
   npm run dev
   ```

## Next steps
1. Use the admin login to access the admin panel.
2. Edit or create triggers and templates from the admin UI.
3. Subscribe the browser for Web Push and fire login/logout triggers.

## Local testing notes
- Put backend credentials in `star_asg/.env` (repo root), not only inside `NMS/`.
- If PowerShell does not recognize `node` or `npm`, close the terminal and reopen it after Node.js installation.
- If you installed Node.js but the command still fails, run `refreshenv` in PowerShell (if available), or launch a new terminal.
- The frontend uses `VITE_API_URL` and `VITE_ONESIGNAL_APP_ID` from `frontend/.env`.

## Web Push behavior
1. Click the Subscribe button in the website UI.
2. The browser will register with OneSignal and return a subscription ID.
3. The app sends that subscription ID to the backend via `POST /api/subscribe/`.
4. When a trigger fires, the backend uses saved OneSignal subscriber IDs to send browser notifications.
