import { describe, expect, it } from "vitest";
import { cleanRazonSocial, stripRegimenCapital } from "@/lib/sat-cleaner";

describe("stripRegimenCapital (CFDI 4.0)", () => {
  it.each([
    ["ABASTECEDORA DIGITAL SA DE CV", "ABASTECEDORA DIGITAL"],
    ["Abastecedora Digital, S.A. de C.V.", "ABASTECEDORA DIGITAL"],
    ["ABASTECEDORA DIGITAL S. A. DE C. V.", "ABASTECEDORA DIGITAL"],
    ["GRUPO INDUSTRIAL DEL NORTE S DE RL DE CV", "GRUPO INDUSTRIAL DEL NORTE"],
    ["Consultores Asociados S. de R.L.", "CONSULTORES ASOCIADOS"],
    ["FINTECH MX SAPI DE CV", "FINTECH MX"],
    ["TIENDAS LA ESQUINA, S.A.", "TIENDAS LA ESQUINA"],
    ["DESPACHO CONTABLE PÉREZ S.C.", "DESPACHO CONTABLE PÉREZ"],
    ["FUNDACIÓN AYUDA A.C.", "FUNDACIÓN AYUDA"],
    ["STARTUP DIGITAL SAS DE CV", "STARTUP DIGITAL"],
    ["ABASTECEDORA DIGITAL SOCIEDAD ANONIMA DE CAPITAL VARIABLE", "ABASTECEDORA DIGITAL"],
    ["  muebles   del   bajío sa de cv  ", "MUEBLES DEL BAJÍO"],
    ["ABASTECEDORA DIGITAL", "ABASTECEDORA DIGITAL"],
  ])("%s → %s", (input, expected) => {
    expect(stripRegimenCapital(input)).toBe(expected);
  });

  it("no corta palabras que sólo terminan en letras de un régimen", () => {
    expect(stripRegimenCapital("COMERCIALIZADORA OASIS")).toBe("COMERCIALIZADORA OASIS");
    expect(stripRegimenCapital("DISCO")).toBe("DISCO");
  });

  it("no deja el nombre vacío si sólo viene el régimen", () => {
    expect(stripRegimenCapital("SA DE CV")).toBe("SA DE CV");
  });
});

describe("cleanRazonSocial", () => {
  it("persona moral (RFC 12): quita régimen", () => {
    expect(cleanRazonSocial("Abastecedora Digital SA de CV", "ADI850101AB1")).toBe("ABASTECEDORA DIGITAL");
  });

  it("persona física (RFC 13): sólo mayúsculas, conserva Ñ y acentos", () => {
    expect(cleanRazonSocial("José Peña Sa", "PESJ800101AB1")).toBe("JOSÉ PEÑA SA");
  });
});
