export function salvarToken(token) {
localStorage.setItem("token", token);
}

export function obterToken() {
return localStorage.getItem("token");
}

export function removerToken() {
localStorage.removeItem("token");
}

export function estaAutenticado() {
return !!obterToken();
}

export function logout() {
removerToken();
window.location.href = "login.html";
}

// Lê o ID do usuário no payload do JWT apenas para separar os rascunhos locais
// por conta. Não é usado para autorização: o backend sempre valida o token.
export function obterIdUsuarioDoToken() {
    try {
        const token = obterToken();

        if (!token) return null;

        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const dados = JSON.parse(atob(payload));
        const id = Number(dados.id);

        return Number.isInteger(id) && id > 0 ? id : null;
    } catch (error) {
        return null;
    }
}
