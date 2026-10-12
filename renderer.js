const message = document.getElementById("message");
const updateButton = document.getElementById("update");
const playButton = document.getElementById("play");
let updateClickCount = 0;

updateButton.addEventListener("click", async () => {
  updateButton.disabled = true;
  playButton.disabled = true;
  message.textContent = "Conectando con GitHub y comprobando archivos…";
  try {
    const check = await window.arbacs.checkUpdates();
    if (!check.ok) { message.textContent = "No se pudo comprobar: " + check.message; return; }
    if (!check.available) { message.textContent = check.message; return; }
    const confirmed = window.confirm(`${check.message}\n\n¿Quieres descargar e instalar la actualización ${check.version}?`);
    if (!confirmed) { message.textContent = "Actualización cancelada. No se modificaron archivos."; return; }
    message.textContent = `Descargando e instalando ${check.count} archivo(s)… No cierres el launcher.`;
    const result = await window.arbacs.applyUpdates();
    message.textContent = result.message;
  } catch (error) {
    message.textContent = "Error al actualizar: " + error.message;
  } finally {
    updateButton.disabled = false;
    playButton.disabled = false;
  }
});

playButton.addEventListener("click", async () => {
  playButton.disabled = true;
  message.textContent = "Comprobando Forge 1.19.2…";
  try {
    const result = await window.arbacs.play();
    message.textContent = result.message;
  } catch (error) {
    message.textContent = "No se pudo abrir Minecraft: " + error.message;
  } finally { playButton.disabled = false; }
});

document.getElementById("openMods").addEventListener("click", async () => {
  try {
    const result = await window.arbacs.openMods();
    message.textContent = result.message;
  } catch (error) { message.textContent = "No se pudo abrir la carpeta: " + error.message; }
});


// Settings panel: reads and writes configuration through the isolated preload bridge.
const settingsBackdrop = document.getElementById("settingsBackdrop");
const settingsStatus = document.getElementById("settingsStatus");
const settingsFields = ["githubOwner", "githubRepo", "minecraftDir", "forgeVersion", "serverAddress"];
function openSettings() {
  settingsBackdrop.classList.add("open");
  settingsStatus.textContent = "Cargando configuración…";
  window.arbacs.getConfig().then(result => {
    if (!result.ok) { settingsStatus.textContent = result.message; return; }
    for (const key of settingsFields) document.getElementById(key).value = result.config[key] || "";
    settingsStatus.textContent = "Los cambios se guardan en la configuración local de este usuario de Windows.";
  }).catch(error => { settingsStatus.textContent = "No se pudo leer la configuración: " + error.message; });
}
function closeSettings() { settingsBackdrop.classList.remove("open"); }
document.getElementById("settingsNav").addEventListener("click", openSettings);
document.getElementById("settingsNav").addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSettings(); }
});
document.getElementById("cancelSettings").addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", event => { if (event.target === settingsBackdrop) closeSettings(); });
document.getElementById("browseMinecraft").addEventListener("click", async () => {
  settingsStatus.textContent = "Selecciona la carpeta .minecraft en la ventana que se abrirá…";
  try {
    const result = await window.arbacs.chooseMinecraftDir();
    if (result.ok) { document.getElementById("minecraftDir").value = result.path; settingsStatus.textContent = "Carpeta seleccionada. Pulsa Guardar configuración."; }
    else if (!result.canceled) settingsStatus.textContent = result.message;
  } catch (error) { settingsStatus.textContent = "No se pudo seleccionar la carpeta: " + error.message; }
});
document.getElementById("saveSettings").addEventListener("click", async () => {
  const button = document.getElementById("saveSettings");
  const values = Object.fromEntries(settingsFields.map(key => [key, document.getElementById(key).value.trim()]));
  button.disabled = true;
  settingsStatus.textContent = "Guardando…";
  try {
    const result = await window.arbacs.saveConfig(values);
    settingsStatus.textContent = result.message;
    if (result.ok) {
      message.textContent = "Configuración guardada. Carpeta de Minecraft: " + result.config.minecraftDir;
      setTimeout(closeSettings, 700);
    }
  } catch (error) { settingsStatus.textContent = "No se pudo guardar: " + error.message; }
  finally { button.disabled = false; }
});
