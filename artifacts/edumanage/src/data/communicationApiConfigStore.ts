const STORAGE_KEY = "edumanage-communication-api-config-v1";
const DEFAUT = "https://api-communication.edumanage.sn/api_communication";

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): string {
  if (typeof window === "undefined") return DEFAUT;
  return localStorage.getItem(STORAGE_KEY) ?? DEFAUT;
}

let url = load();

export function subscribeCommunicationApiUrl(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCommunicationApiUrl(): string {
  return url;
}

/** Config pure — aucune passerelle externe réelle n'est appelée par cette application (pas de
 * backend SMS/email) ; ce champ ne sert qu'à conserver l'URL d'un futur point d'intégration,
 * jamais à simuler un envoi qui n'existe pas réellement. */
export function setCommunicationApiUrl(nouvelleUrl: string): void {
  url = nouvelleUrl;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, url);
  }
  notify();
}
