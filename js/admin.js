import { apiRequest } from "./api.js";
import { estaAutenticado, logout } from "./auth.js";

let abaAtual = "produtos";
let produtos = [];
let mercados = [];
let categorias = [];
let precos = [];
let registroEditando = null;

const tabProdutos = document.getElementById("tabProdutos");
const tabMercados = document.getElementById("tabMercados");
const tabPrecos = document.getElementById("tabPrecos");
const tituloLista = document.getElementById("tituloLista");
const descricaoLista = document.getElementById("descricaoLista");
const btnNovo = document.getElementById("btnNovo");
const buscaRegistro = document.getElementById("buscaRegistro");
const mensagem = document.getElementById("mensagem");
const cabecalhoTabela = document.getElementById("cabecalhoTabela");
const corpoTabela = document.getElementById("corpoTabela");
const tabelaContainer = document.getElementById("tabelaContainer");
const estadoVazio = document.getElementById("estadoVazio");
const editorCard = document.getElementById("editorCard");
const tituloFormulario = document.getElementById("tituloFormulario");
const adminForm = document.getElementById("adminForm");
const camposFormulario = document.getElementById("camposFormulario");
const btnCancelar = document.getElementById("btnCancelar");
const btnSalvar = document.getElementById("btnSalvar");
const btnLogout = document.getElementById("btnLogout");

window.addEventListener("DOMContentLoaded", iniciar);

async function iniciar() {
    if (!estaAutenticado()) {
        window.location.href = "login.html";
        return;
    }

    try {
        const usuario = await apiRequest("/api/auth/me");

        if (usuario.papel !== "GERENTE") {
            window.location.href = "perfil.html";
            return;
        }

        const resultadoCategorias = await apiRequest("/api/categorias");
        categorias = Array.isArray(resultadoCategorias) ? resultadoCategorias : [];

        await carregarDados();
        configurarEventos();
    } catch (error) {
        mostrarMensagem(error.message || "Não foi possível abrir o painel.", true);

        if (error.message.includes("Token") || error.message.includes("autenticação")) {
            window.location.href = "login.html";
        }
    }
}

function configurarEventos() {
    tabProdutos.addEventListener("click", () => trocarAba("produtos"));
    tabMercados.addEventListener("click", () => trocarAba("mercados"));
    tabPrecos.addEventListener("click", () => trocarAba("precos"));
    btnNovo.addEventListener("click", () => abrirFormulario(null));
    btnCancelar.addEventListener("click", fecharFormulario);
    buscaRegistro.addEventListener("input", renderizarTabela);
    adminForm.addEventListener("submit", salvarRegistro);
    btnLogout.addEventListener("click", logout);
}

async function carregarDados() {
    mostrarMensagem("Carregando registros...");

    try {
        const [listaProdutos, listaMercados, listaPrecos] = await Promise.all([
            apiRequest("/api/produtos/admin"),
            apiRequest("/api/mercados/admin"),
            apiRequest("/api/produtos-mercado/admin")
        ]);

        produtos = Array.isArray(listaProdutos) ? listaProdutos : [];
        mercados = Array.isArray(listaMercados) ? listaMercados : [];
        precos = Array.isArray(listaPrecos) ? listaPrecos : [];
        renderizarTabela();
        mostrarMensagem("");
    } catch (error) {
        mostrarMensagem(error.message || "Não foi possível carregar os registros.", true);
        throw error;
    }
}

function trocarAba(aba) {
    abaAtual = aba;
    fecharFormulario();
    buscaRegistro.value = "";

    const abas = [
        { nome: "produtos", elemento: tabProdutos },
        { nome: "mercados", elemento: tabMercados },
        { nome: "precos", elemento: tabPrecos }
    ];

    abas.forEach(item => {
        const selecionada = item.nome === aba;
        item.elemento.classList.toggle("active", selecionada);
        item.elemento.setAttribute("aria-selected", String(selecionada));
    });

    if (aba === "produtos") {
        tituloLista.textContent = "Produtos cadastrados";
        descricaoLista.textContent = "Consulte, edite, desative ou reative produtos.";
        btnNovo.textContent = "+ Novo produto";
        buscaRegistro.placeholder = "Buscar por nome, marca ou categoria...";
    } else if (aba === "mercados") {
        tituloLista.textContent = "Supermercados cadastrados";
        descricaoLista.textContent = "Consulte, edite, desative ou reative supermercados.";
        btnNovo.textContent = "+ Novo supermercado";
        buscaRegistro.placeholder = "Buscar por nome ou slug...";
    } else {
        tituloLista.textContent = "Preços por supermercado";
        descricaoLista.textContent = "Cadastre o preço de um produto em cada mercado, controle promoções e disponibilidade.";
        btnNovo.textContent = "+ Novo preço";
        buscaRegistro.placeholder = "Buscar por produto, marca ou supermercado...";
    }

    renderizarTabela();
    mostrarMensagem("");
}

