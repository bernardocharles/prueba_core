import { FileText, Landmark, MapPin, ReceiptText } from "lucide-react";
import { db } from "@/lib/db";
import { regimenLabel, usoCfdiLabel } from "@/lib/sat-catalogs";
import { getCurrentUser } from "@/lib/session";
import { CsfUploader } from "@/components/csf-uploader";
import { IconTile, LargeTitle, Row, Section } from "@/components/ios";

export const dynamic = "force-dynamic";

const fileHref = (key: string) => `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;

export default async function PerfilPage() {
  const user = await getCurrentUser();
  const profile = await db.taxProfile.findFirst({ where: { userId: user.id }, orderBy: { isDefault: "desc" } });

  return (
    <main className="space-y-7">
      <LargeTitle title="Perfil fiscal" subtitle="Los datos con los que pedimos tus facturas" />

      {profile && (
        <>
          {/* Tarjeta estilo Wallet */}
          <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-primary via-primary to-indigo p-5 text-white shadow-xl shadow-primary/20">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-white/5" />
            <p className="text-footnote font-medium uppercase tracking-wider text-white/70">Receptor CFDI 4.0</p>
            <p className="mt-6 text-title-2 leading-tight">{profile.razonSocial}</p>
            <p className="mt-1 font-mono text-body tracking-wider text-white/90">{profile.rfc}</p>
            <div className="mt-6 flex gap-6 text-footnote">
              <div>
                <p className="text-white/60">C.P.</p>
                <p className="font-semibold">{profile.codigoPostal}</p>
              </div>
              <div>
                <p className="text-white/60">Régimen</p>
                <p className="font-semibold">{profile.regimenFiscal}</p>
              </div>
              <div>
                <p className="text-white/60">Uso</p>
                <p className="font-semibold">{profile.usoCFDI}</p>
              </div>
            </div>
          </div>

          <Section header="Detalle">
            <Row leading={<IconTile icon={Landmark} color="indigo" />} title="Régimen fiscal" subtitle={regimenLabel(profile.regimenFiscal)} />
            <Row leading={<IconTile icon={ReceiptText} color="green" />} title="Uso de CFDI" subtitle={usoCfdiLabel(profile.usoCFDI)} />
            <Row leading={<IconTile icon={MapPin} color="orange" />} title="Código postal fiscal" trailing={profile.codigoPostal} />
            {profile.csfPdfUrl && (
              <Row href={fileHref(profile.csfPdfUrl)} external leading={<IconTile icon={FileText} color="red" />} title="Constancia de Situación Fiscal" />
            )}
          </Section>
        </>
      )}

      <CsfUploader hasProfile={Boolean(profile)} />
    </main>
  );
}
