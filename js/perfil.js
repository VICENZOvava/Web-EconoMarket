import { apiRequest, apiRequestBlob } from "./api.js";
import { estaAutenticado, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
    if (!estaAutenticado()) {
        window.location.href = "login.html";
        return;
    }

    const form = document.getElementById("perfilForm");
    const mensagem = document.getElementById("mensagem");
    const nome = document.getElementById("nome");
    const email = document.getElementById("email");
    const provedor = document.getElementById("provedor");
    const idUsuario = document.getElementById("idUsuario");
    const avatarInicial = document.getElementById("avatarInicial");
    const avatarImagem = document.getElementById("avatarImagem");
    const fotoPerfil = document.getElementById("fotoPerfil");
    const btnLogout = document.getElementById("btnLogout");
    const linkAdmin = document.getElementById("linkAdmin");

    let usuarioId = null;

    function atualizarInicial(nomeUsuario) {
        avatarInicial.textContent =
            (nomeUsuario || "E").charAt(0).toUpperCase();
    }

    const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
    const TAMANHO_MAXIMO = 2 * 1024 * 1024;
    let urlFotoAtual = null;

    function mostrarFoto(blob) {
        if (urlFotoAtual) {
            URL.revokeObjectURL(urlFotoAtual);
            urlFotoAtual = null;
        }

        if (!blob) {
            avatarImagem.removeAttribute("src");
            avatarImagem.style.display = "none";
            avatarInicial.style.display = "block";
            return;
        }

        urlFotoAtual = URL.createObjectURL(blob);
        avatarImagem.src = urlFotoAtual;
        avatarImagem.style.display = "block";
        avatarInicial.style.display = "none";
    }

    // A foto vem do banco, vinculada ao usuário do token.
    async function carregarFoto(temFoto) {
        if (!temFoto) {
            mostrarFoto(null);
            return;
        }

        try {
            mostrarFoto(await apiRequestBlob("/api/usuarios/me/foto"));
        } catch (error) {
            mostrarFoto(null);
        }
    }

    // Foto antiga guardada só no navegador: é enviada uma vez ao banco e removida do localStorage.
    async function migrarFotoLocal(id) {
        const chave = `profilePhoto_${id}`;
        const fotoLocal = localStorage.getItem(chave);

        if (!fotoLocal) return false;

        try {
            const blob = await (await fetch(fotoLocal)).blob();

            if (!TIPOS_ACEITOS.includes(blob.type) || blob.size > TAMANHO_MAXIMO) {
                localStorage.removeItem(chave);
                return false;
            }

            await enviarFoto(blob);
            localStorage.removeItem(chave);
            return true;
        } catch (error) {
            return false;
        }
    }

    async function enviarFoto(blob) {
        await apiRequest("/api/usuarios/me/foto", {
            method: "PUT",
            headers: { "Content-Type": blob.type },
            body: blob
        });
    }

    function cortarImagem(arquivo) {
        return new Promise((resolve, reject) => {
            const imagem = new Image();
            const urlTemporaria = URL.createObjectURL(arquivo);

            imagem.onload = () => {
                URL.revokeObjectURL(urlTemporaria);

                // Mantém o recorte quadrado central e o redimensionamento para 500x500.
                const tamanho = 500;
                const canvas = document.createElement("canvas");
                const contexto = canvas.getContext("2d");

                canvas.width = tamanho;
                canvas.height = tamanho;

                const menorDimensao = Math.min(imagem.width, imagem.height);
                const x = (imagem.width - menorDimensao) / 2;
                const y = (imagem.height - menorDimensao) / 2;

                contexto.drawImage(
                    imagem, x, y, menorDimensao, menorDimensao, 0, 0, tamanho, tamanho
                );

                canvas.toBlob(
                    blob => blob ? resolve(blob) : reject(new Error("Falha ao processar a imagem.")),
                    "image/jpeg",
                    0.85
                );
            };

            imagem.onerror = () => {
                URL.revokeObjectURL(urlTemporaria);
                reject(new Error("Não foi possível ler a imagem selecionada."));
            };

            imagem.src = urlTemporaria;
        });
    }

    async function salvarFoto(arquivo) {
        if (!arquivo) {
            return;
        }

        if (!TIPOS_ACEITOS.includes(arquivo.type)) {
            mensagem.textContent = "Selecione uma imagem JPEG, PNG ou WebP.";
            return;
        }

        if (arquivo.size > TAMANHO_MAXIMO) {
            mensagem.textContent = "A imagem deve ter no máximo 2 MB.";
            return;
        }

        mensagem.textContent = "Salvando foto...";

        try {
            const blob = await cortarImagem(arquivo);

            await enviarFoto(blob);

            mostrarFoto(blob);
            mensagem.textContent = "Foto de perfil atualizada.";
        } catch (error) {
            mensagem.textContent = error.message || "Não foi possível salvar a foto.";
        } finally {
            fotoPerfil.value = "";
        }
    }

    try {
        const usuario = await apiRequest("/api/auth/me");

        usuarioId = usuario.id;

        nome.value = usuario.nome || "";
        email.value = usuario.email || "";
        provedor.value = usuario.provedor || "LOCAL";
        idUsuario.value = usuario.id;

        if (usuario.papel === "GERENTE") {
            linkAdmin.hidden = false;
        }

        atualizarInicial(usuario.nome);

        let temFoto = usuario.temFoto;

        if (!temFoto) {
            temFoto = await migrarFotoLocal(usuario.id);
        }

        await carregarFoto(temFoto);
    } catch (error) {
        mensagem.textContent = error.message;
        return;
    }

    fotoPerfil.addEventListener("change", () => {
        salvarFoto(fotoPerfil.files[0]);
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!usuarioId) {
            return;
        }

        mensagem.textContent = "Salvando...";

        try {
            const usuario = await apiRequest(
                `/api/usuarios/${usuarioId}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        nome: nome.value.trim(),
                        email: email.value.trim()
                    })
                }
            );

            nome.value = usuario.nome;
            email.value = usuario.email;

            atualizarInicial(usuario.nome);

            mensagem.textContent =
                "Perfil atualizado com sucesso!";
        } catch (error) {
            mensagem.textContent = error.message;
        }
    });

    btnLogout.addEventListener("click", logout);

    iniciarMinhasListas();
});

function iniciarMinhasListas() {
    const container = document.getElementById("listasSalvas");
    const mensagemListas = document.getElementById("mensagemListas");
    const formatoData = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });

    function criarElemento(tag, classe, texto) {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    }

    function criarCartao(lista) {
        const cartao = criarElemento("article", "saved-list-item");
        const info = criarElemento("div", "saved-list-info");
        const meta = criarElemento("div", "saved-list-meta");

        info.appendChild(criarElemento("strong", "", lista.nome));

        const fixa = lista.tipo === "FIXA";
        meta.appendChild(criarElemento("span", `list-badge ${fixa ? "fixa" : "temporaria"}`, fixa ? "Fixa" : "Temporária"));

        const produtos = `${lista.totalProdutos} ${lista.totalProdutos === 1 ? "produto" : "produtos"}`;
        const unidades = `${lista.totalUnidades} ${lista.totalUnidades === 1 ? "unidade" : "unidades"}`;
        meta.appendChild(criarElemento("span", "", `${produtos} · ${unidades}`));
        meta.appendChild(criarElemento("span", "", `Atualizada em ${formatoData.format(new Date(lista.atualizadoEm))}`));

        info.appendChild(meta);

        const acoes = criarElemento("div", "saved-list-actions");

        const abrir = criarElemento("a", "comparison-btn", "Abrir no comparador");
        abrir.href = `main.html?lista=${encodeURIComponent(lista.id)}`;
        abrir.style.display = "inline-flex";
        abrir.style.alignItems = "center";
        abrir.style.justifyContent = "center";
        abrir.style.textDecoration = "none";

        const excluir = criarElemento("button", "secondary-btn danger-btn", "Excluir");
        excluir.type = "button";
        excluir.addEventListener("click", () => excluirLista(lista, excluir));

        acoes.append(abrir, excluir);
        cartao.append(info, acoes);

        return cartao;
    }

    function renderizar(listas) {
        container.innerHTML = "";

        if (!listas.length) {
            container.appendChild(criarElemento(
                "p",
                "saved-lists-empty",
                "Você ainda não salvou nenhuma lista. Monte uma lista no comparador e use “Salvar lista”."
            ));
            return;
        }

        [
            ["Listas fixas", "FIXA"],
            ["Listas temporárias", "TEMPORARIA"]
        ].forEach(([titulo, tipo]) => {
            const doTipo = listas.filter(lista => lista.tipo === tipo);

            if (!doTipo.length) return;

            const grupo = criarElemento("div", "saved-lists-group");
            grupo.appendChild(criarElemento("h3", "", titulo));
            doTipo.forEach(lista => grupo.appendChild(criarCartao(lista)));
            container.appendChild(grupo);
        });
    }

    async function carregar() {
        mensagemListas.textContent = "Carregando listas...";

        try {
            renderizar(await apiRequest("/api/listas-compras?resumo=true"));
            mensagemListas.textContent = "";
        } catch (error) {
            container.innerHTML = "";
            mensagemListas.textContent = error.message;
        }
    }

    async function excluirLista(lista, botao) {
        const confirmado = window.confirm(
            `Excluir a lista "${lista.nome}"? Essa ação não pode ser desfeita. Os produtos do catálogo não serão afetados.`
        );

        if (!confirmado) return;

        botao.disabled = true;

        try {
            await apiRequest(`/api/listas-compras/${lista.id}`, { method: "DELETE" });
            await carregar();
            mensagemListas.textContent = "Lista excluída com sucesso.";
        } catch (error) {
            botao.disabled = false;
            mensagemListas.textContent = error.message;
        }
    }

    carregar();
}