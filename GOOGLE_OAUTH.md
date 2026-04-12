# Configurar Google OAuth (opcional)

Si quieres usar "Iniciar con Google", sigue estos pasos:

## 1. Google Cloud Console

1. Entra en https://console.cloud.google.com/
2. Crea un proyecto nuevo o selecciona uno existente
3. Ve a **APIs & Services** > **Credentials**

## 2. Pantalla de consentimiento

Si es la primera vez:
- **OAuth consent screen** > **External** > Crear
- Rellena: Nombre de la app, email de soporte
- Guarda

## 3. Crear credenciales

- **Create Credentials** > **OAuth client ID**
- Application type: **Web application**
- Name: Nexora (o el que quieras)
- **Authorized redirect URIs**: añade:
  ```
  http://localhost:8000/api/v1/auth/google/callback
  ```
- Crea y copia el **Client ID** y **Client Secret**

## 4. Añadir al .env

En el archivo `.env` de la raíz del proyecto:

```
GOOGLE_CLIENT_ID=tu-client-id-aqui
GOOGLE_CLIENT_SECRET=tu-client-secret-aqui
```

## 5. Reiniciar el backend

Cierra y vuelve a ejecutar `iniciar.bat`.

---

**Nota:** Sin Google OAuth puedes usar **email y contraseña** para registrarte e iniciar sesión.
