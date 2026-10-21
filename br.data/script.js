const valorSelic = document.querySelector("#valor-selic");
const valorIpca = document.querySelector("#valor-ipca");
const mensagem = document.querySelector("#mensagem");
const canvas = document.querySelector("#grafico-selic");

const API = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

// O Banco Central exige filtros de data para séries diárias.
// Consultamos os últimos 12 meses em vez de usar /ultimos/12.
function formatarDataConsulta(data) {
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();

    return `${dia}/${mes}/${ano}`;
}

async function consultarSerie(codigo, meses = 12) {
    const dataFinal = new Date();
    const dataInicial = new Date();
    dataInicial.setMonth(dataInicial.getMonth() - meses);

    const parametros = new URLSearchParams({
        formato: "json",
        dataInicial: formatarDataConsulta(dataInicial),
        dataFinal: formatarDataConsulta(dataFinal)
    });

    const url = `${API}.${codigo}/dados?${parametros.toString()}`;
    const resposta = await fetch(url);

    if (!resposta.ok) {
        throw new Error(`Série ${codigo}: HTTP ${resposta.status}`);
    }

    const dados = await resposta.json();

    if (!Array.isArray(dados) || dados.length === 0) {
        throw new Error(`Série ${codigo}: nenhum dado recebido.`);
    }

    return dados;
}

function converterData(data) {
    const [dia, mes, ano] = data.split("/");
    return new Date(Number(ano), Number(mes) - 1, Number(dia));
}

function formatarPercentual(valor) {
    return `${Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}%`;
}

function criarGrafico(dados) {
    if (typeof Chart === "undefined") {
        throw new Error("Chart.js não foi carregado.");
    }

    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);

    // A série da Meta Selic pode incluir datas futuras.
    const historico = dados
        .filter(item => converterData(item.data) <= hoje)
        .sort((a, b) =>
            converterData(a.data) - converterData(b.data)
        );

    if (!historico.length) {
        throw new Error("Não há observações históricas para o gráfico.");
    }

    const existente = Chart.getChart(canvas);
    if (existente) existente.destroy();

    new Chart(canvas, {
        type: "line",
        data: {
            labels: historico.map(item => item.data),
            datasets: [{
                label: "Meta Selic (% ao ano)",
                data: historico.map(item => Number(item.valor)),
                borderColor: "#4ade80",
                backgroundColor: "rgba(74, 222, 128, 0.12)",
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: "#d4d4d8" }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#a1a1aa",
                        maxTicksLimit: 6
                    },
                    grid: { display: false }
                },
                y: {
                    ticks: {
                        color: "#a1a1aa",
                        callback: valor => `${valor}%`
                    },
                    grid: { color: "#30313a" }
                }
            }
        }
    });
}

async function carregarIndicadores() {
    const erros = [];
    mensagem.textContent = "Consultando Banco Central...";

    try {
        const dadosSelic = await consultarSerie(432);
        const hoje = new Date();
        hoje.setHours(23, 59, 59, 999);

        const observacaoSelic = [...dadosSelic]
            .filter(item => converterData(item.data) <= hoje)
            .sort((a, b) =>
                converterData(b.data) - converterData(a.data)
            )[0];

        if (!observacaoSelic) {
            throw new Error("Não foi encontrada uma observação atual.");
        }

        valorSelic.textContent =
            formatarPercentual(observacaoSelic.valor);

        try {
            criarGrafico(dadosSelic);
        } catch (erro) {
            console.error("Erro no gráfico:", erro);
            erros.push(`Gráfico: ${erro.message}`);
        }
    } catch (erro) {
        console.error("Erro na Selic:", erro);
        valorSelic.textContent = "Indisponível";
        erros.push(`Selic: ${erro.message}`);
    }

    try {
        const dadosIpca = await consultarSerie(433);
        const observacaoIpca = [...dadosIpca].sort(
            (a, b) =>
                converterData(b.data) - converterData(a.data)
        )[0];

        if (!observacaoIpca) {
            throw new Error("Não foi encontrada uma observação do IPCA.");
        }

        valorIpca.textContent =
            formatarPercentual(observacaoIpca.valor);
    } catch (erro) {
        console.error("Erro no IPCA:", erro);
        valorIpca.textContent = "Indisponível";
        erros.push(`IPCA: ${erro.message}`);
    }

    mensagem.textContent = erros.length
        ? `Alguns dados não carregaram: ${erros.join(" | ")}`
        : "Indicadores carregados. Os períodos de referência são informados pela API.";
}

