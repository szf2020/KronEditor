/**
 * HmiExportService – serialises the HMI layout + auth config to the
 * KronHMI XML format consumed by KronServer.
 *
 * Password handling:
 *   Passwords are SHA-256(salt + ":" + password) to match KronServer's
 *   auth.go implementation.  A per-user random hex salt (32 chars = 16 bytes)
 *   is generated once and stored in the user record.
 */

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

/** Encode an ArrayBuffer as a lowercase hex string */
const bufToHex = (buf) =>
    Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

/** Generate a random 16-byte hex salt */
export const generateSalt = () => {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return bufToHex(arr.buffer);
};

/** SHA-256(salt + ":" + password) → hex string */
export const hashPassword = async (salt, password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${password}`);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return bufToHex(hashBuf);
};

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

const escapeXml = (str) =>
    String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Serialise hmiLayout (pages + auth) to a KronHMI XML string.
 *
 * @param {object} hmiLayout  – { pages: [], auth: { users: [], pagePerms: {} } }
 * @returns {string}  XML string ready to POST to KronServer /hmi/deploy
 */
export const exportHmiXml = (hmiLayout) => {
    const { pages = [], auth = {} } = hmiLayout;
    const { users = [], pagePerms = {} } = auth;

    const lines = [];
    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    lines.push(`<KronHMI version="1.0">`);

    // ── Auth ────────────────────────────────────────────────────────────────
    lines.push(`  <Auth>`);
    lines.push(`    <Users>`);
    for (const u of users) {
        lines.push(
            `      <User` +
            ` id="${escapeXml(u.id)}"` +
            ` username="${escapeXml(u.username)}"` +
            ` passwordHash="${escapeXml(u.passwordHash || '')}"` +
            ` salt="${escapeXml(u.salt || '')}"` +
            ` role="${escapeXml(u.role)}"` +
            ` />`
        );
    }
    lines.push(`    </Users>`);

    // Page permissions
    lines.push(`    <Permissions>`);
    for (const [pageId, perm] of Object.entries(pagePerms)) {
        const readRoles  = (perm.readRoles  || ['admin', 'maintainer', 'operator', 'viewer']).join(',');
        const writeRoles = (perm.writeRoles || ['admin', 'maintainer', 'operator']).join(',');
        lines.push(
            `      <Page ref="${escapeXml(pageId)}"` +
            ` readRoles="${escapeXml(readRoles)}"` +
            ` writeRoles="${escapeXml(writeRoles)}" />`
        );
    }
    lines.push(`    </Permissions>`);
    lines.push(`  </Auth>`);

    // ── Pages ───────────────────────────────────────────────────────────────
    lines.push(`  <Pages>`);
    for (const pg of pages) {
        lines.push(
            `    <Page` +
            ` id="${escapeXml(pg.id)}"` +
            ` name="${escapeXml(pg.name)}"` +
            ` canvasW="${pg.canvasW || 1280}"` +
            ` canvasH="${pg.canvasH || 800}"` +
            `>`
        );
        lines.push(`      <Components>`);
        for (const comp of (pg.components || [])) {
            const propsJson = escapeXml(JSON.stringify(comp.props || {}));
            lines.push(
                `        <Component` +
                ` id="${escapeXml(comp.id)}"` +
                ` type="${escapeXml(comp.type)}"` +
                ` x="${comp.x || 0}" y="${comp.y || 0}"` +
                ` w="${comp.w || 60}" h="${comp.h || 60}"` +
                ` props="${propsJson}"` +
                ` />`
            );
        }
        lines.push(`      </Components>`);
        lines.push(`    </Page>`);
    }
    lines.push(`  </Pages>`);
    lines.push(`</KronHMI>`);

    return lines.join('\n');
};

/**
 * Deploy the HMI config to KronServer.
 *
 * @param {string} serverAddr   – e.g. "192.168.1.10:7070"
 * @param {string} xmlContent   – result of exportHmiXml()
 * @returns {Promise<{ok: boolean, pages?: number, error?: string}>}
 */
export const deployHmiToServer = async (serverAddr, xmlContent) => {
    const url = `http://${serverAddr}/hmi/deploy`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xmlContent,
    });
    if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Server returned ${response.status}: ${text}`);
    }
    return response.json();
};
