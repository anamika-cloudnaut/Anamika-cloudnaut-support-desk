# cloudnaut-support-desk-mk1
Cloudnaut Support Desk

## Staff sign-in and access

The app has three roles:

- **Employee:** create tickets and view only tickets submitted with their work email.
- **Support:** view and manage tickets, assign technicians, update status, and add notes.
- **Admin:** all support permissions, plus create staff accounts, change roles, reset passwords, and disable accounts.

Before starting the stack, add a unique signing key to your local `.env` file. This preserves any database settings already there:

```sh
if ! grep -q '^AUTH_SECRET_KEY=' .env 2>/dev/null; then
	printf 'AUTH_SECRET_KEY=%s\n' "$(openssl rand -hex 32)" >> .env
fi
docker compose up -d --build
```

To enable **Forgot password?**, configure SMTP in the same `.env` file before starting the stack:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=support@example.com
FRONTEND_URL=http://localhost:3000
```

Use port `465` for SMTP over SSL; other ports use STARTTLS. The reset link is single-use and expires after 30 minutes. The backend applies the new password-reset table migration automatically when it starts. To apply migrations manually in a running backend container:

```sh
docker compose exec backend alembic -c /app/database/alembic.ini upgrade head
```

Create the first administrator interactively after the services start. The password is prompted securely and must be at least 12 characters:

```sh
docker compose exec backend python -m app.bootstrap_admin --name "Support Admin" --email admin@example.com
```

Sign in at `http://localhost:3000`. After signing in as an administrator, choose **Manage Staff Access** to create employee, support, and additional admin accounts. The backend port is internal to the Compose network; public API requests go through the authenticated API service.
