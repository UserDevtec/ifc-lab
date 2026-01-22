import "./style.css";
import * as OBC from "@thatopen/components";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="app">
    <header class="hero">
      <div>
        <p class="eyebrow">IFC Lab</p>
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
        <h2>Bestanden</h2>
        <div class="panel-actions">
          <label class="file">
            <input id="fileInput" type="file" accept=".ifc,.frag" />
            Kies bestand
          </label>
        </div>
      </div>

      <div class="upload" id="dropZone">
        <strong>Sleep hier een .ifc of .frag</strong>
        <span class="hint">of gebruik de knop hierboven</span>
        <label class="inline-field">
          <input id="autoConvert" type="checkbox" checked />
          Automatisch IFC naar fragment converteren
        </label>
      </div>

      <p class="upload-status" id="statusText">Nog geen bestand geladen.</p>

      <div class="output-cards">
        <div class="stat-card">
          <p class="stat-label">Bronbestand</p>
          <p class="stat-value" id="sourceName">-</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Type</p>
          <p class="stat-value" id="sourceType">-</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Fragment status</p>
          <p class="stat-value" id="fragStatus">Nog niet beschikbaar</p>
          <p class="stat-note" id="fragHint">Laad een IFC om te converteren.</p>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Viewer</h2>
        <span class="hint">Sleep om te draaien, scroll om te zoomen</span>
      </div>
      <div class="viewer-wrap">
        <div id="viewer" class="viewer"></div>
        <div id="viewerOverlay" class="viewer-overlay">
          <span>
            <span class="spinner"></span>
            <span id="overlayText">Wachten op bestand...</span>
          </span>
        </div>
      </div>
    </section>
  </div>
`;

const elements = {
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  statusText: document.getElementById("statusText"),
  sourceName: document.getElementById("sourceName"),
  sourceType: document.getElementById("sourceType"),
  fragStatus: document.getElementById("fragStatus"),
  fragHint: document.getElementById("fragHint"),
  downloadBtn: document.getElementById("downloadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  autoConvert: document.getElementById("autoConvert"),
  overlay: document.getElementById("viewerOverlay"),
  overlayText: document.getElementById("overlayText"),
  viewer: document.getElementById("viewer")
};

const state = {
  fragBuffer: null,
  downloadName: "model.frag",
  sourceName: "-",
  sourceType: "-"
};

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);
const world = worlds.create();

world.scene = new OBC.SimpleScene(components);
world.scene.setup();

world.renderer = new OBC.SimpleRenderer(components, elements.viewer);
world.camera = new OBC.OrthoPerspectiveCamera(components);

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

const setOverlay = (text, busy = false) => {
  elements.overlayText.textContent = text;
  if (busy) {
    elements.overlay.classList.remove("hidden");
  } else {
    elements.overlay.classList.add("hidden");
  }
};

const setStatus = (text) => {
  elements.statusText.textContent = text;
};

const updateStats = () => {
  elements.sourceName.textContent = state.sourceName;
  elements.sourceType.textContent = state.sourceType;

  if (state.fragBuffer) {
    elements.fragStatus.textContent = "Fragment klaar";
    elements.fragHint.textContent = "Je kunt de .frag downloaden of herladen.";
    elements.downloadBtn.disabled = false;
  } else {
    elements.fragStatus.textContent = "Nog niet beschikbaar";
    elements.fragHint.textContent = "Laad een IFC om te converteren.";
    elements.downloadBtn.disabled = true;
  }
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
  setOverlay("Fragment laden...", true);
  setStatus("Fragment wordt geladen.");

  const buffer = await file.arrayBuffer();
  await loadFragBuffer(buffer, "frag");

  state.sourceName = file.name;
  state.sourceType = "Fragment (.frag)";
  state.fragBuffer = buffer;
  state.downloadName = file.name;

  updateStats();
  setStatus("Fragment geladen.");
  setOverlay("Fragment geladen", false);
};

const loadIfcFile = async (file) => {
  await clearModels();
  setOverlay("IFC laden...", true);
  setStatus("IFC wordt geladen.");

  await ensureIfcLoader();

  const buffer = new Uint8Array(await file.arrayBuffer());
  const modelId = `ifc-${Date.now()}`;

  const model = await ifcLoader.load(buffer, true, modelId);

  state.sourceName = file.name;
  state.sourceType = "IFC (.ifc)";
  updateStats();

  if (!elements.autoConvert.checked) {
    setStatus("IFC geladen. Auto-conversie uitgeschakeld.");
    setOverlay("IFC geladen", false);
    return;
  }

  setStatus("IFC geladen. Converteren naar fragments op de achtergrond...");
  setOverlay("Converteer IFC naar fragments...", true);

  const fragBuffer = await model.getBuffer();
  state.fragBuffer = fragBuffer;
  state.downloadName = file.name.replace(/\.ifc$/i, ".frag");

  world.scene.three.remove(model.object);
  await fragments.core.disposeModel(modelId);

  await loadFragBuffer(fragBuffer, "ifc-frag");

  updateStats();
  setStatus("IFC omgezet naar fragments en geladen.");
  setOverlay("Fragments geladen", false);
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
    setOverlay("Laden mislukt", false);
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
  const { dropZone } = elements;

  const setDragging = (dragging) => {
    dropZone.classList.toggle("dragging", dragging);
  };

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    setDragging(true);
  });

  dropZone.addEventListener("dragleave", () => {
    setDragging(false);
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    setDragging(false);
    const [file] = event.dataTransfer.files;
    handleFile(file);
  });
};

setupDropzone();

elements.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  handleFile(file);
});

elements.downloadBtn.addEventListener("click", downloadFrag);
elements.resetBtn.addEventListener("click", resetView);

setOverlay("Wachten op bestand...", true);
updateStats();