carregarIndicadores();


// =========================
// TRANSPARÊNCIA PARLAMENTAR
// API oficial: Dados Abertos da Câmara dos Deputados
// =========================

const API_CAMARA = "https://dadosabertos.camara.leg.br/api/v2";
const filtroUf = document.querySelector("#filtro-uf");
const filtroPartido = document.querySelector("#filtro-partido");
const filtroDeputado = document.querySelector("#filtro-deputado");
const filtroAno = document.querySelector("#filtro-ano");
const filtroMes = document.querySelector("#filtro-mes");
const botaoBuscarGastos = document.querySelector("#buscar-gastos");
const mensagemGastos = document.querySelector("#mensagem-gastos");
const totalGastos = document.querySelector("#total-gastos");
const quantidadeGastos = document.querySelector("#quantidade-gastos");
const categoriaPrincipal = document.querySelector("#categoria-principal");
const linhasGastos = document.querySelector("#linhas-gastos");
const canvasGastos = document.querySelector("#grafico-gastos");

let deputados = [];
let graficoGastos = null;

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function criarOpcao(valor, texto) {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = texto;
    return opcao;
}

async function consultarCamara(caminho, parametros = {}) {
    const url = new URL(`${API_CAMARA}/${caminho}`);
    Object.entries(parametros).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== "") {
            url.searchParams.set(chave, valor);
        }
    });

    const resposta = await fetch(url, {
        headers: { Accept: "application/json" }
    });

    if (!resposta.ok) {
        throw new Error(`A Câmara retornou HTTP ${resposta.status}.`);
    }

    const dados = await resposta.json();
    if (!Array.isArray(dados.dados)) {
        throw new Error("A resposta da Câmara veio em um formato inesperado.");
    }

    return dados.dados;
}

async function carregarDeputados() {
    mensagemGastos.textContent = "Carregando lista oficial de deputados...";
    try {
        const lista = [];
        // A API é paginada; buscar em lotes evita depender de uma página só.
        for (let pagina = 1; pagina <= 10; pagina++) {
            const lote = await consultarCamara("deputados", {
                itens: 100,
                pagina,
                ordem: "ASC",
                ordenarPor: "nome"
            });
            lista.push(...lote);
            if (lote.length < 100) break;
        }

        deputados = lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        const ufs = [...new Set(deputados.map(d => d.siglaUf).filter(Boolean))].sort();
        const partidos = [...new Set(deputados.map(d => d.siglaPartido).filter(Boolean))].sort();

        ufs.forEach(uf => filtroUf.appendChild(criarOpcao(uf, uf)));
        partidos.forEach(partido => filtroPartido.appendChild(criarOpcao(partido, partido)));

        atualizarListaDeputados();
        filtroDeputado.disabled = false;
        botaoBuscarGastos.disabled = false;
        mensagemGastos.textContent = `${deputados.length} deputados carregados da API oficial. Escolha os filtros e consulte as despesas.`;
    } catch (erro) {
        console.error("Erro ao carregar deputados:", erro);
        filtroDeputado.innerHTML = "";
        filtroDeputado.appendChild(criarOpcao("", "Não foi possível carregar"));
        mensagemGastos.textContent = `Não foi possível carregar a Câmara: ${erro.message} Verifique sua conexão e tente recarregar a página.`;
    }
}

