# Dentia Client

Cliente web de Dentia construido con Vue 3, TypeScript y Vite. El proyecto
tambien incluye una aplicacion de escritorio Electron para Windows.

## Desarrollo web

```bash
npm run dev
```

## Desarrollo de escritorio

Inicia Vite y Electron juntos:

```bash
npm run desktop:dev
```

La ventana de desarrollo usa el cliente local en `http://127.0.0.1:5173`.

## Aplicacion instalada

La version instalada abre `https://dentia-app.me` dentro de una ventana segura
de Electron. El backend y la base de datos siguen alojados en el servidor.

Genera una carpeta ejecutable sin instalador:

```bash
npm run desktop:pack
```

Genera el instalador de Windows:

```bash
npm run desktop:dist
```

Los archivos generados se guardan en `release/`.

Antes de distribuir publicamente el instalador se debe firmar digitalmente el
ejecutable para evitar advertencias de Windows.
