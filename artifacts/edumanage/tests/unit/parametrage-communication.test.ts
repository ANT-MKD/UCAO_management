import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mode base de données : l'onglet « API » décrit l'envoi réel des e-mails (Resend).
vi.mock("@/lib/supabase", async (importOriginal) => ({ ...(await importOriginal<object>()), modeSupabase: true }));

const { default: ParametrageCommunicationPage, EnvoiCourrielsTab } = await import("@/pages/admin/ParametrageCommunicationPage");

describe("paramétrage de la communication, avec la base", () => {
  it("l'onglet s'appelle « Envoi des e-mails », plus « URL API COM »", () => {
    const html = renderToStaticMarkup(createElement(ParametrageCommunicationPage));
    expect(html).toContain("Envoi des e-mails");
    expect(html).not.toContain("URL API COM");
  });

  it("dit où se règle l'envoi et où en lire l'état, sans adresse de passerelle fictive", () => {
    const html = renderToStaticMarkup(createElement(EnvoiCourrielsTab));
    for (const secret of ["RESEND_API_KEY", "EDUMANAGE_ALERTES", "EDUMANAGE_EXPEDITEUR"]) expect(html).toContain(secret);
    expect(html).toContain('href="/admin/security/reinitialisation-donnees"');
    expect(html).toContain("E-mails (Resend)");
    expect(html).toContain("jamais par e-mail");
    expect(html).not.toContain("api-communication.edumanage.sn");
    expect(html).not.toContain("se règlera");
  });
});
