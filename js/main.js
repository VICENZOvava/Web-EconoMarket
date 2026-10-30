import { apiRequest } from "./api.js";
import { estaAutenticado, obterIdUsuarioDoToken } from "./auth.js";

let lista = [];
let produtos = [];
let categoriasSelecionadas = new Set();

// "edicao": a lista pode ser alterada e é guardada como rascunho local.
// "consulta": uma lista salva aberta só para ver itens e preços.
let modo = "edicao";
// Lista salva vinculada ao que está na tela (null = rascunho novo).
let listaAberta = null;
let inicializado = false;
let salvandoLista = false;

const QUANTIDADE_MAXIMA = 999;

const produtoInput = document.getElementById("produto");
const quantidadeInput = document.getElementById("quantidade");
const btnAdicionarProduto = document.getElementById("btnAdicionarProduto");
const listaProdutos = document.getElementById("listaProdutos");
const contadorProdutos = document.getElementById("contadorProdutos");
const comparacaoProdutos = document.getElementById("comparacaoProdutos");
const mercadoMaisBarato = document.getElementById("mercadoMaisBarato");
const totalCompra = document.getElementById("totalCompra");
const economia = document.getElementById("economia");
const produtosDisponiveis = document.getElementById("produtosDisponiveis");
const categoriasFiltro = document.getElementById("categoriasFiltro");
const formularioProduto = document.getElementById("formularioProduto");
const filtroCategorias = document.getElementById("filtroCategorias");
const bannerLista = document.getElementById("bannerLista");
const bannerListaNome = document.getElementById("bannerListaNome");
const bannerListaInfo = document.getElementById("bannerListaInfo");
const btnEditarLista = document.getElementById("btnEditarLista");
const btnSairLista = document.getElementById("btnSairLista");
const tituloLista = document.getElementById("tituloLista");
const controlesLista = document.getElementById("controlesLista");
const btnCarregarUltima = document.getElementById("btnCarregarUltima");
const btnLimparLista = document.getElementById("btnLimparLista");
const btnSalvarLista = document.getElementById("btnSalvarLista");
const mensagemLista = document.getElementById("mensagemLista");
const avisoComparacao = document.getElementById("avisoComparacao");
const dialogSalvarLista = document.getElementById("dialogSalvarLista");
const formSalvarLista = document.getElementById("formSalvarLista");
const nomeListaInput = document.getElementById("nomeLista");
const opcoesAtualizar = document.getElementById("opcoesAtualizar");
const textoAtualizar = document.getElementById("textoAtualizar");
const erroSalvarLista = document.getElementById("erroSalvarLista");
const btnCancelarSalvar = document.getElementById("btnCancelarSalvar");
const btnConfirmarSalvar = document.getElementById("btnConfirmarSalvar");

const categoriasEmojis = {
    alimentos: "🥦",
    "alimentos-e-bebidas": "🥦",
    "frios-e-laticinios": "🧀",
    bebidas: "🥤",
    limpeza: "🧹",
    higiene: "🧴",
    mercearia: "🛒"
};

const mercados = {
    assai: { nome: "Assaí", slugs: ["assai", "assaí"], totalId: "totalAssai", barId: "barAssai", positionId: "positionAssai" },
    atacadao: { nome: "Atacadão", slugs: ["atacadao", "atacadão"], totalId: "totalAtacadao", barId: "barAtacadao", positionId: "positionAtacadao" },
    carrefour: { nome: "Carrefour", slugs: ["carrefour"], totalId: "totalCarrefour", barId: "barCarrefour", positionId: "positionCarrefour" },
    extra: { nome: "Extra", slugs: ["extra"], totalId: "totalExtra", barId: "barExtra", positionId: "positionExtra" },
    pao: { nome: "Pão de Açúcar", slugs: ["pao-de-acucar", "pao_de_acucar", "paodeacucar", "pao"], totalId: "totalPao", barId: "barPao", positionId: "positionPao" }
};

