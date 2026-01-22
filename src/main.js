import "./style.css";
import * as OBC from "@thatopen/components";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="app">
    <header class="hero">
      <div>
        <p class="eyebrow">IFCVIEWER LAB</p>
        <h1>IFC & Fragment Viewer</h1>
        <p class="subtitle">
          Laad een .ifc of .frag bestand. Grote IFC's worden automatisch
          op de achtergrond omgezet naar fragments voor snelle weergave.
        </p>
      </div>
      <div class="actions">
        <button class="ghost" id="resetBtn" type="button">Reset view</button>
        <button class="primary" id="downloadBtn" type="button" disabled>
          Download .frag
        </button>
      </div>
    </header>

    <section class="panel">
      <div class="panel-header">
        <div class="viewer-title">
          <h2>Viewer</h2>
          <button class="ghost expand-inline" id="expandBtn" type="button" aria-label="Expand">
            <svg class="expand-icon" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </button>
        </div>
        <span class="hint">Sleep om te draaien, scroll om te zoomen</span>
      </div>
      <div class="viewer-wrap" id="viewerWrap">
        <div id="viewer" class="viewer"></div>
        <div id="viewerOverlay" class="viewer-overlay idle">
          <div class="overlay-idle">
            <p class="overlay-title">Upload bestand of selecteer bestand</p>
            <label class="file">
              <input id="fileInput" type="file" accept=".ifc,.frag" />
              Bestand selecteren
            </label>
            <p class="overlay-hint">Sleep hier een .ifc of .frag bestand.</p>
            <p class="upload-status" id="statusText">Nog geen bestand geladen.</p>
          </div>
          <div class="overlay-busy">
            <span class="spinner"></span>
            <span id="overlayText">Bezig met laden...</span>
          </div>
        </div>
      </div>
    </section>
    <div class="fullscreen-overlay" id="fullscreenOverlay">
      <button class="ghost fullscreen-close" id="closeFullscreen" type="button">Sluiten</button>
    </div>
  </div>