function criarCelula(valor) {
    const celula = document.createElement("td");
    celula.textContent = valor === null || valor === undefined || valor === ""
        ? "—"
        : String(valor);
    return celula;
}

function criarCelulaStatus(ativo, textoAtivo = "Ativo", textoInativo = "Inativo") {
    const celula = document.createElement("td");
    const etiqueta = document.createElement("span");
    etiqueta.className = ativo ? "status-pill" : "status-pill inactive";
    etiqueta.textContent = ativo ? textoAtivo : textoInativo;
    celula.appendChild(etiqueta);
    return celula;
}

function criarBotaoAcao(texto, classe, acao) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = `row-btn ${classe || ""}`.trim();
    botao.textContent = texto;
    botao.addEventListener("click", acao);
    return botao;
}

function criarCabecalho(linhaCabecalho, titulos) {
    titulos.forEach(texto => {
        const celula = document.createElement("th");
        celula.scope = "col";
        celula.textContent = texto;
        linhaCabecalho.appendChild(celula);
    });
}

function renderizarTabela() {
    cabecalhoTabela.replaceChildren();
    corpoTabela.replaceChildren();

    const linhaCabecalho = document.createElement("tr");
    const registros = obterRegistrosFiltrados();

    if (abaAtual === "produtos") {
        criarCabecalho(linhaCabecalho, ["Produto", "Marca", "Categoria", "Vínculos", "Status", "Ações"]);

        registros.forEach(produto => {
            const linha = document.createElement("tr");
            linha.appendChild(criarCelula(produto.nome));
            linha.appendChild(criarCelula(produto.marca));
            linha.appendChild(criarCelula(produto.categoria?.nome));

            const quantidadePrecos = produto._count?.produtomercado ?? 0;
            const quantidadeItens = produto._count?.itemlistacompra ?? 0;
            linha.appendChild(criarCelula(`${quantidadePrecos} preço(s) · ${quantidadeItens} item(ns) de lista`));
            linha.appendChild(criarCelulaStatus(produto.ativo));

            const acoes = document.createElement("td");
            const grupoAcoes = document.createElement("div");
            grupoAcoes.className = "row-actions";
            grupoAcoes.appendChild(criarBotaoAcao("Editar", "", () => abrirFormulario(produto)));

            if (produto.ativo) {
                grupoAcoes.appendChild(criarBotaoAcao("Desativar", "danger", () => alterarAtivacao("produtos", produto, false)));
            } else {
                grupoAcoes.appendChild(criarBotaoAcao("Reativar", "", () => alterarAtivacao("produtos", produto, true)));
            }

            acoes.appendChild(grupoAcoes);
            linha.appendChild(acoes);
            corpoTabela.appendChild(linha);
        });
    } else if (abaAtual === "mercados") {
        criarCabecalho(linhaCabecalho, ["Supermercado", "Slug", "Preços vinculados", "Status", "Ações"]);

        registros.forEach(mercado => {
            const linha = document.createElement("tr");
            linha.appendChild(criarCelula(mercado.nome));
            linha.appendChild(criarCelula(mercado.slug));
            linha.appendChild(criarCelula(mercado._count?.produtomercado ?? 0));
            linha.appendChild(criarCelulaStatus(mercado.ativo));

            const acoes = document.createElement("td");
            const grupoAcoes = document.createElement("div");
            grupoAcoes.className = "row-actions";
            grupoAcoes.appendChild(criarBotaoAcao("Editar", "", () => abrirFormulario(mercado)));

            if (mercado.ativo) {
                grupoAcoes.appendChild(criarBotaoAcao("Desativar", "danger", () => alterarAtivacao("mercados", mercado, false)));
            } else {
                grupoAcoes.appendChild(criarBotaoAcao("Reativar", "", () => alterarAtivacao("mercados", mercado, true)));
            }

            acoes.appendChild(grupoAcoes);
            linha.appendChild(acoes);
            corpoTabela.appendChild(linha);
        });
    } else {
        criarCabecalho(linhaCabecalho, ["Produto", "Supermercado", "Preço", "Promoção", "Disponibilidade", "Atualizado em", "Ações"]);

        registros.forEach(preco => {
            const linha = document.createElement("tr");
            const nomeProduto = preco.produto?.marca
                ? `${preco.produto.nome} · ${preco.produto.marca}`
                : preco.produto?.nome;
            linha.appendChild(criarCelula(nomeProduto));
            linha.appendChild(criarCelula(preco.mercado?.nome));
            linha.appendChild(criarCelula(formatarMoeda(preco.preco)));
            linha.appendChild(criarCelula(preco.emPromocao
                ? `Sim · de ${formatarMoeda(preco.precoOriginal)}`
                : "Não"));

            const aparecePublicamente = Boolean(
                preco.disponivel && preco.produto?.ativo && preco.mercado?.ativo
            );
            let textoDisponibilidade = "Público";
            if (!preco.disponivel) {
                textoDisponibilidade = "Indisponível";
            } else if (!preco.produto?.ativo || !preco.mercado?.ativo) {
                textoDisponibilidade = "Oculto: produto/mercado inativo";
            }
            linha.appendChild(criarCelulaStatus(aparecePublicamente, "Público", textoDisponibilidade));
            linha.appendChild(criarCelula(formatarData(preco.atualizadoEm)));

            const acoes = document.createElement("td");
            const grupoAcoes = document.createElement("div");
            grupoAcoes.className = "row-actions";
            grupoAcoes.appendChild(criarBotaoAcao("Editar", "", () => abrirFormulario(preco)));

            if (preco.disponivel) {
                grupoAcoes.appendChild(criarBotaoAcao("Indisponibilizar", "danger", () => alterarDisponibilidadePreco(preco, false)));
            } else {
                grupoAcoes.appendChild(criarBotaoAcao("Marcar disponível", "", () => alterarDisponibilidadePreco(preco, true)));
            }

            acoes.appendChild(grupoAcoes);
            linha.appendChild(acoes);
            corpoTabela.appendChild(linha);
        });
    }

    cabecalhoTabela.appendChild(linhaCabecalho);

    const semResultados = registros.length === 0;
    tabelaContainer.hidden = semResultados;
    estadoVazio.hidden = !semResultados;
    estadoVazio.textContent = buscaRegistro.value.trim()
        ? "Nenhum registro corresponde à pesquisa."
        : "Nenhum registro cadastrado.";
}