document.addEventListener("DOMContentLoaded", async () => {
    if (!produtoInput || !quantidadeInput || !btnAdicionarProduto) {
        console.error("Elementos do comparador não encontrados.");
        return;
    }

    btnAdicionarProduto.disabled = true;
    produtoInput.disabled = true;
    quantidadeInput.disabled = true;

    let catalogoCarregado = false;

    try {
        produtos = await apiRequest("/api/produtos");

        renderizarCategoriasFiltro();
        carregarProdutosNoCampo();

        btnAdicionarProduto.disabled = false;
        produtoInput.disabled = false;
        quantidadeInput.disabled = false;
        catalogoCarregado = true;
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        alert("Não foi possível carregar os produtos do EconoMarket.");
    }

    btnAdicionarProduto.addEventListener("click", adicionarProduto);

    produtoInput.addEventListener("keydown", event => {
        if (event.key === "Enter") adicionarProduto();
    });

    quantidadeInput.addEventListener("keydown", event => {
        if (event.key === "Enter") adicionarProduto();
    });

    btnCarregarUltima.addEventListener("click", carregarUltimaLista);
    btnLimparLista.addEventListener("click", limparLista);
    btnSalvarLista.addEventListener("click", abrirDialogSalvar);
    btnEditarLista.addEventListener("click", editarListaAberta);
    btnSairLista.addEventListener("click", sairDaLista);
    btnCancelarSalvar.addEventListener("click", () => dialogSalvarLista.close());
    formSalvarLista.addEventListener("submit", confirmarSalvarLista);

    // Sem o catálogo não dá para comparar nem restaurar: nada é lido nem gravado,
    // para não apagar o rascunho por causa de uma falha de rede.
    if (catalogoCarregado) {
        await iniciarListaInicial();
        inicializado = true;
    }

    atualizarPagina();
});

function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function escaparHtml(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizarTexto(texto) {
    return String(texto)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function obterCategorias() {
    const categorias = new Map();

    produtos.forEach(produto => {
        if (!produto.categoria) return;

        const slug = produto.categoria.slug;
        const nome = produto.categoria.nome;

        if (slug && nome) {
            categorias.set(slug, {
                slug,
                nome
            });
        }
    });

    return Array.from(categorias.values()).sort(
        (a, b) => a.nome.localeCompare(b.nome, "pt-BR")
    );
}

function obterEmojiCategoria(slug) {
    return categoriasEmojis[slug] || "📦";
}

function renderizarCategoriasFiltro() {
    if (!categoriasFiltro) return;

    categoriasFiltro.innerHTML = "";

    const botaoTodas = document.createElement("button");
    botaoTodas.type = "button";
    botaoTodas.className = "category-option";
    botaoTodas.innerHTML = "<span class='category-emoji'>🛍️</span><span>Todas</span>";

    if (categoriasSelecionadas.size === 0) {
        botaoTodas.classList.add("category-option-active");
        botaoTodas.setAttribute("aria-pressed", "true");
    } else {
        botaoTodas.setAttribute("aria-pressed", "false");
    }

    botaoTodas.addEventListener("click", () => {
        categoriasSelecionadas.clear();
        atualizarFiltros();
    });

    categoriasFiltro.appendChild(botaoTodas);

    obterCategorias().forEach(categoria => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "category-option";

        const emoji = document.createElement("span");
        emoji.className = "category-emoji";
        emoji.textContent = obterEmojiCategoria(categoria.slug);

        const nome = document.createElement("span");
        nome.textContent = categoria.nome;

        botao.appendChild(emoji);
        botao.appendChild(nome);

        const selecionada = categoriasSelecionadas.has(categoria.slug);

        if (selecionada) {
            botao.classList.add("category-option-active");
        }

        botao.setAttribute("aria-pressed", String(selecionada));

        botao.addEventListener("click", () => {
            if (categoriasSelecionadas.has(categoria.slug)) {
                categoriasSelecionadas.delete(categoria.slug);
            } else {
                categoriasSelecionadas.add(categoria.slug);
            }

            atualizarFiltros();
        });

        categoriasFiltro.appendChild(botao);
    });
}

function produtosFiltrados() {
    if (categoriasSelecionadas.size === 0) {
        return produtos;
    }

    return produtos.filter(produto =>
        produto.categoria &&
        categoriasSelecionadas.has(produto.categoria.slug)
    );
}

function atualizarFiltros() {
    renderizarCategoriasFiltro();
    carregarProdutosNoCampo();

    const produtoDigitado = produtoInput.value.trim();

    if (
        produtoDigitado &&
        !produtosFiltrados().some(
            produto => normalizarTexto(produto.nome) === normalizarTexto(produtoDigitado)
        )
    ) {
        produtoInput.value = "";
    }
}

function carregarProdutosNoCampo() {
    if (!produtosDisponiveis) return;

    produtosDisponiveis.innerHTML = "";

    [...produtosFiltrados()]
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .forEach(produto => {
            const option = document.createElement("option");
            option.value = produto.nome;
            produtosDisponiveis.appendChild(option);
        });
}

function encontrarProduto(nome) {
    const nomeNormalizado = normalizarTexto(nome);

    return produtosFiltrados().find(
        produto => normalizarTexto(produto.nome) === nomeNormalizado
    );
}

function encontrarMercado(slug, nome) {
    const slugNormalizado = normalizarTexto(slug);
    const nomeNormalizado = normalizarTexto(nome);

    return Object.entries(mercados).find(([chave, mercado]) =>
        mercado.slugs.some(
            valor => normalizarTexto(valor) === slugNormalizado
        ) ||
        normalizarTexto(mercado.nome) === nomeNormalizado
    )?.[0] || null;
}

function obterPrecosProduto(produto) {
    const precos = {};

    Object.keys(mercados).forEach(mercado => {
        precos[mercado] = null;
    });

    (produto.produtomercado || []).forEach(item => {
        if (!item.disponivel) return;

        const mercado = encontrarMercado(
            item.mercado?.slug,
            item.mercado?.nome
        );

        if (!mercado) return;

        precos[mercado] = Number(item.preco);
    });

    return precos;
}

function adicionarProduto() {
    const produto = encontrarProduto(produtoInput.value);
    const quantidade = Number(quantidadeInput.value);

    if (!produto) {
        alert("Produto não encontrado. Escolha um produto cadastrado nas categorias selecionadas.");
        produtoInput.focus();
        return;
    }

    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAXIMA) {
        alert(`Digite uma quantidade válida (de 1 a ${QUANTIDADE_MAXIMA}).`);
        quantidadeInput.focus();
        return;
    }

    const produtoExistente = lista.find(
        item => item.produtoId === produto.id
    );

    if (produtoExistente) {
        produtoExistente.quantidade = Math.min(
            produtoExistente.quantidade + quantidade,
            QUANTIDADE_MAXIMA
        );
    } else {
        lista.push({
            produtoId: produto.id,
            quantidade
        });
    }

    produtoInput.value = "";
    quantidadeInput.value = "1";
    produtoInput.focus();
    atualizarPagina();
}