`;

const elements = {
  fileInput: document.getElementById("fileInput"),
  statusText: document.getElementById("statusText"),
  downloadBtn: document.getElementById("downloadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  expandBtn: document.getElementById("expandBtn"),
  closeFullscreen: document.getElementById("closeFullscreen"),
  fullscreenOverlay: document.getElementById("fullscreenOverlay"),
  viewerWrap: document.getElementById("viewerWrap"),
  overlay: document.getElementById("viewerOverlay"),
  overlayText: document.getElementById("overlayText"),
  viewer: document.getElementById("viewer")
};

const state = {
  fragBuffer: null,
  downloadName: "model.frag"
};

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);
const world = worlds.create();

world.scene = new OBC.SimpleScene(components);
world.scene.setup();

world.renderer = new OBC.SimpleRenderer(components, elements.viewer);
world.camera = new OBC.OrthoPerspectiveCamera(components);

world.camera.three.near = 0.05;
world.camera.three.far = 10000;
world.camera.three.updateProjectionMatrix();

world.camera.controls.minDistance = 0.5;
world.camera.controls.maxDistance = 8000;
world.camera.controls.dollySpeed = 2.4;
world.camera.controls.zoomSpeed = 2.0;

await world.camera.controls.setLookAt(18, 12, 18, 0, 0, 0);
components.init();

const fragments = components.get(OBC.FragmentsManager);
fragments.init("/worker.mjs");

world.camera.controls.addEventListener("rest", () => fragments.core.update(true));

fragments.list.onItemSet.add(({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  fragments.core.update(true);
});

const ifcLoader = components.get(OBC.IfcLoader);

const setOverlay = (text, busy = false, show = true) => {
  if (!show) {
    elements.overlay.classList.add("hidden");
    return;
  }

  elements.overlayText.textContent = text;
  elements.overlay.classList.toggle("idle", !busy);
  elements.overlay.classList.toggle("busy", busy);
  elements.overlay.classList.remove("hidden");
};

const setStatus = (text) => {
  elements.statusText.textContent = text;
};

const updateStats = () => {
  elements.downloadBtn.disabled = !state.fragBuffer;
};

const clearModels = async () => {
  for (const [id, model] of fragments.list) {
    world.scene.three.remove(model.object);
    await fragments.core.disposeModel(id);
  }
  state.fragBuffer = null;
  state.downloadName = "model.frag";
  updateStats();
};

const ensureIfcLoader = async () => {
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: "/wasm/",
      absolute: true
    }
  });
};

const loadFragBuffer = async (buffer, name) => {
  const modelId = `${name}-${Date.now()}`;
  await fragments.core.load(buffer, {
    modelId,
    camera: world.camera.three
  });
};

const loadFragFile = async (file) => {
  await clearModels();
  setOverlay("Fragment laden...", true, true);
  setStatus("Fragment wordt geladen.");

  const buffer = await file.arrayBuffer();
  await loadFragBuffer(buffer, "frag");

  state.fragBuffer = buffer;
  state.downloadName = file.name;

  updateStats();
  setStatus("Fragment geladen.");
  setOverlay("", false, false);
};

const loadIfcFile = async (file) => {
  await clearModels();
  setOverlay("IFC laden...", true, true);
  setStatus("IFC wordt geladen.");

  await ensureIfcLoader();

  const buffer = new Uint8Array(await file.arrayBuffer());
  const modelId = `ifc-${Date.now()}`;

  const model = await ifcLoader.load(buffer, true, modelId);

  updateStats();

  setStatus("IFC geladen. Converteren naar fragments op de achtergrond...");
  setOverlay("Converteer IFC naar fragments...", true, true);

  const fragBuffer = await model.getBuffer();
  state.fragBuffer = fragBuffer;
  state.downloadName = file.name.replace(/\.ifc$/i, ".frag");

  world.scene.three.remove(model.object);
  await fragments.core.disposeModel(modelId);

  await loadFragBuffer(fragBuffer, "ifc-frag");

  updateStats();
  setStatus("IFC omgezet naar fragments en geladen.");
  setOverlay("", false, false);
};

const handleFile = async (file) => {
  if (!file) return;

  const extension = file.name.toLowerCase();
  try {
    if (extension.endsWith(".frag")) {
      await loadFragFile(file);
    } else if (extension.endsWith(".ifc")) {
      await loadIfcFile(file);
    } else {
      setStatus("Onbekend bestandstype. Gebruik .ifc of .frag.");
    }
  } catch (error) {
    console.error(error);
    setStatus("Er ging iets mis bij het laden van het bestand.");
    setOverlay("Laden mislukt", false, true);
  }
};

const downloadFrag = () => {
  if (!state.fragBuffer) return;

  const blob = new Blob([state.fragBuffer], {
    type: "application/octet-stream"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const resetView = () => {
  world.camera.controls.setLookAt(18, 12, 18, 0, 0, 0, true);
};

const setupDropzone = () => {
  const { viewerWrap } = elements;

  const setDragging = (dragging) => {
    viewerWrap.classList.toggle("dragging", dragging);
  };

  const onDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => {
    setDragging(false);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const [file] = event.dataTransfer.files;
    handleFile(file);
  };

  viewerWrap.addEventListener("dragover", onDragOver);
  viewerWrap.addEventListener("dragleave", onDragLeave);
  viewerWrap.addEventListener("drop", onDrop);
};

const syncFullscreenState = () => {
  const isFullscreen = document.fullscreenElement === elements.viewerWrap;
  elements.viewerWrap.classList.toggle("fullscreen", isFullscreen);
  elements.fullscreenOverlay.classList.toggle("active", isFullscreen);
  elements.expandBtn.classList.toggle("hidden", isFullscreen);
  document.body.style.overflow = isFullscreen ? "hidden" : "";
  world.renderer.resize();
};

const setFullscreen = async (enabled) => {
  if (enabled && elements.viewerWrap.requestFullscreen) {
    try {
      await elements.viewerWrap.requestFullscreen();
      syncFullscreenState();
      return;
    } catch (error) {
      console.error(error);
    }
  }

  if (!enabled && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
      syncFullscreenState();
      return;
    } catch (error) {
      console.error(error);
    }
  }

  elements.viewerWrap.classList.toggle("fullscreen", enabled);
  elements.fullscreenOverlay.classList.toggle("active", enabled);
  elements.expandBtn.classList.toggle("hidden", enabled);
  document.body.style.overflow = enabled ? "hidden" : "";
  world.renderer.resize();
};

setupDropzone();

elements.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  handleFile(file);
});

elements.downloadBtn.addEventListener("click", downloadFrag);
elements.resetBtn.addEventListener("click", resetView);
elements.expandBtn.addEventListener("click", () => setFullscreen(true));
elements.closeFullscreen.addEventListener("click", () => setFullscreen(false));
elements.fullscreenOverlay.addEventListener("click", (event) => {
  if (event.target === elements.fullscreenOverlay) {
    setFullscreen(false);
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setFullscreen(false);
  }
});
document.addEventListener("fullscreenchange", syncFullscreenState);

setOverlay("Upload bestand of selecteer bestand", false, true);
updateStats();
