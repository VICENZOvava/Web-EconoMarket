const API_URL = "http://localhost:3000";

function obterToken() {
    return localStorage.getItem("token");
}

export async function apiRequest(endpoint, options = {}) {
    const token = obterToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });

    let data = null;

    // Respostas 204 não possuem corpo; as demais podem retornar JSON ou texto.
    if (response.status !== 204) {
        const texto = await response.text();

        if (texto) {
            try {
                data = JSON.parse(texto);
            } catch (error) {
                data = { error: texto };
            }
        }
    }

    if (!response.ok) {
        throw new Error(data?.error || "Erro ao realizar requisição");
    }

    return data;
}


// Busca um arquivo binário (ex.: foto de perfil) que exige autenticação.
// Retorna o Blob, ou null quando o recurso não existe (404).
export async function apiRequestBlob(endpoint) {
    const token = obterToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error("Erro ao carregar o arquivo");
    }

    return await response.blob();
}