function removerProduto(produtoId) {
    if (modo !== "edicao") return;

    lista = lista.filter(
        item => item.produtoId !== produtoId
    );

    atualizarPagina();
}

function alterarQuantidade(produtoId, novaQuantidade) {
    if (modo !== "edicao") return;

    if (novaQuantidade <= 0) {
        removerProduto(produtoId);
        return;
    }

    const item = lista.find(
        produto => produto.produtoId === produtoId
    );

    if (!item) return;

    item.quantidade = Math.min(novaQuantidade, QUANTIDADE_MAXIMA);
    atualizarPagina();
}

function obterProdutoDaLista(item) {
    return produtos.find(
        produto => produto.id === item.produtoId
    );
}

function calcularTotais() {
    const totais = {};

    Object.keys(mercados).forEach(mercado => {
        totais[mercado] = 0;
    });

    const disponiveis = {};

    Object.keys(mercados).forEach(mercado => {
        disponiveis[mercado] = true;
    });

    lista.forEach(item => {
        const produto = obterProdutoDaLista(item);

        if (!produto) return;

        const precos = obterPrecosProduto(produto);

        Object.keys(mercados).forEach(mercado => {
            if (precos[mercado] === null) {
                disponiveis[mercado] = false;
                return;
            }

            totais[mercado] += precos[mercado] * item.quantidade;
        });
    });

    return { totais, disponiveis };
}

function encontrarMenorPreco(precos) {
    const disponiveis = Object.keys(mercados).filter(
        mercado => precos[mercado] !== null
    );

    if (!disponiveis.length) return null;

    return disponiveis.reduce(
        (menor, mercadoAtual) =>
            precos[mercadoAtual] < precos[menor]
                ? mercadoAtual
                : menor
    );
}

