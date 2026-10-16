// Audit des en-têtes de sécurité (SEC-3) — mêmes critères que la note « A » de
// securityheaders.com. Utilisable en module (tests) ou en ligne de commande :
//   node scripts/security-headers.mjs https://focusdeck-one.vercel.app

/**
 * @param {Record<string, string>} headers en-têtes HTTP (noms insensibles à la casse)
 * @returns {string[]} problèmes détectés (vide = conforme)
 */
export function auditSecurityHeaders(headers) {
  const get = (name) => {
    const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
    return entry ? String(entry[1]) : null;
  };
  const problems = [];

  const csp = get('content-security-policy');
  if (!csp) problems.push('Content-Security-Policy absente');
  else {
    const directives = Object.fromEntries(
      csp
        .split(';')
        .map((part) => part.trim().split(/\s+/))
        .filter(([name]) => name)
        .map(([name, ...values]) => [name, values]),
    );
    const scriptSrc = directives['script-src'] ?? directives['default-src'] ?? [];
    if (scriptSrc.length === 0) problems.push('CSP : script-src manquant');
    for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", '*', 'data:', 'http:', 'https:']) {
      if (scriptSrc.includes(unsafe)) problems.push(`CSP : script-src autorise ${unsafe}`);
    }
    if ((directives['style-src'] ?? []).includes("'unsafe-inline'")) problems.push("CSP : style-src autorise 'unsafe-inline'");
    if (!(directives['frame-ancestors'] ?? []).includes("'none'")) problems.push("CSP : frame-ancestors doit valoir 'none'");
    if (!(directives['object-src'] ?? []).includes("'none'")) problems.push("CSP : object-src doit valoir 'none'");
    if (!directives['base-uri']) problems.push('CSP : base-uri manquant');
  }

  const hsts = get('strict-transport-security');
  const maxAge = Number(/max-age=(\d+)/.exec(hsts ?? '')?.[1] ?? 0);
  if (maxAge < 31_536_000) problems.push('HSTS absent ou max-age < 1 an');
  if (hsts && !/includesubdomains/i.test(hsts)) problems.push('HSTS sans includeSubDomains');

  if (get('x-content-type-options')?.toLowerCase() !== 'nosniff') problems.push('X-Content-Type-Options doit valoir nosniff');
  const referrer = get('referrer-policy');
  if (!referrer || /unsafe-url|no-referrer-when-downgrade/.test(referrer)) problems.push('Referrer-Policy absente ou trop permissive');
  if (!get('permissions-policy')) problems.push('Permissions-Policy absente');
  return problems;
}

// Exécution en ligne de commande : audit d'une URL déployée.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage : node scripts/security-headers.mjs <url>');
    process.exit(2);
  }
  const response = await fetch(url, { redirect: 'follow' });
  const problems = auditSecurityHeaders(Object.fromEntries(response.headers));
  if (problems.length > 0) {
    console.error(`En-têtes non conformes sur ${url} :\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`En-têtes de sécurité conformes sur ${url} (${response.status}).`);
}
