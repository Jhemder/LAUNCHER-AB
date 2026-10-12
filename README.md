# Arbacs Studio — CHAMOsafio

Launcher de escritorio para el modpack de Minecraft Java **1.19.2 + Forge**. La configuración inicial apunta a `Jhemder/CHAMOsafio`.

## Qué hace

- Consulta la última GitHub Release pública del repositorio `Jhemder/CHAMOsafio`.
- Lee el archivo adjunto `manifest.json` y comprueba SHA-256 de los archivos gestionados.
- Descarga los mods ausentes o modificados desde los adjuntos de esa Release.
- Permite guardar la carpeta `.minecraft`, el perfil Forge y la dirección de Playit.gg desde Configuración.
- Abre la carpeta `mods` de la ruta configurada.
- El botón Jugar abre Minecraft Launcher oficial; no pide contraseñas ni tokens de Microsoft.

## Importante: usa GitHub Releases para las actualizaciones

Subir un `.jar` a la rama `main` **no** lo hace aparecer en el actualizador actual. El launcher busca `manifest.json` y los archivos como **assets adjuntos a la última GitHub Release**. Mantén el repositorio público para este prototipo.

## Preparar una Release de mods

1. Copia los `.jar` que quieres distribuir a `release-assets/`.
2. Abre PowerShell en la carpeta del proyecto y ejecuta:

   ```powershell
   .\tools\create-manifest.ps1 -ModpackVersion "1.0.0" -ForgeVersion "1.19.2-forge-43.5.0"
   ```

   Cambia la versión de Forge por el perfil exacto instalado en tus PCs si corresponde.
3. Se generará `manifest.json` con el SHA-256 y el tamaño de cada `.jar`.
4. En GitHub abre `Jhemder/CHAMOsafio` → **Releases** → **Draft a new release**.
5. Crea una etiqueta, por ejemplo `v1.0.0`, y adjunta `manifest.json` más **cada `.jar`** de `release-assets/`. El nombre de cada adjunto debe coincidir con `asset` en el manifiesto.
6. Publica la Release. Después, en Arbacs Studio pulsa **Actualizar mods**.
7. Para una actualización, repite el proceso con una versión nueva, por ejemplo `1.0.1`, y publica una nueva Release.

No basta con adjuntar solo `manifest.json`: los mods también tienen que estar adjuntos a esa misma Release.

## Ejecutar el launcher desde el código

Requisitos: Windows 10/11, Node.js LTS, Minecraft Java y Forge instalados previamente.

```bat
npm install
npm run check
npm start
```

## Configuración

La configuración de ejemplo ya contiene `Jhemder/CHAMOsafio`. Si no se ha guardado una configuración local todavía, el launcher también usa esos valores como predeterminados. En **Configuración** puedes seleccionar tu carpeta `.minecraft`, indicar el perfil Forge exacto y guardar la dirección de Playit.gg.

- Carpeta Minecraft por defecto: `%APPDATA%\.minecraft`
- Perfil Forge de ejemplo: `1.19.2-forge-43.5.0`
- Dirección del servidor: solo `host:puerto`, sin `https://` ni `minecraft://`

## Límites actuales

- No instala automáticamente Java, Minecraft ni Forge; deben instalarse una vez en cada equipo.
- Jugar abre el launcher oficial para autenticación y selección del perfil. No inicia directamente la sesión de Microsoft.
- Los archivos antiguos que desaparezcan del manifiesto no se borran automáticamente, para proteger archivos y configuraciones personales. Si quitas un mod, tus amigos deberán retirarlo manualmente por ahora.
- Distribuye solo mods que tengas derecho a compartir y revisa que las versiones sean compatibles con Minecraft 1.19.2 y Forge.