function atualizarListaDeputados() {
    const ufSelecionada = filtroUf.value;
    const partidoSelecionado = filtroPartido.value;
    const filtrados = deputados.filter(deputado =>
        (!ufSelecionada || deputado.siglaUf === ufSelecionada) &&
        (!partidoSelecionado || deputado.siglaPartido === partidoSelecionado)
    );

    filtroDeputado.innerHTML = "";
    filtroDeputado.appendChild(criarOpcao("", "Selecione um deputado"));
    filtrados.forEach(deputado => {
        const legenda = `${deputado.nome} — ${deputado.siglaUf}/${deputado.siglaPartido || "s/ partido"}`;
        const opcao = criarOpcao(deputado.id, legenda);
        filtroDeputado.appendChild(opcao);
    });
    filtroDeputado.disabled = filtrados.length === 0;
    botaoBuscarGastos.disabled = filtrados.length === 0;
}

function limparResumoGastos(mensagem = "Selecione um deputado para consultar.") {
    totalGastos.textContent = "—";
    quantidadeGastos.textContent = "—";
    categoriaPrincipal.textContent = "—";
    linhasGastos.replaceChildren();
    const linha = document.createElement("tr");
    const celula = document.createElement("td");
    celula.colSpan = 5;
    celula.className = "tabela-vazia";
    celula.textContent = mensagem;
    linha.appendChild(celula);
    linhasGastos.appendChild(linha);
    if (graficoGastos) {
        graficoGastos.destroy();
        graficoGastos = null;
    }
}

async function consultarDespesas(deputadoId, ano, mes) {
    const despesas = [];
    // A consulta anual pode ter várias páginas. Limitamos a 10 mil registros
    // como proteção contra uma resposta inesperadamente grande.
    for (let pagina = 1; pagina <= 100; pagina++) {
        const lote = await consultarCamara(`deputados/${deputadoId}/despesas`, {
            // A API da Câmara deixou de inferir a legislatura atual automaticamente.
            // 57 é a legislatura vigente (2023–2027).
            idLegislatura: 57,
            ano,
            mes,
            itens: 100,
            pagina,
            ordem: "DESC",
            ordenarPor: "dataDocumento"
        });
        despesas.push(...lote);
        if (lote.length < 100) break;
    }
    return despesas;
}

