# IFC Lab Viewer

Vite-app voor het laden van `.ifc` en `.frag` bestanden met That Open Engine.
IFC-bestanden worden na het laden automatisch omgezet naar fragments en direct getoond.
[![Deploy to GitHub Pages](https://github.com/UserDevtec/ifc-lab/actions/workflows/deploy.yml/badge.svg)](https://github.com/UserDevtec/ifc-lab/actions/workflows/deploy.yml)

https://userdevtec.github.io/ifc-lab

<img width="1844" height="1028" alt="image" src="https://github.com/user-attachments/assets/816fbbef-8ebe-444a-ac70-542dfc30a989" />

## Vereisten

- Node.js + npm

## Installatie

```powershell
cd C:\Users\ud38\Desktop\ifc-lab
npm install
```

Kopieer de worker en wasm uit `node_modules` naar `public`:

```powershell
copy C:\Users\ud38\Desktop\ifc-lab\node_modules\@thatopen\fragments\dist\Worker\worker.mjs C:\Users\ud38\Desktop\ifc-lab\public\worker.mjs
copy C:\Users\ud38\Desktop\ifc-lab\node_modules\web-ifc\web-ifc.wasm C:\Users\ud38\Desktop\ifc-lab\public\wasm\web-ifc.wasm
```

## Starten

```powershell
npm run dev
```

Open daarna de URL die Vite laat zien (standaard `http://localhost:5173`).

## Gebruik

- Sleep een `.ifc` of `.frag` bestand in het venster of gebruik de knop.
- Bij `.ifc` wordt automatisch een `.frag` gemaakt op de achtergrond.
- Met **Download .frag** kun je het gegenereerde fragment opslaan.

## Projectstructuur

- `src/main.js`: viewer setup + bestandsworkflow
- `src/style.css`: styling (overgenomen van turtle-lab)
- `public/worker.mjs`: fragments worker
- `public/wasm/web-ifc.wasm`: Web-IFC wasm
