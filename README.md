# Slotzy (prototype)

## Run locally (recommended)

1. Open the **project root folder** (the folder that contains `index.html`, `css/`, `js/`, `assets/`, `pages/`) in VSCode.
2. Install the VSCode extension **Live Server**.
3. Right‑click **index.html** → **Open with Live Server**.

> If you open only the `pages/` folder as your VSCode workspace, the browser won’t be able to find `../css` and `../js` and you’ll see missing styles / blank app.

## Notes
- This uses `type="module"` scripts, so it must be served over HTTP (Live Server), not opened via `file://`.