function renderizarLista() {
    listaProdutos.innerHTML = "";

    if (!lista.length) {
        listaProdutos.innerHTML = `
            <div class="empty-list">
                <strong>Sua lista está vazia</strong>
                <span>Adicione um produto acima para começar.</span>
            </div>
        `;
        contadorProdutos.textContent = "0 produtos";
        return;
    }

    const quantidadeTotal = lista.reduce(
        (total, item) => total + item.quantidade,
        0
    );

    contadorProdutos.textContent =
        `${quantidadeTotal} ${quantidadeTotal === 1 ? "produto" : "produtos"}`;

    const editavel = modo === "edicao";

    lista.forEach(item => {
        const produto = obterProdutoDaLista(item);

        const nome = produto ? produto.nome : (item.nome || "Produto indisponível");
        const detalhe = produto
            ? (produto.marca ? `<small>${escaparHtml(produto.marca)}</small>` : "")
            : "<small>Indisponível no catálogo — remova para poder salvar</small>";

        const linha = document.createElement("div");
        linha.className = "shopping-list-row";

        const controlesQuantidade = editavel
            ? `
                <button type="button" class="quantity-button" data-product="${item.produtoId}" data-action="decrease">−</button>
                <span>${item.quantidade}</span>
                <button type="button" class="quantity-button" data-product="${item.produtoId}" data-action="increase">+</button>
            `
            : `<span>${item.quantidade}</span>`;

        const acao = editavel
            ? `<button type="button" class="remove-product" data-product="${item.produtoId}">Remover</button>`
            : "";

        linha.innerHTML = `
            <div class="shopping-product-name">
                <strong>${escaparHtml(nome)}</strong>
                ${detalhe}
            </div>
            <div class="shopping-product-quantity">
                ${controlesQuantidade}
            </div>
            <div class="shopping-product-action">
                ${acao}
            </div>
        `;

        listaProdutos.appendChild(linha);
    });

    listaProdutos.querySelectorAll(".quantity-button").forEach(botao => {
        botao.addEventListener("click", () => {
            const produtoId = Number(botao.dataset.product);
            const item = lista.find(
                produto => produto.produtoId === produtoId
            );

            if (!item) return;

            alterarQuantidade(
                produtoId,
                botao.dataset.action === "increase"
                    ? item.quantidade + 1
                    : item.quantidade - 1
            );
        });
    });

    listaProdutos.querySelectorAll(".remove-product").forEach(botao => {
        botao.addEventListener("click", () => {
            removerProduto(Number(botao.dataset.product));
        });
    });
}

function renderizarTotais() {
    const { totais, disponiveis } = calcularTotais();

    if (!lista.length) {
        Object.keys(mercados).forEach(mercado => {
            const dados = mercados[mercado];
            document.getElementById(dados.totalId).textContent = "R$ 0,00";
            document.getElementById(dados.barId).style.width = "0%";
            document.getElementById(dados.positionId).textContent = "-";
        });

        mercadoMaisBarato.textContent = "Adicione produtos";
        totalCompra.textContent = "R$ 0,00";
        economia.textContent = "R$ 0,00";
        return;
    }

    const mercadosDisponiveis = Object.keys(mercados).filter(
        mercado => disponiveis[mercado]
    );

    if (!mercadosDisponiveis.length) {
        Object.keys(mercados).forEach(mercado => {
            const dados = mercados[mercado];
            document.getElementById(dados.totalId).textContent = "Indisponível";
            document.getElementById(dados.barId).style.width = "0%";
            document.getElementById(dados.positionId).textContent = "-";
        });

        mercadoMaisBarato.textContent = "Sem comparação";
        totalCompra.textContent = "R$ 0,00";
        economia.textContent = "R$ 0,00";
        return;
    }

    const valores = mercadosDisponiveis.map(
        mercado => totais[mercado]
    );

    const menorTotal = Math.min(...valores);
    const maiorTotal = Math.max(...valores);

    const mercadoVencedor = mercadosDisponiveis.find(
        mercado => totais[mercado] === menorTotal
    );

    Object.keys(mercados).forEach(mercado => {
        const dados = mercados[mercado];

        if (!disponiveis[mercado]) {
            document.getElementById(dados.totalId).textContent = "Indisponível";
            document.getElementById(dados.barId).style.width = "0%";
            return;
        }

        const percentual =
            maiorTotal > 0
                ? (totais[mercado] / maiorTotal) * 100
                : 0;

        document.getElementById(dados.totalId).textContent =
            formatarMoeda(totais[mercado]);

        document.getElementById(dados.barId).style.width =
            `${percentual}%`;
    });

    Object.keys(mercados).forEach(mercado => {
        document.getElementById(
            mercados[mercado].positionId
        ).textContent = "-";
    });

    mercadosDisponiveis
        .sort((a, b) => totais[a] - totais[b])
        .forEach((mercado, index) => {
            document.getElementById(
                mercados[mercado].positionId
            ).textContent = `${index + 1}º`;
        });

    mercadoMaisBarato.textContent =
        mercados[mercadoVencedor].nome;

    totalCompra.textContent =
        formatarMoeda(menorTotal);

    economia.textContent =
        formatarMoeda(maiorTotal - menorTotal);
}

