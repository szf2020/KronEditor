import fs   from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const MINGW_DIR = path.join(ROOT, 'src-tauri', 'mingw', 'windows-x64');
const GCC_EXE   = path.join(MINGW_DIR, 'bin', 'gcc.exe');
const TMP_DIR   = path.join(ROOT, 'src-tauri', 'mingw');

if (fs.existsSync(GCC_EXE)) {
    console.log('[download-mingw] MinGW already present, skipping download.');
    process.exit(0);
}

fs.mkdirSync(TMP_DIR, { recursive: true });

/** Fetch JSON from a URL, following redirects. */
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'KronEditor-build' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchJson(res.headers.location).then(resolve, reject);
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`JSON parse error: ${e.message}\n${data.slice(0,200)}`)); }
            });
        }).on('error', reject);
    });
}

console.log('[download-mingw] Querying latest w64devkit release...');
const release = await fetchJson('https://api.github.com/repos/skeeto/w64devkit/releases/latest');
// Prefer .zip, fall back to .7z.exe (v2.x ships as self-extracting 7-zip)
const asset =
    release.assets?.find(a => a.name.match(/^w64devkit-x64.*\.zip$/)) ||
    release.assets?.find(a => a.name.match(/^w64devkit-x64.*\.7z\.exe$/));
if (!asset) {
    console.error('[download-mingw] ERROR: Could not find x64 asset in release:', release.tag_name);
    process.exit(1);
}

const DOWNLOAD_URL = asset.browser_download_url;
const TMP_ZIP      = path.join(TMP_DIR, asset.name);
const EXTRACTED    = path.join(TMP_DIR, 'w64devkit');

console.log(`[download-mingw] Downloading ${asset.name} (${release.tag_name}) ...`);
try {
    execSync(`curl -fL -o "${TMP_ZIP}" "${DOWNLOAD_URL}"`, { stdio: 'inherit' });
} catch {
    execSync(`wget -O "${TMP_ZIP}" "${DOWNLOAD_URL}"`, { stdio: 'inherit' });
}

console.log('[download-mingw] Extracting...');
if (process.platform === 'win32') {
    execSync(
        `powershell -NoProfile -Command "Expand-Archive -Force -Path '${TMP_ZIP}' -DestinationPath '${TMP_DIR}'"`,
        { stdio: 'inherit' }
    );
} else if (asset.name.endsWith('.7z.exe') || asset.name.endsWith('.7z')) {
    // 7-zip SFX or plain 7z archive
    execSync(`7z x "${TMP_ZIP}" -o"${TMP_DIR}" -y`, { stdio: 'inherit' });
} else {
    execSync(`unzip -q "${TMP_ZIP}" -d "${TMP_DIR}"`, { stdio: 'inherit' });
}

if (fs.existsSync(EXTRACTED)) {
    if (fs.existsSync(MINGW_DIR)) fs.rmSync(MINGW_DIR, { recursive: true, force: true });
    fs.renameSync(EXTRACTED, MINGW_DIR);
}

fs.unlinkSync(TMP_ZIP);

if (!fs.existsSync(GCC_EXE)) {
    console.error('[download-mingw] ERROR: gcc.exe not found after extraction.');
    process.exit(1);
}

console.log('[download-mingw] Done:', MINGW_DIR);
