export interface ParsedApiError {
  userMessage: string;
  technicalDetails?: string;
  statusCode?: number;
  networkError: boolean;
}

/**
 * Analyse une erreur API et sépare :
 * - `userMessage` : un message clair, poli et en français à afficher à l'utilisateur.
 * - `technicalDetails` : le détail technique pour débogage / log.
 */
export function parseApiError(
  error: unknown,
  fallbackMessage = "Une erreur inattendue est survenue. Veuillez réessayer."
): ParsedApiError {
  // Toujours logger dans la console du navigateur pour que le dev/agent puisse inspecter
  if (typeof window !== "undefined") {
    console.error("[API Error]", error);
  }

  if (!error || typeof error !== "object") {
    return {
      userMessage: fallbackMessage,
      networkError: false,
    };
  }

  const err = error as {
    response?: {
      status?: number;
      data?: {
        message?: string | string[];
        errors?: string[];
        details?: string | string[];
        error?: string;
      };
    };
    message?: string;
    code?: string;
  };

  const status = err.response?.status;
  const isNetworkError =
    !err.response && (err.message === "Network Error" || err.code === "ERR_NETWORK");

  if (isNetworkError) {
    return {
      userMessage:
        "Impossible de contacter le serveur. Vérifiez votre connexion Internet ou réessayez dans un instant.",
      technicalDetails: "Network error: server unreachable or CORS issue",
      networkError: true,
      statusCode: 0,
    };
  }

  const resData = err.response?.data;
  const rawMessage = resData?.message;
  const rawErrors = resData?.errors || resData?.details;

  // Récupérer tous les messages techniques éventuels
  let techDetailsList: string[] = [];
  if (Array.isArray(rawErrors)) {
    techDetailsList = rawErrors.map(String);
  } else if (typeof rawErrors === "string") {
    techDetailsList = [rawErrors];
  } else if (Array.isArray(rawMessage)) {
    techDetailsList = rawMessage.map(String);
  } else if (typeof rawMessage === "string") {
    techDetailsList = [rawMessage];
  }

  const technicalDetails =
    techDetailsList.length > 0 ? techDetailsList.join(" | ") : err.message;

  // Cas spécifique : détection d'une désynchronisation de schéma DTO ("should not exist")
  if (
    technicalDetails &&
    technicalDetails.includes("should not exist")
  ) {
    return {
      userMessage:
        "La version du serveur en production n'est pas encore synchronisée avec cette interface. Veuillez contacter l'administrateur ou patienter pendant le redéploiement.",
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  // Cas 400 Bad Request
  if (status === 400) {
    const userMessage =
      typeof rawMessage === "string" && !rawMessage.toLowerCase().includes("bad request")
        ? rawMessage
        : "Certaines informations saisies sont invalides ou incomplètes.";

    return {
      userMessage,
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  // Cas 401 Non autorisé
  if (status === 401) {
    return {
      userMessage: "Votre session a expiré. Veuillez vous reconnecter.",
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  // Cas 403 Interdit
  if (status === 403) {
    return {
      userMessage:
        (typeof rawMessage === "string" ? rawMessage : null) ||
        "Vous n'avez pas les autorisations nécessaires pour effectuer cette action.",
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  // Cas 404 Non trouvé
  if (status === 404) {
    return {
      userMessage:
        (typeof rawMessage === "string" ? rawMessage : null) ||
        "La ressource demandée est introuvable.",
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  // Cas 409 Conflit (ex: doublon email, téléphone, userId)
  if (status === 409) {
    return {
      userMessage:
        (typeof rawMessage === "string" ? rawMessage : null) ||
        "Cette ressource existe déjà (numéro de téléphone, e-mail ou identifiant déjà utilisé).",
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  // Cas 503 Service Indisponible (ex: lecteur biométrique indisponible)
  if (status === 503) {
    return {
      userMessage:
        (typeof rawMessage === "string" ? rawMessage : null) ||
        "Le service demandé est temporairement indisponible. Veuillez réessayer.",
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  // Cas 500+ Erreur serveur
  if (status && status >= 500) {
    return {
      userMessage:
        "Une erreur est survenue sur le serveur. L'équipe technique a été notifiée.",
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  // Si on a un message textuel direct propre
  if (typeof rawMessage === "string" && rawMessage.trim().length > 0) {
    return {
      userMessage: rawMessage,
      technicalDetails,
      statusCode: status,
      networkError: false,
    };
  }

  return {
    userMessage: fallbackMessage,
    technicalDetails,
    statusCode: status,
    networkError: false,
  };
}