function descreverDiferenca(precos, quantidade) {
    const valores = Object.values(precos).filter(preco => preco !== null);

    if (valores.length < 2) return "";

    const diferenca = Math.max(...valores) - Math.min(...valores);

    if (diferenca <= 0) return "Mesmo preço nos mercados com dados";

    const porUnidade = `Diferença: ${formatarMoeda(diferenca)} por unidade`;

    return quantidade > 1
        ? `${porUnidade} (${formatarMoeda(diferenca * quantidade)} em ${quantidade})`
        : porUnidade;
}

function renderizarComparacaoProdutos() {
    comparacaoProdutos.innerHTML = "";

    if (!lista.length) {
        comparacaoProdutos.innerHTML = `
            <div class="empty-comparison">
                <strong>Nenhum produto para comparar</strong>
                <span>Adicione produtos à sua lista para visualizar os preços.</span>
            </div>
        `;
        return;
    }

    lista.forEach(item => {
        const produto = obterProdutoDaLista(item);

        const linha = document.createElement("div");
        linha.className = "product-table-row";

        if (!produto) {
            linha.innerHTML = `
                <div class="product-name-cell">
                    <strong>${escaparHtml(item.nome || "Produto indisponível")}</strong>
                    <span>${item.quantidade} ${item.quantidade === 1 ? "unidade" : "unidades"}</span>
                    <span class="product-warning">Produto indisponível no catálogo</span>
                </div>
                ${Object.keys(mercados).map(() => `
                    <div class="product-price-cell"><strong>Indisponível</strong></div>
                `).join("")}
            `;
            comparacaoProdutos.appendChild(linha);
            return;
        }

        const precos = obterPrecosProduto(produto);
        const menorMercado = encontrarMenorPreco(precos);

        const celulas = Object.keys(mercados)
            .map(mercado => {
                const preco = precos[mercado];

                if (preco === null) {
                    return `
                        <div class="product-price-cell">
                            <strong>Indisponível</strong>
                        </div>
                    `;
                }

                const melhor = mercado === menorMercado;

                return `
                    <div class="product-price-cell ${melhor ? "best-price" : ""}">
                        <strong>${formatarMoeda(preco)}</strong>
                        ${melhor ? "<span>Melhor preço</span>" : ""}
                    </div>
                `;
            })
            .join("");

        const diferenca = menorMercado
            ? descreverDiferenca(precos, item.quantidade)
            : "";

        linha.innerHTML = `
            <div class="product-name-cell">
                <strong>${escaparHtml(produto.nome)}</strong>
                ${produto.marca ? `<span class="product-brand">${escaparHtml(produto.marca)}</span>` : ""}
                <span>${item.quantidade} ${item.quantidade === 1 ? "unidade" : "unidades"}</span>
                ${menorMercado ? `<span>Menor preço: ${mercados[menorMercado].nome}</span>` : `<span class="product-warning">Sem preço cadastrado</span>`}
                ${diferenca ? `<span class="product-diff">${diferenca}</span>` : ""}
            </div>
            ${celulas}
        `;

        comparacaoProdutos.appendChild(linha);
    });
}

// Explica de onde vêm os números: itens sem preço, mercados fora do ranking e a regra da economia.
function renderizarAvisos() {
    if (!lista.length) {
        avisoComparacao.textContent = "";
        return;
    }

    const avisos = [];

    const itensSemProduto = lista.filter(item => !obterProdutoDaLista(item));
    const itensComProduto = lista
        .map(item => obterProdutoDaLista(item))
        .filter(Boolean);

    if (itensSemProduto.length) {
        avisos.push(
            `${itensSemProduto.length} ${itensSemProduto.length === 1 ? "item não está" : "itens não estão"} mais disponível no catálogo e ficou fora dos totais.`
        );
    }

    const semNenhumPreco = itensComProduto.filter(produto =>
        Object.values(obterPrecosProduto(produto)).every(preco => preco === null)
    );

    if (itensComProduto.length && semNenhumPreco.length === itensComProduto.length) {
        avisos.push("Nenhum preço está disponível para os produtos desta lista, por isso não há comparação.");
        avisoComparacao.textContent = avisos.join(" ");
        return;
    }

    if (semNenhumPreco.length) {
        avisos.push(`Sem preço em nenhum mercado: ${semNenhumPreco.map(produto => produto.nome).join(", ")}.`);
    }

    const { disponiveis } = calcularTotais();
    const completos = Object.keys(mercados).filter(mercado => disponiveis[mercado]);
    const incompletos = Object.keys(mercados).filter(mercado => !disponiveis[mercado]);

    if (incompletos.length && completos.length) {
        avisos.push(
            `Fora do ranking por faltar preço de algum item: ${incompletos.map(m => mercados[m].nome).join(", ")}.`
        );
    }

    if (completos.length === 1) {
        avisos.push("Só um mercado tem preço para todos os itens, então não há economia a comparar.");
    }

    avisos.push(
        "Economia = total do mercado mais caro − total do mais barato, considerando apenas mercados com preço para todos os itens da lista."
    );

    avisoComparacao.textContent = avisos.join(" ");
}

