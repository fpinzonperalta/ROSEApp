---
name: deploy-web
description: Usar cuando se quiera compilar, exportar o publicar la versión web de ROSEApp (panel Admin y Reporte), o cuando la web falle al refrescar una ruta.
---

# Publicar la versión web

En web solo funcionan Admin y Reporte; Ventas muestra un aviso de "solo móvil".

## 1. Revisar

```bash
npx tsc --noEmit
```

## 2. Exportar

```bash
npm run build:web     # = npx expo export -p web  →  carpeta dist/
```

`app.json` usa `web.output: "static"`, así que genera HTML por ruta.

## 3. Redirects (SPA)

`public/` se copia a `dist/`. La regla `/* /index.html 200` de `public/_redirects` evita el 404 al refrescar una ruta (como `/admin`). Si el refresh falla, confirma que `dist/_redirects` exista.

## 4. Publicar

La web está en **Netlify**:

```bash
npx netlify deploy --dir=dist --prod
```

Publicar es una acción visible: confirma con el usuario antes de correr el comando de producción.

## 5. Verificar

Abrir la URL publicada, entrar a `/admin`, iniciar sesión, refrescar la página (no debe dar 404) y revisar el Reporte de hoy.

## App móvil (referencia)

Builds nativos van por EAS (`eas.json`): `eas build -p android --profile production`.