function obterRegistrosFiltrados() {
    const busca = normalizarTexto(buscaRegistro.value);
    let lista;

    if (abaAtual === "produtos") {
        lista = produtos;
    } else if (abaAtual === "mercados") {
        lista = mercados;
    } else {
        lista = precos;
    }

    if (!busca) return lista;

    return lista.filter(registro => {
        let partes;

        if (abaAtual === "produtos") {
            partes = [registro.nome, registro.marca, registro.categoria?.nome, registro.descricao];
        } else if (abaAtual === "mercados") {
            partes = [registro.nome, registro.slug];
        } else {
            partes = [registro.produto?.nome, registro.produto?.marca, registro.mercado?.nome];
        }

        return partes.some(parte => normalizarTexto(parte).includes(busca));
    });
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function formatarMoeda(valor) {
    if (valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor))) {
        return "—";
    }

    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(valor));
}

function formatarData(valor) {
    if (!valor) return "—";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "—";
    return data.toLocaleString("pt-BR");
}

function adicionarOpcaoRelacional(select, registro, nome, selecionadoId) {
    const opcao = new Option(
        `${nome}${registro.ativo ? "" : " (inativo)"}`,
        String(registro.id)
    );
    opcao.disabled = !registro.ativo && Number(registro.id) !== Number(selecionadoId);
    select.add(opcao);
}

