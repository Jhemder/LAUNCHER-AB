const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const LEGACY_CONFIG_PATH = path.join(__dirname, "launcher.config.json");
const CONFIG_PATH = () => path.join(app.getPath("userData"), "launcher.config.json");
const TRACKING_FILE = ".arbacs-managed-files.json";

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 940,
    minHeight: 640,
    title: "Arbacs Studio",
    backgroundColor: "#050b18",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

async function readConfig({ requireGithub = true } = {}) {
  let config;
  try {
    config = JSON.parse(await fs.readFile(CONFIG_PATH(), "utf8"));
  } catch {
    // Backward compatibility with the config file used by the first prototype.
    try { config = JSON.parse(await fs.readFile(LEGACY_CONFIG_PATH, "utf8")); }
    catch { config = {}; }
  }
  config = {
    githubOwner: "Jhemder",
    githubRepo: "CHAMOsafio",
    minecraftDir: "",
    forgeVersion: "1.19.2-forge-43.5.0",
    serverAddress: "",
    ...config
  };
  if (requireGithub && (!/^[A-Za-z0-9_.-]+$/.test(config.githubOwner || "") || !/^[A-Za-z0-9_.-]+$/.test(config.githubRepo || ""))) {
    throw new Error("Configura tu usuario y repositorio de GitHub en Configuración antes de actualizar.");
  }
  if (typeof config.minecraftDir !== "string" || typeof config.forgeVersion !== "string") {
    throw new Error("La configuración de Minecraft no es válida.");
  }
  return config;
}

ipcMain.handle("launcher:get-config", async () => {
  try {
    const config = await readConfig({ requireGithub: false });
    return { ok: true, config: { ...config, minecraftDir: minecraftDir(config) } };
  } catch (error) { return { ok: false, message: error.message }; }
});

ipcMain.handle("launcher:save-config", async (_event, input) => {
  try {
    if (!input || typeof input !== "object") throw new Error("No se recibieron datos de configuración.");
    const githubOwner = String(input.githubOwner || "").trim();
    const githubRepo = String(input.githubRepo || "").trim();
    const customDir = String(input.minecraftDir || "").trim();
    const forgeVersion = String(input.forgeVersion || "1.19.2-forge-43.5.0").trim();
    const serverAddress = String(input.serverAddress || "").trim();
    if ((githubOwner && !/^[A-Za-z0-9_.-]+$/.test(githubOwner)) || (githubRepo && !/^[A-Za-z0-9_.-]+$/.test(githubRepo))) {
      throw new Error("El usuario y repositorio de GitHub solo pueden contener letras, números, punto, guion y guion bajo.");
    }
    if (!/^[A-Za-z0-9_.+-]+$/.test(forgeVersion)) throw new Error("La versión de Forge contiene caracteres no permitidos.");
    if (serverAddress && !/^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/.test(serverAddress)) throw new Error("La dirección del servidor debe tener el formato host:puerto, sin protocolo.");
    const normalizedDir = customDir ? path.resolve(customDir) : "";
    if (normalizedDir) await fs.mkdir(normalizedDir, { recursive: true });
    const config = { githubOwner, githubRepo, minecraftDir: normalizedDir, forgeVersion, serverAddress };
    await fs.mkdir(path.dirname(CONFIG_PATH()), { recursive: true });
    await fs.writeFile(CONFIG_PATH(), JSON.stringify(config, null, 2), "utf8");
    return { ok: true, config: { ...config, minecraftDir: minecraftDir(config) }, message: "Configuración guardada correctamente." };
  } catch (error) { return { ok: false, message: error.message }; }
});

ipcMain.handle("launcher:choose-minecraft-dir", async () => {
  const result = await dialog.showOpenDialog({ title: "Selecciona la carpeta .minecraft", properties: ["openDirectory", "createDirectory"] });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true, message: "Selección cancelada." };
  return { ok: true, path: result.filePaths[0] };
});

function minecraftDir(config) {
  // On Windows this resolves to %APPDATA%\\.minecraft. A custom path can be set in launcher.config.json.
  return config.minecraftDir ? path.resolve(config.minecraftDir) : path.join(app.getPath("appData"), ".minecraft");
}

function safeRelativePath(input) {
  if (typeof input !== "string" || !input.trim() || path.isAbsolute(input) || input.includes("\\") || input.includes("\0")) {
    throw new Error(`Ruta no válida en el manifiesto: ${String(input)}`);
  }
  const parts = input.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) throw new Error(`Ruta insegura en el manifiesto: ${input}`);
  if (parts[0].toLowerCase() === ".minecraft" || input === TRACKING_FILE) throw new Error(`Ruta reservada en el manifiesto: ${input}`);
  return parts.join(path.sep);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "Accept": "application/vnd.github+json", "User-Agent": "Arbacs-Studio-Launcher" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`GitHub respondió ${response.status}. Comprueba el repositorio y que exista una Release publicada.`);
  return response.json();
}

