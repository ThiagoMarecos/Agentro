# Configuración de Google OAuth para Nexora

## Error: redirect_uri_mismatch

Si ves **"Acceso bloqueado: la solicitud de esta aplicación no es válida"** con **Error 400: redirect_uri_mismatch**, debes añadir la URI de redirección en Google Cloud Console.

## Pasos para solucionar

### 1. Obtener la URI exacta que usa tu backend

Con el backend en marcha, abre en el navegador:

```
http://localhost:8000/api/v1/health/config
```

Verás algo como:

```json
{
  "google_oauth_configured": true,
  "google_redirect_uri": "http://localhost:8000/api/v1/auth/google/callback"
}
```

Copia el valor de `google_redirect_uri`.

### 2. Añadir la URI en Google Cloud Console

1. Entra en [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto (o crea uno)
3. Ve a **APIs y servicios** → **Credenciales**
4. Haz clic en tu **ID de cliente OAuth 2.0** (tipo "Aplicación web")
5. En **URIs de redirección autorizados**, haz clic en **+ AÑADIR URI**
6. Pega exactamente esta URI (o la que te devolvió `/health/config`):

   ```
   http://localhost:8000/api/v1/auth/google/callback
   ```

7. Si accedes también por `127.0.0.1`, añade también:

   ```
   http://127.0.0.1:8000/api/v1/auth/google/callback
   ```

8. Guarda los cambios

### 3. Esperar y probar de nuevo

Los cambios en Google Cloud Console pueden tardar unos minutos en aplicarse. Después, prueba de nuevo "Iniciar sesión con Google".

## Importante

- La URI debe coincidir **exactamente** (incluyendo `http` vs `https`, puerto, mayúsculas/minúsculas)
- No añadas barra final: `.../callback` ✅  `.../callback/` ❌
- Si cambias el puerto del backend (ej. 8001), actualiza la URI en `.env` y en Google Console
