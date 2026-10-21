
const valorSelic = document.querySelector("#valor-selic");
const valorIpca = document.querySelector("#valor-ipca");
const mensagem = document.querySelector("#mensagem");
const canvas = document.querySelector("#grafico-selic");

const API = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

async function consultarSerie(codigo, quantidade = 12) {
    const url =
        `${API}.${codigo}/dados/ultimos/${quantidade}?formato=json`;

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

    const historico = [...dados].sort(
        (a, b) =>
            converterData(a.data) - converterData(b.data)
    );

    const existente = Chart.getChart(canvas);

    if (existente) {
        existente.destroy();
    }

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
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3
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

    // Carrega a Selic independentemente do IPCA.
    try {
        const dadosSelic = await consultarSerie(432);

        const hoje = new Date();
        hoje.setHours(23, 59, 59, 999);

        const observacaoSelic = dadosSelic
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

    // O IPCA é consultado separadamente.
    try {
        const dadosIpca = await consultarSerie(433);

        const observacaoIpca = [...dadosIpca].sort(
            (a, b) =>
                converterData(b.data) - converterData(a.data)
        )[0];

        valorIpca.textContent =
            formatarPercentual(observacaoIpca.valor);
    } catch (erro) {
        console.error("Erro no IPCA:", erro);
        valorIpca.textContent = "Indisponível";
        erros.push(`IPCA: ${erro.message}`);
    }

    mensagem.textContent = erros.length
        ? `Alguns dados não carregaram: ${erros.join(" | ")}`
        : "Indicadores carregados. " +
          "Os períodos de referência são informados pela API.";
}

carregarIndicadores();