function desenharGraficoCategorias(categorias) {
    if (typeof Chart === "undefined") {
        throw new Error("A biblioteca de gráficos não carregou.");
    }

    if (graficoGastos) graficoGastos.destroy();

    const principais = [...categorias.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    graficoGastos = new Chart(canvasGastos, {
        type: "bar",
        data: {
            labels: principais.map(([nome]) => nome),
            datasets: [{
                label: "Valor líquido",
                data: principais.map(([, valor]) => Number(valor.toFixed(2))),
                backgroundColor: "rgba(74, 222, 128, 0.72)",
                borderColor: "#4ade80",
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: contexto => formatarMoeda(contexto.raw)
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#a1a1aa",
                        callback: valor => Number(valor).toLocaleString("pt-BR")
                    },
                    grid: { color: "#30313a" }
                },
                y: {
                    ticks: { color: "#d4d4d8" },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderizarTabelaDespesas(despesas) {
    linhasGastos.replaceChildren();
    const maiores = [...despesas]
        .sort((a, b) => Number(b.valorLiquido || 0) - Number(a.valorLiquido || 0))
        .slice(0, 100);

    if (!maiores.length) {
        const linha = document.createElement("tr");
        const celula = document.createElement("td");
        celula.colSpan = 5;
        celula.className = "tabela-vazia";
        celula.textContent = "Nenhuma despesa encontrada para esse período.";
        linha.appendChild(celula);
        linhasGastos.appendChild(linha);
        return;
    }

    maiores.forEach(despesa => {
        const linha = document.createElement("tr");
        const data = despesa.dataDocumento
            ? new Date(`${despesa.dataDocumento}T12:00:00`).toLocaleDateString("pt-BR")
            : "Sem data";
        const valores = [
            data,
            despesa.tipoDespesa || "Não informado",
            despesa.nomeFornecedor || "Fornecedor não informado"
        ];

        valores.forEach(valor => {
            const celula = document.createElement("td");
            celula.textContent = valor;
            linha.appendChild(celula);
        });

        const celulaDocumento = document.createElement("td");
        if (despesa.urlDocumento) {
            const link = document.createElement("a");
            link.href = despesa.urlDocumento;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Abrir ↗";
            link.setAttribute("aria-label", "Abrir documento original em nova aba");
            celulaDocumento.appendChild(link);
        } else {
            celulaDocumento.textContent = "—";
        }
        linha.appendChild(celulaDocumento);

        const celulaValor = document.createElement("td");
        celulaValor.className = "valor-coluna";
        celulaValor.textContent = formatarMoeda(despesa.valorLiquido);
        linha.appendChild(celulaValor);
        linhasGastos.appendChild(linha);
    });
}

async function carregarDespesasDeputado() {
    const deputadoId = filtroDeputado.value;
    if (!deputadoId) {
        mensagemGastos.textContent = "Selecione um deputado antes de consultar.";
        limparResumoGastos();
        return;
    }

    const deputado = deputados.find(item => String(item.id) === String(deputadoId));
    const ano = filtroAno.value;
    const mes = filtroMes.value;
    const periodo = mes
        ? `${String(mes).padStart(2, "0")}/${ano}`
        : ano;

    botaoBuscarGastos.disabled = true;
    mensagemGastos.textContent = `Consultando despesas de ${deputado?.nome || "deputado"} em ${periodo}...`;
    limparResumoGastos("Buscando registros na API oficial...");

    try {
        const despesas = await consultarDespesas(deputadoId, ano, mes);
        const total = despesas.reduce((soma, item) => soma + Number(item.valorLiquido || 0), 0);
        const categorias = new Map();

        despesas.forEach(despesa => {
            const categoria = despesa.tipoDespesa || "Categoria não informada";
            categorias.set(categoria, (categorias.get(categoria) || 0) + Number(despesa.valorLiquido || 0));
        });

        totalGastos.textContent = formatarMoeda(total);
        quantidadeGastos.textContent = despesas.length.toLocaleString("pt-BR");
        const principal = [...categorias.entries()].sort((a, b) => b[1] - a[1])[0];
        categoriaPrincipal.textContent = principal
            ? principal[0].length > 28 ? principal[0].slice(0, 25) + "…" : principal[0]
            : "Sem dados";

        if (despesas.length) {
            desenharGraficoCategorias(categorias);
        } else if (graficoGastos) {
            graficoGastos.destroy();
            graficoGastos = null;
        }

        renderizarTabelaDespesas(despesas);
        mensagemGastos.textContent = despesas.length
            ? `${despesas.length.toLocaleString("pt-BR")} registros retornados para ${deputado?.nome || "o deputado"} em ${periodo}. A tabela mostra até 100 despesas ordenadas pelo valor líquido.`
            : `Nenhuma despesa encontrada para ${deputado?.nome || "o deputado"} em ${periodo}.`;
    } catch (erro) {
        console.error("Erro ao consultar despesas:", erro);
        limparResumoGastos("Não foi possível carregar os registros.");
        mensagemGastos.textContent = `Erro ao consultar despesas: ${erro.message} Tente novamente em instantes.`;
    } finally {
        botaoBuscarGastos.disabled = false;
    }
}

filtroUf.addEventListener("change", atualizarListaDeputados);
filtroPartido.addEventListener("change", atualizarListaDeputados);
botaoBuscarGastos.addEventListener("click", carregarDespesasDeputado);
carregarDeputados();
