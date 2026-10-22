/** RFC del receptor dentro del CFDI, o null si el XML no es un CFDI reconocible. */
export function cfdiReceptorRfc(xml: string): string | null {
  if (!/<cfdi:Comprobante\b/.test(xml)) return null;
  const receptor = xml.match(/<cfdi:Receptor\b[^>]*\bRfc="([^"]+)"/);
  return receptor ? receptor[1].toUpperCase() : null;
}