function abrirFormulario(registro) {
    registroEditando = registro;
    adminForm.reset();
    camposFormulario.replaceChildren();

    if (abaAtual === "produtos") {
        tituloFormulario.textContent = registro ? "Editar produto" : "Cadastrar produto";
        camposFormulario.innerHTML = `
            <div class="field-group full-width">
                <label for="campoNome">Nome *</label>
                <input id="campoNome" name="nome" type="text" maxlength="191" required>
            </div>
            <div class="field-group">
                <label for="campoMarca">Marca</label>
                <input id="campoMarca" name="marca" type="text" maxlength="191">
            </div>
            <div class="field-group">
                <label for="campoCategoria">Categoria</label>
                <select id="campoCategoria" name="categoriaId">
                    <option value="">Sem categoria</option>
                </select>
            </div>
            <div class="field-group">
                <label for="campoQuantidade">Quantidade</label>
                <input id="campoQuantidade" name="quantidade" type="number" min="0.001" max="9999999.999" step="0.001">
            </div>
            <div class="field-group">
                <label for="campoUnidade">Unidade</label>
                <input id="campoUnidade" name="unidade" type="text" maxlength="191" placeholder="Ex.: kg, L, g">
            </div>
            <div class="field-group full-width">
                <label for="campoDescricao">Descrição</label>
                <textarea id="campoDescricao" name="descricao" maxlength="191"></textarea>
            </div>
            <div class="field-group full-width">
                <label for="campoImagemUrl">URL da imagem</label>
                <input id="campoImagemUrl" name="imagemUrl" type="text" maxlength="191">
            </div>
            <div class="field-group full-width">
                <label class="field-check"><input id="campoAtivo" name="ativo" type="checkbox"> Produto ativo e disponível nas consultas públicas</label>
            </div>`;

        const selectCategoria = document.getElementById("campoCategoria");
        categorias.forEach(categoria => selectCategoria.add(new Option(categoria.nome, String(categoria.id))));

        preencherCampo("campoNome", registro?.nome);
        preencherCampo("campoMarca", registro?.marca);
        preencherCampo("campoDescricao", registro?.descricao);
        preencherCampo("campoQuantidade", registro?.quantidade);
        preencherCampo("campoUnidade", registro?.unidade);
        preencherCampo("campoImagemUrl", registro?.imagemUrl);
        selectCategoria.value = registro?.categoriaId ? String(registro.categoriaId) : "";
        document.getElementById("campoAtivo").checked = registro ? registro.ativo : true;
    } else if (abaAtual === "mercados") {
        tituloFormulario.textContent = registro ? "Editar supermercado" : "Cadastrar supermercado";
        camposFormulario.innerHTML = `
            <div class="field-group">
                <label for="campoNome">Nome *</label>
                <input id="campoNome" name="nome" type="text" maxlength="191" required>
            </div>
            <div class="field-group">
                <label for="campoSlug">Slug *</label>
                <input id="campoSlug" name="slug" type="text" maxlength="191" required placeholder="Ex.: mercado-central">
            </div>
            <div class="field-group full-width">
                <label for="campoLogoUrl">URL do logo</label>
                <input id="campoLogoUrl" name="logoUrl" type="text" maxlength="191">
            </div>
            <div class="field-group full-width">
                <label class="field-check"><input id="campoAtivo" name="ativo" type="checkbox"> Supermercado ativo nas consultas públicas</label>
            </div>`;

        preencherCampo("campoNome", registro?.nome);
        preencherCampo("campoSlug", registro?.slug);
        preencherCampo("campoLogoUrl", registro?.logoUrl);
        document.getElementById("campoAtivo").checked = registro ? registro.ativo : true;
    } else {
        tituloFormulario.textContent = registro ? "Editar preço" : "Cadastrar preço por supermercado";
        camposFormulario.innerHTML = `
            <div class="field-group full-width">
                <label for="campoProdutoId">Produto *</label>
                <select id="campoProdutoId" name="produtoId" required>
                    <option value="">Selecione um produto</option>
                </select>
            </div>
            <div class="field-group full-width">
                <label for="campoMercadoId">Supermercado *</label>
                <select id="campoMercadoId" name="mercadoId" required>
                    <option value="">Selecione um supermercado</option>
                </select>
            </div>
            <div class="field-group">
                <label for="campoPreco">Preço atual (R$) *</label>
                <input id="campoPreco" name="preco" type="number" min="0.01" max="99999999.99" step="0.01" required>
            </div>
            <div class="field-group">
                <label for="campoPrecoOriginal">Preço original (R$)</label>
                <input id="campoPrecoOriginal" name="precoOriginal" type="number" min="0.01" max="99999999.99" step="0.01">
            </div>
            <div class="field-group full-width">
                <label class="field-check"><input id="campoEmPromocao" name="emPromocao" type="checkbox"> Este produto está em promoção</label>
            </div>
            <div class="field-group">
                <label for="campoInicioPromocao">Início da promoção</label>
                <input id="campoInicioPromocao" name="inicioPromocao" type="date">
            </div>
            <div class="field-group">
                <label for="campoFimPromocao">Fim da promoção</label>
                <input id="campoFimPromocao" name="fimPromocao" type="date">
            </div>
            <div class="field-group full-width">
                <label class="field-check"><input id="campoDisponivel" name="disponivel" type="checkbox"> Preço disponível nas consultas públicas</label>
            </div>`;

        const selectProduto = document.getElementById("campoProdutoId");
        const selectMercado = document.getElementById("campoMercadoId");
        produtos.forEach(produto => adicionarOpcaoRelacional(selectProduto, produto, produto.nome, registro?.produtoId));
        mercados.forEach(mercado => adicionarOpcaoRelacional(selectMercado, mercado, mercado.nome, registro?.mercadoId));

        selectProduto.value = registro?.produtoId ? String(registro.produtoId) : "";
        selectMercado.value = registro?.mercadoId ? String(registro.mercadoId) : "";
        preencherCampo("campoPreco", registro?.preco);
        preencherCampo("campoPrecoOriginal", registro?.precoOriginal);
        preencherCampo("campoInicioPromocao", registro?.inicioPromocao ? String(registro.inicioPromocao).slice(0, 10) : "");
        preencherCampo("campoFimPromocao", registro?.fimPromocao ? String(registro.fimPromocao).slice(0, 10) : "");
        document.getElementById("campoEmPromocao").checked = Boolean(registro?.emPromocao);
        document.getElementById("campoDisponivel").checked = registro ? Boolean(registro.disponivel) : true;

        document.getElementById("campoEmPromocao").addEventListener("change", atualizarCamposPromocao);
        atualizarCamposPromocao();
    }

    btnSalvar.disabled = false;
    btnSalvar.textContent = registro ? "Salvar alterações" : "Cadastrar";
    editorCard.hidden = false;
    editorCard.scrollIntoView({ behavior: "smooth", block: "start" });
    mostrarMensagem("");
}