async function getReleaseAndManifest(config) {
  const api = `https://api.github.com/repos/${encodeURIComponent(config.githubOwner)}/${encodeURIComponent(config.githubRepo)}/releases/latest`;
  const release = await fetchJson(api);
  const manifestAsset = (release.assets || []).find(asset => asset.name === "manifest.json");
  if (!manifestAsset) throw new Error("La última Release no contiene manifest.json como archivo adjunto.");
  const response = await fetch(manifestAsset.browser_download_url, {
    headers: { "User-Agent": "Arbacs-Studio-Launcher" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`No se pudo descargar manifest.json (HTTP ${response.status}).`);
  const manifest = await response.json();
  if (manifest.minecraftVersion !== "1.19.2") throw new Error("El manifiesto no corresponde a Minecraft 1.19.2.");
  if (!Array.isArray(manifest.files)) throw new Error("El manifiesto debe contener una lista files.");
  return { release, manifest };
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const data = await fs.readFile(filePath);
  hash.update(data);
  return hash.digest("hex");
}

async function checkUpdates() {
  const config = await readConfig();
  const { release, manifest } = await getReleaseAndManifest(config);
  const root = minecraftDir(config);
  const plan = [];
  const seen = new Set();
  for (const file of manifest.files) {
    const relative = safeRelativePath(file.path);
    if (seen.has(relative.toLowerCase())) throw new Error(`Ruta duplicada en el manifiesto: ${file.path}`);
    seen.add(relative.toLowerCase());
    if (typeof file.asset !== "string" || !file.asset || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(file.sha256)) {
      throw new Error(`Cada archivo necesita asset y SHA-256 válido: ${file.path}`);
    }
    const asset = (release.assets || []).find(item => item.name === file.asset);
    if (!asset) throw new Error(`No existe el archivo de Release '${file.asset}' para ${file.path}.`);
    const destination = path.join(root, relative);
    let currentHash = "";
    try { currentHash = await sha256File(destination); } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (currentHash.toLowerCase() !== file.sha256.toLowerCase()) plan.push({ file, relative, destination, asset });
  }
  return { config, release, manifest, root, plan };
}

ipcMain.handle("launcher:check-updates", async () => {
  try {
    const result = await checkUpdates();
    if (!result.plan.length) return {
      ok: true, available: false,
      version: result.manifest.version || result.release.tag_name,
      message: `Ya tienes el modpack actualizado (${result.manifest.version || result.release.tag_name}).`
    };
    return {
      ok: true, available: true,
      version: result.manifest.version || result.release.tag_name,
      count: result.plan.length,
      message: `Hay ${result.plan.length} archivo(s) por instalar o actualizar. Pulsa «Actualizar» otra vez para descargarlos.`
    };
  } catch (error) {
    return { ok: false, available: false, message: error.message };
  }
});

ipcMain.handle("launcher:apply-updates", async () => {
  try {
    const result = await checkUpdates();
    if (!result.plan.length) return { ok: true, message: `Todo actualizado: ${result.manifest.version || result.release.tag_name}.` };
    await fs.mkdir(result.root, { recursive: true });
    const installed = [];
    for (const item of result.plan) {
      await fs.mkdir(path.dirname(item.destination), { recursive: true });
      const response = await fetch(item.asset.browser_download_url, {
        headers: { "User-Agent": "Arbacs-Studio-Launcher" },
        signal: AbortSignal.timeout(120000)
      });
      if (!response.ok) throw new Error(`Falló la descarga de ${item.asset.name} (HTTP ${response.status}).`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (item.file.size != null && bytes.length !== item.file.size) throw new Error(`Tamaño inesperado en ${item.file.path}. No se instaló ese archivo.`);
      const hash = crypto.createHash("sha256").update(bytes).digest("hex");
      if (hash.toLowerCase() !== item.file.sha256.toLowerCase()) throw new Error(`SHA-256 incorrecto para ${item.file.path}. El archivo fue rechazado.`);
      const temporary = `${item.destination}.arbacs-tmp`;
      await fs.writeFile(temporary, bytes, { flag: "w" });
      await fs.rename(temporary, item.destination);
      installed.push(item.relative.split(path.sep).join("/"));
    }
    // Track only files this launcher has installed. Obsolete files are deliberately not deleted automatically.
    const trackingPath = path.join(result.root, TRACKING_FILE);
    let old = { files: [] };
    try { old = JSON.parse(await fs.readFile(trackingPath, "utf8")); } catch {}
    const previousFiles = old && Array.isArray(old.files) ? old.files : (Array.isArray(old) ? old : []);
    const merged = [...new Set([...previousFiles, ...installed])];
    await fs.writeFile(trackingPath, JSON.stringify({ version: result.manifest.version || result.release.tag_name, files: merged }, null, 2), "utf8");
    return { ok: true, message: `Actualización instalada: ${result.manifest.version || result.release.tag_name}. Archivos descargados: ${installed.length}. Ya puedes abrir Minecraft.` };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("launcher:play", async () => {
  try {
    const config = await readConfig({ requireGithub: false });
    const root = minecraftDir(config);
    const forgeVersion = config.forgeVersion || "1.19.2-forge-43.5.0";
    const versionJson = path.join(root, "versions", forgeVersion, `${forgeVersion}.json`);
    try { await fs.access(versionJson); } catch {
      return { ok: false, message: `No encuentro el perfil Forge '${forgeVersion}' en ${root}. Instala Forge 1.19.2 con el instalador oficial y vuelve a intentarlo.` };
    }
    // Authentication remains with Microsoft's/Minecraft's official launcher; this app never asks for passwords or tokens.
    await shell.openExternal("minecraft://");
    return { ok: true, message: `Se abrió Minecraft Launcher. Inicia sesión con tu cuenta oficial y selecciona Forge ${forgeVersion}.${config.serverAddress ? ` Luego entra al servidor ${config.serverAddress}.` : " Configura la dirección Playit en Configuración para tenerla a mano."}` };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("launcher:open-mods", async () => {
  try {
    const config = await readConfig({ requireGithub: false });
    const modsPath = path.join(minecraftDir(config), "mods");
    await fs.mkdir(modsPath, { recursive: true });
    const error = await shell.openPath(modsPath);
    return { ok: !error, message: error || `Carpeta de mods abierta: ${modsPath}` };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