// ------------------------------------------------------------------
// Rascunho local (localStorage) — separado das listas salvas no banco
// ------------------------------------------------------------------

function chaveLocal(nome) {
    return `economarket:${nome}:${obterIdUsuarioDoToken() ?? "anonimo"}`;
}

function sanearItens(itens) {
    if (!Array.isArray(itens)) return [];

    const vistos = new Set();
    const resultado = [];

    itens.forEach(item => {
        const produtoId = Number(item?.produtoId);
        const quantidade = Number(item?.quantidade);

        if (
            !Number.isInteger(produtoId) || produtoId < 1 ||
            !Number.isInteger(quantidade) || quantidade < 1 ||
            vistos.has(produtoId)
        ) {
            return;
        }

        vistos.add(produtoId);
        resultado.push({
            produtoId,
            quantidade: Math.min(quantidade, QUANTIDADE_MAXIMA)
        });
    });

    return resultado;
}

function lerLocal(nome) {
    try {
        const bruto = localStorage.getItem(chaveLocal(nome));

        if (!bruto) return null;

        const dados = JSON.parse(bruto);

        return {
            itens: sanearItens(dados.itens),
            listaId: Number.isInteger(dados.listaId) ? dados.listaId : null,
            listaNome: typeof dados.listaNome === "string" ? dados.listaNome : "",
            listaTipo: dados.listaTipo === "TEMPORARIA" ? "TEMPORARIA" : "FIXA"
        };
    } catch (error) {
        return null;
    }
}

function gravarLocal(nome, estado) {
    try {
        localStorage.setItem(chaveLocal(nome), JSON.stringify(estado));
    } catch (error) {
        console.warn("Não foi possível gravar o rascunho local:", error);
    }
}

function removerLocal(nome) {
    try {
        localStorage.removeItem(chaveLocal(nome));
    } catch (error) {
        // sem armazenamento disponível: nada a fazer
    }
}

function estadoAtual() {
    return {
        itens: lista.map(item => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade
        })),
        listaId: listaAberta ? listaAberta.id : null,
        listaNome: listaAberta ? listaAberta.nome : "",
        listaTipo: listaAberta ? listaAberta.tipo : "FIXA"
    };
}

function mesmosItens(a, b) {
    if (a.length !== b.length) return false;

    const mapa = new Map(a.map(item => [item.produtoId, item.quantidade]));

    return b.every(item => mapa.get(item.produtoId) === item.quantidade);
}

// Rascunho = estado atual da edição, atualizado a cada alteração.
function salvarRascunho() {
    gravarLocal("rascunho", estadoAtual());
}

// "Anterior" = lista que estava em edição antes de ser limpa ou substituída.
function guardarComoAnterior() {
    if (lista.length) {
        gravarLocal("anterior", estadoAtual());
    }
}

function aplicarEstado(estado) {
    lista = estado.itens.map(item => ({ ...item }));
    listaAberta = estado.listaId
        ? { id: estado.listaId, nome: estado.listaNome, tipo: estado.listaTipo }
        : null;
}

function obterListaParaRecuperar() {
    const anterior = lerLocal("anterior");

    if (anterior && anterior.itens.length) return { origem: "anterior", estado: anterior };

    const rascunho = lerLocal("rascunho");

    if (rascunho && rascunho.itens.length) return { origem: "rascunho", estado: rascunho };

    return null;
}

function mostrarMensagemLista(texto) {
    mensagemLista.textContent = texto || "";
}

function limparLista() {
    if (modo !== "edicao") return;

    if (!lista.length) {
        mostrarMensagemLista("A lista já está vazia.");
        return;
    }

    const confirmado = window.confirm(
        "Limpar todos os produtos da lista atual? As listas salvas na sua conta não serão excluídas."
    );

    if (!confirmado) return;

    guardarComoAnterior();

    lista = [];
    listaAberta = null;

    atualizarPagina();
    mostrarMensagemLista("Lista limpa. Use “Carregar última lista” para recuperá-la.");
}