function atualizarCamposPromocao() {
    const emPromocao = document.getElementById("campoEmPromocao")?.checked;
    const campoOriginal = document.getElementById("campoPrecoOriginal");
    const campoInicio = document.getElementById("campoInicioPromocao");
    const campoFim = document.getElementById("campoFimPromocao");

    if (!campoOriginal || !campoInicio || !campoFim) return;

    campoOriginal.required = Boolean(emPromocao);
    campoInicio.disabled = !emPromocao;
    campoFim.disabled = !emPromocao;

    if (!emPromocao) {
        campoOriginal.value = "";
        campoInicio.value = "";
        campoFim.value = "";
    }
}

function preencherCampo(id, valor) {
    const campo = document.getElementById(id);
    if (campo) campo.value = valor === null || valor === undefined ? "" : String(valor);
}

function fecharFormulario() {
    registroEditando = null;
    editorCard.hidden = true;
    adminForm.reset();
    camposFormulario.replaceChildren();
}

async function salvarRegistro(event) {
    event.preventDefault();

    const registroAtual = registroEditando;
    let endpoint;
    let dados;
    let textoSucesso;

    if (abaAtual === "produtos") {
        const quantidadeCampo = document.getElementById("campoQuantidade").value;
        const categoriaCampo = document.getElementById("campoCategoria").value;

        dados = {
            nome: document.getElementById("campoNome").value.trim(),
            marca: valorOpcional("campoMarca"),
            descricao: valorOpcional("campoDescricao"),
            quantidade: quantidadeCampo === "" ? null : Number(quantidadeCampo),
            unidade: valorOpcional("campoUnidade"),
            imagemUrl: valorOpcional("campoImagemUrl"),
            categoriaId: categoriaCampo === "" ? null : Number(categoriaCampo),
            ativo: document.getElementById("campoAtivo").checked
        };
        endpoint = "/api/produtos";
        textoSucesso = "Produto salvo com sucesso.";
    } else if (abaAtual === "mercados") {
        dados = {
            nome: document.getElementById("campoNome").value.trim(),
            slug: document.getElementById("campoSlug").value.trim(),
            logoUrl: valorOpcional("campoLogoUrl"),
            ativo: document.getElementById("campoAtivo").checked
        };
        endpoint = "/api/mercados";
        textoSucesso = "Supermercado salvo com sucesso.";
    } else {
        const emPromocao = document.getElementById("campoEmPromocao").checked;
        const precoOriginalCampo = document.getElementById("campoPrecoOriginal").value;
        const inicioCampo = document.getElementById("campoInicioPromocao").value;
        const fimCampo = document.getElementById("campoFimPromocao").value;

        dados = {
            produtoId: Number(document.getElementById("campoProdutoId").value),
            mercadoId: Number(document.getElementById("campoMercadoId").value),
            preco: Number(document.getElementById("campoPreco").value),
            precoOriginal: emPromocao && precoOriginalCampo !== "" ? Number(precoOriginalCampo) : null,
            emPromocao,
            inicioPromocao: emPromocao && inicioCampo ? inicioCampo : null,
            fimPromocao: emPromocao && fimCampo ? fimCampo : null,
            disponivel: document.getElementById("campoDisponivel").checked
        };
        endpoint = "/api/produtos-mercado";
        textoSucesso = "Preço salvo com sucesso.";
    }

    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";
    mostrarMensagem("Salvando registro...");

    const endpointFinal = registroAtual ? `${endpoint}/${registroAtual.id}` : endpoint;
    const metodo = registroAtual ? "PUT" : "POST";

    try {
        await apiRequest(endpointFinal, {
            method: metodo,
            body: JSON.stringify(dados)
        });

        fecharFormulario();
        await carregarDados();
        mostrarMensagem(textoSucesso);
    } catch (error) {
        mostrarMensagem(error.message || "Não foi possível salvar o registro.", true);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = registroAtual ? "Salvar alterações" : "Cadastrar";
    }
}

function valorOpcional(id) {
    const valor = document.getElementById(id).value.trim();
    return valor === "" ? null : valor;
}

async function alterarAtivacao(tipo, registro, ativar) {
    const substantivo = tipo === "produtos" ? "produto" : "supermercado";
    const acao = ativar ? "reativar" : "desativar";
    const mensagemConfirmacao = ativar
        ? `Deseja reativar ${substantivo} "${registro.nome}"? Ele poderá voltar às consultas públicas.`
        : `Deseja desativar ${substantivo} "${registro.nome}"? Preços e itens de listas serão preservados.`;

    if (!window.confirm(mensagemConfirmacao)) return;

    const endpoint = tipo === "produtos" ? "/api/produtos" : "/api/mercados";

    try {
        if (ativar) {
            await apiRequest(`${endpoint}/${registro.id}`, {
                method: "PUT",
                body: JSON.stringify({ ativo: true })
            });
        } else {
            await apiRequest(`${endpoint}/${registro.id}`, { method: "DELETE" });
        }

        await carregarDados();
        mostrarMensagem(`${substantivo.charAt(0).toUpperCase()}${substantivo.slice(1)} ${ativar ? "reativado" : "desativado"} com sucesso.`);
    } catch (error) {
        mostrarMensagem(error.message || `Não foi possível ${acao} o registro.`, true);
    }
}

async function alterarDisponibilidadePreco(preco, disponivel) {
    const acao = disponivel ? "marcar como disponível" : "indisponibilizar";
    const mensagemConfirmacao = disponivel
        ? "Deseja marcar este preço como disponível? Ele só aparecerá publicamente se o produto e o supermercado também estiverem ativos."
        : "Deseja tornar este preço indisponível? O registro e os dados já vinculados serão preservados.";

    if (!window.confirm(mensagemConfirmacao)) return;

    try {
        if (disponivel) {
            await apiRequest(`/api/produtos-mercado/${preco.id}`, {
                method: "PUT",
                body: JSON.stringify({ disponivel: true })
            });
        } else {
            // A rota DELETE também faz desativação lógica no backend, sem apagar o registro.
            await apiRequest(`/api/produtos-mercado/${preco.id}`, { method: "DELETE" });
        }

        await carregarDados();
        mostrarMensagem(`Preço ${disponivel ? "marcado como disponível" : "indisponibilizado"} com sucesso.`);
    } catch (error) {
        mostrarMensagem(error.message || `Não foi possível ${acao} o preço.`, true);
    }
}

function mostrarMensagem(texto, erro = false) {
    mensagem.textContent = texto;
    mensagem.classList.toggle("error", erro);
}