function carregarUltimaLista() {
    if (modo !== "edicao") return;

    const candidata = obterListaParaRecuperar();

    if (!candidata) {
        mostrarMensagemLista("Não há nenhuma lista anterior guardada neste navegador.");
        return;
    }

    if (mesmosItens(lista, candidata.estado.itens)) {
        mostrarMensagemLista("Esta já é a lista que está na tela.");
        return;
    }

    if (lista.length) {
        const confirmado = window.confirm(
            "Substituir a lista atual pela última lista? A lista atual ficará guardada para você recuperá-la depois."
        );

        if (!confirmado) return;
    }

    const eraVazia = lista.length === 0;

    // A lista que está na tela nunca se perde: vira a "anterior".
    guardarComoAnterior();
    aplicarEstado(candidata.estado);

    if (eraVazia && candidata.origem === "anterior") {
        removerLocal("anterior");
    }

    atualizarPagina();
    mostrarMensagemLista("Última lista carregada.");
}

// ------------------------------------------------------------------
// Abertura de listas salvas (modo consulta) e edição
// ------------------------------------------------------------------

async function iniciarListaInicial() {
    const parametro = new URLSearchParams(window.location.search).get("lista");

    if (parametro !== null) {
        if (!/^\d+$/.test(parametro) || Number(parametro) < 1) {
            mostrarMensagemLista("Link de lista inválido.");
            history.replaceState(null, "", "main.html");
        } else if (!estaAutenticado()) {
            window.location.href = "login.html";
            return;
        } else {
            const aberta = await abrirListaSalva(Number(parametro));

            if (aberta) return;

            history.replaceState(null, "", "main.html");
        }
    }

    const rascunho = lerLocal("rascunho");

    if (rascunho && rascunho.itens.length) {
        aplicarEstado(rascunho);
        mostrarMensagemLista("Rascunho anterior recuperado.");
    }
}

async function abrirListaSalva(id) {
    mostrarMensagemLista("Carregando lista...");

    try {
        const dados = await apiRequest(`/api/listas-compras/${id}`);

        modo = "consulta";
        listaAberta = { id: dados.id, nome: dados.nome, tipo: dados.tipo };
        lista = (dados.itemlistacompra || []).map(item => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            nome: item.produto?.nome
        }));

        mostrarMensagemLista("");
        return true;
    } catch (error) {
        mostrarMensagemLista(
            `Não foi possível abrir a lista: ${error.message}. Mostrando o comparador normal.`
        );
        return false;
    }
}

function editarListaAberta() {
    if (modo !== "consulta" || !listaAberta) return;

    // O rascunho que existia antes continua guardado em "Carregar última lista".
    const rascunho = lerLocal("rascunho");

    if (rascunho && rascunho.itens.length) {
        gravarLocal("anterior", rascunho);
    }

    modo = "edicao";
    lista = lista.map(item => ({ produtoId: item.produtoId, quantidade: item.quantidade, nome: item.nome }));

    history.replaceState(null, "", "main.html");

    atualizarPagina();
    mostrarMensagemLista("Editando a lista salva. As alterações só são gravadas quando você clicar em “Salvar lista”.");
}

function sairDaLista() {
    if (modo === "consulta") {
        window.location.href = "main.html";
        return;
    }

    // Em edição: solta o vínculo; o conteúdo vira um rascunho novo.
    listaAberta = null;
    atualizarPagina();
    mostrarMensagemLista("A lista na tela agora é um rascunho novo; a lista salva não foi alterada.");
}

function atualizarInterfaceModo() {
    const consulta = modo === "consulta";

    formularioProduto.hidden = consulta;
    filtroCategorias.hidden = consulta;
    controlesLista.hidden = consulta;

    tituloLista.textContent = consulta ? "Itens da lista" : "Sua lista";

    if (!listaAberta) {
        bannerLista.hidden = true;
        return;
    }

    bannerLista.hidden = false;
    bannerListaNome.textContent = listaAberta.nome;

    const tipo = listaAberta.tipo === "FIXA" ? "Lista fixa" : "Lista temporária";

    bannerListaInfo.textContent = consulta
        ? `${tipo} · Modo de consulta`
        : `${tipo} · Em edição — grave com “Salvar lista”`;

    btnEditarLista.hidden = !consulta;
    btnSairLista.textContent = consulta ? "Voltar ao comparador" : "Parar de editar";
}

function atualizarBotoesLista() {
    const candidata = modo === "edicao" ? obterListaParaRecuperar() : null;

    btnCarregarUltima.disabled =
        !candidata || mesmosItens(lista, candidata.estado.itens);

    btnLimparLista.disabled = lista.length === 0;
    btnSalvarLista.disabled = salvandoLista;
}

// ------------------------------------------------------------------
// Salvar lista no banco
// ------------------------------------------------------------------

function abrirDialogSalvar() {
    if (modo !== "edicao") return;

    if (!lista.length) {
        mostrarMensagemLista("Adicione ao menos um produto antes de salvar a lista.");
        return;
    }

    if (!estaAutenticado()) {
        const entrar = window.confirm(
            "Você precisa entrar na sua conta para salvar listas. Seu rascunho continua guardado neste navegador. Ir para o login?"
        );

        if (entrar) window.location.href = "login.html";
        return;
    }

    if (lista.some(item => !obterProdutoDaLista(item))) {
        mostrarMensagemLista("Remova os produtos indisponíveis (marcados em vermelho) antes de salvar.");
        return;
    }

    erroSalvarLista.textContent = "";

    nomeListaInput.value = listaAberta ? listaAberta.nome : "";

    const tipo = listaAberta ? listaAberta.tipo : "FIXA";
    formSalvarLista.querySelector(`input[name="tipoLista"][value="${tipo}"]`).checked = true;

    opcoesAtualizar.hidden = !listaAberta;

    if (listaAberta) {
        textoAtualizar.textContent = `Atualizar a lista “${listaAberta.nome}”`;
        formSalvarLista.querySelector('input[name="destino"][value="atualizar"]').checked = true;
    }

    dialogSalvarLista.showModal();
    nomeListaInput.focus();
}

async function confirmarSalvarLista(event) {
    event.preventDefault();

    // Evita requisições duplicadas por cliques repetidos.
    if (salvandoLista) return;

    const nome = nomeListaInput.value.trim();
    const tipo = formSalvarLista.querySelector('input[name="tipoLista"]:checked').value;
    const destino = listaAberta
        ? formSalvarLista.querySelector('input[name="destino"]:checked').value
        : "nova";

    if (!nome) {
        erroSalvarLista.textContent = "Informe um nome para a lista.";
        nomeListaInput.focus();
        return;
    }

    if (nome.length > 100) {
        erroSalvarLista.textContent = "O nome pode ter no máximo 100 caracteres.";
        return;
    }

    if (!lista.length) {
        erroSalvarLista.textContent = "A lista está vazia.";
        return;
    }

    const corpo = {
        nome,
        tipo,
        itens: lista.map(item => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade
        }))
    };

    const atualizando = destino === "atualizar";

    salvandoLista = true;
    btnConfirmarSalvar.disabled = true;
    erroSalvarLista.textContent = "";

    try {
        const salva = await apiRequest(
            atualizando
                ? `/api/listas-compras/${listaAberta.id}`
                : "/api/listas-compras",
            {
                method: atualizando ? "PUT" : "POST",
                body: JSON.stringify(corpo)
            }
        );

        listaAberta = { id: salva.id, nome: salva.nome, tipo: salva.tipo };

        dialogSalvarLista.close();
        atualizarPagina();

        mostrarMensagemLista(
            `Lista “${salva.nome}” ${atualizando ? "atualizada" : "salva"} com sucesso. Ela está em “Minhas listas”, no perfil.`
        );
    } catch (error) {
        if (atualizando && /não encontrada/i.test(error.message)) {
            // A lista original foi excluída em outro lugar: oferece salvar como nova.
            listaAberta = null;
            opcoesAtualizar.hidden = true;
            erroSalvarLista.textContent =
                "A lista original não existe mais. Clique em Salvar para criá-la como uma nova lista.";
        } else {
            erroSalvarLista.textContent = error.message;
        }
    } finally {
        salvandoLista = false;
        btnConfirmarSalvar.disabled = false;
        atualizarBotoesLista();
    }
}

function atualizarPagina() {
    // O rascunho só é gravado depois que a restauração inicial terminou
    // e somente na edição: abrir uma lista salva nunca o sobrescreve.
    if (inicializado && modo === "edicao") {
        salvarRascunho();
    }

    atualizarInterfaceModo();
    renderizarLista();
    renderizarTotais();
    renderizarComparacaoProdutos();
    renderizarAvisos();
    atualizarBotoesLista();
}
