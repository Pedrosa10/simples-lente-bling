// ==UserScript==
// @name         Simples Lente - Painel de Prioridades
// @namespace    https://simpleslente.com.br/
// @version      1.0.0
// @description  Painel de pedidos Urgentes e Importantes da Simples Lente no Bling
// @match        https://www.bling.com.br/*
// @updateURL    https://raw.githubusercontent.com/Pedrosa10/simples-lente-bling/refs/heads/main/simples-lente-painel-prioridades.user.js
// @downloadURL  https://raw.githubusercontent.com/Pedrosa10/simples-lente-bling/refs/heads/main/simples-lente-painel-prioridades.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /******************************************************************
     * CONFIGURAÇÕES
     ******************************************************************/

    const MAX_PAGES = 10;

    // Situações que NÃO devem aparecer no painel
    const IGNORED_STATUS_IDS = new Set([
        '9',   // Atendido
        '12',  // Cancelado
        '18'   // Venda Agenciada
    ]);

    // Situações que já conhecemos
    const STATUS_NAMES = {
        '411304': 'Importado Shopify',
        '6':      'Em aberto',
        '320917': 'Montagem Interna',
        '734015': 'Em Separação',
        '731217': 'Aguardando Cliente',
        '715698': 'Em Aberto (sem lente)',
        '828946': 'Em Aberto (grade)',
        '829314': 'Em Aberto (lente externa)',
        '828947': 'Receita em Digitação',
        '731251': 'Conferido',
        '828948': 'Erro ou Pendência',
        '9':      'Atendido',
        '12':     'Cancelado',
        '18':     'Venda Agenciada'
    };

    let priorities = [];
    let isLoading = false;


    /******************************************************************
     * CSS
     ******************************************************************/

    const style = document.createElement('style');

    style.textContent = `
        #sl-priority-button {
            position: fixed;
            right: 25px;
            bottom: 25px;
            z-index: 99998;

            background: #343a40;
            color: white;

            border: 0;
            border-radius: 6px;

            padding: 11px 17px;

            font-size: 14px;
            font-weight: 600;

            cursor: pointer;

            box-shadow: 0 3px 10px rgba(0,0,0,.25);
        }

        #sl-priority-button:hover {
            background: #23272b;
        }

        #sl-priority-button .sl-urgent-count {
            background: #dc3545;
            color: white;

            padding: 2px 7px;
            margin-left: 7px;

            border-radius: 10px;

            font-size: 12px;
        }

        #sl-priority-button .sl-important-count {
            background: #ffc107;
            color: #212529;

            padding: 2px 7px;
            margin-left: 4px;

            border-radius: 10px;

            font-size: 12px;
        }


        /**************************************************************
         * OVERLAY
         **************************************************************/

        #sl-priority-overlay {
            display: none;

            position: fixed;
            inset: 0;

            background: rgba(0,0,0,.45);

            z-index: 99999;

            padding: 30px;

            box-sizing: border-box;
        }

        #sl-priority-panel {
            background: white;

            max-width: 1400px;
            height: calc(100vh - 60px);

            margin: auto;

            border-radius: 8px;

            display: flex;
            flex-direction: column;

            overflow: hidden;

            box-shadow: 0 10px 35px rgba(0,0,0,.35);
        }


        /**************************************************************
         * HEADER
         **************************************************************/

        .sl-panel-header {
            padding: 18px 22px;

            border-bottom: 1px solid #ddd;

            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .sl-panel-title {
            font-size: 21px;
            font-weight: 600;
        }

        .sl-panel-actions {
            display: flex;
            gap: 8px;
        }

        .sl-panel-actions button {
            border: 1px solid #ccc;
            background: white;

            border-radius: 4px;

            padding: 7px 12px;

            cursor: pointer;
        }

        .sl-panel-actions button:hover {
            background: #f5f5f5;
        }


        /**************************************************************
         * RESUMO
         **************************************************************/

        .sl-summary {
            padding: 13px 22px;

            background: #f8f9fa;

            border-bottom: 1px solid #ddd;

            display: flex;
            align-items: center;

            gap: 10px;
        }

        .sl-summary-urgent {
            background: #dc3545;
            color: white;

            padding: 5px 10px;

            border-radius: 4px;

            font-weight: 600;
        }

        .sl-summary-important {
            background: #ffc107;
            color: #212529;

            padding: 5px 10px;

            border-radius: 4px;

            font-weight: 600;
        }

        .sl-summary-info {
            color: #777;
            margin-left: 5px;
        }


        /**************************************************************
         * TABELA
         **************************************************************/

        .sl-table-wrapper {
            flex: 1;
            overflow: auto;
        }

        #sl-priority-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        #sl-priority-table th {
            position: sticky;
            top: 0;

            background: #f1f3f5;

            text-align: left;

            padding: 10px;

            border-bottom: 2px solid #ccc;

            z-index: 2;
        }

        #sl-priority-table td {
            padding: 9px 10px;

            border-bottom: 1px solid #e5e5e5;

            vertical-align: top;
        }

        #sl-priority-table tr:hover td {
            background: #f7f7f7;
        }

        #sl-priority-table tr.sl-row-urgent td:first-child {
            border-left: 5px solid #dc3545;
        }

        #sl-priority-table tr.sl-row-important td:first-child {
            border-left: 5px solid #ffc107;
        }


        /**************************************************************
         * BADGES
         **************************************************************/

        .sl-badge {
            display: inline-block;

            padding: 4px 8px;

            border-radius: 4px;

            font-size: 11px;
            font-weight: 600;

            white-space: nowrap;
        }

        .sl-badge-urgent {
            background: #dc3545;
            color: white;
        }

        .sl-badge-important {
            background: #ffc107;
            color: #212529;
        }

        .sl-order-link {
            color: #007bff;

            font-weight: 600;

            cursor: pointer;

            text-decoration: none;
        }

        .sl-order-link:hover {
            text-decoration: underline;
        }

        .sl-observation {
            max-width: 400px;

            white-space: pre-line;

            color: #555;
        }


        /**************************************************************
         * LOADING
         **************************************************************/

        #sl-loading {
            display: none;

            padding: 40px;

            text-align: center;

            font-size: 16px;
        }

        #sl-empty {
            display: none;

            padding: 40px;

            text-align: center;

            color: #777;
        }
    `;

    document.head.appendChild(style);


    /******************************************************************
     * HELPERS
     ******************************************************************/

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }


    function getPriority(text) {

        const firstLine = (text || '')
            .split(/\r?\n/)[0]
            .trim()
            .toUpperCase();

        if (firstLine === 'URGENTE!') {
            return 'urgente';
        }

        if (firstLine === 'IMPORTANTE!') {
            return 'importante';
        }

        return null;
    }


    function getObservationWithoutPriority(text) {

        if (!text) {
            return '';
        }

        const lines = text.split(/\r?\n/);

        const firstLine = lines[0]
            .trim()
            .toUpperCase();

        if (
            firstLine === 'URGENTE!' ||
            firstLine === 'IMPORTANTE!'
        ) {
            lines.shift();
        }

        return lines.join('\n').trim();
    }


    function shouldIgnoreOrder(order) {

        return IGNORED_STATUS_IDS.has(
            String(order.idSituacao)
        );
    }


    function getStatusName(order) {

        const id = String(order.idSituacao);

        return STATUS_NAMES[id] ||
               `Situação ${id}`;
    }


    function formatDate(date) {

        if (!date || date === '0000-00-00') {
            return '—';
        }

        const parts = date.split('-');

        if (parts.length !== 3) {
            return date;
        }

        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }


    /******************************************************************
     * CONSTRUIR URL DA API
     ******************************************************************/

    function buildApiUrl(page) {

        /*
         * Usamos período amplo para não depender do filtro que
         * estiver selecionado na tela.
         *
         * O limite real continuará sendo MAX_PAGES.
         */

        const end = new Date();

        const start = new Date();
        start.setDate(start.getDate() - 90);

        const formatBR = date => {

            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();

            return `${d}/${m}/${y}`;
        };

        const params = new URLSearchParams({

            pesquisa: '',

            idContatoConsulta: '0',

            unidadesNegocioSelect: '0',

            toggleDefinirSituacaoPadrao: 'false',

            fatura: 'T',

            idPsqVendedor: '0',

            psqVendedor: '',

            idProduto: '0',

            nomePsqProduto: '',

            filtroLote: '',

            tipoPedido: '',

            postalCode: '',

            pesquisaBairro: '',

            municipioPsq: '',

            idMunicipioPsq: '',

            psqEstado: '',

            idIntegracaoLogistica: '',

            situacaoObjetoCorreios: '',

            situacaoAutoBuyMe: '',

            filtroFretesPrioritarios: '',

            codRastreio: '',

            idComponente: '0',

            nomePsqComponente: '',

            idPsqTransportador: '0',

            psqTransportador: '',

            psqNumeroPedidoDaLojaVirtual: '',

            numeroOrdemCompra: '',

            pagina: String(page),

            lojasVinculadas: 'todas',

            dataAlteracaoIni: formatBR(start),

            dataAlteracaoFim: formatBR(end),

            criterio: 'periodo',

            criterioPeriod: 'Período customizado',

            situacao: '',

            idVendedor: '0',

            idTransportador: '0',

            situacaoRastro: '',

            transportador: '',

            idLoja: 'todas',

            idConfUnidadeNegocio: '0',

            situacaoEnvioFatura: 'T',

            idContato: '0',

            uf: '',

            idMunicipio: '',

            bairro: '',

            dataIni: formatBR(start),

            dataFim: formatBR(end),

            view: 'custom-columns'
        });

        return (
            'https://www.bling.com.br/Api/v3/vendasinternal/list?' +
            params.toString()
        );
    }


    /******************************************************************
     * BUSCAR UMA PÁGINA
     ******************************************************************/

    async function fetchPage(page) {

        const url = buildApiUrl(page);

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json, text/plain, */*'
            }
        });

        if (!response.ok) {
            throw new Error(
                `Erro ao carregar página ${page}: HTTP ${response.status}`
            );
        }

        return await response.json();
    }


    /******************************************************************
     * BUSCAR PRIORIDADES
     ******************************************************************/

    async function loadPriorities() {

        if (isLoading) {
            return;
        }

        isLoading = true;

        showLoading(true);

        priorities = [];

        let ordersChecked = 0;
        let pagesChecked = 0;

        try {

            /*
             * Fazemos sequencialmente de propósito.
             *
             * Evita disparar 10 requisições simultâneas
             * contra o Bling.
             */

            for (
                let page = 1;
                page <= MAX_PAGES;
                page++
            ) {

                updateLoadingText(
                    `Verificando página ${page} de ${MAX_PAGES}...`
                );

                const response = await fetchPage(page);

                const orders =
                    Array.isArray(response.data)
                        ? response.data
                        : [];

                pagesChecked++;

                ordersChecked += orders.length;

                for (const order of orders) {

                    if (shouldIgnoreOrder(order)) {
                        continue;
                    }

                    const priority =
                        getPriority(order.observacaoInterna);

                    if (!priority) {
                        continue;
                    }

                    priorities.push({
                        id: order.id,
                        numeroPedido: order.numeroPedido,
                        data: order.data,
                        dataPrevista: order.dataPrevista,
                        nome: order.nome || '',
                        transportador: order.transportador || '',
                        idSituacao: order.idSituacao,
                        status: getStatusName(order),
                        priority,
                        observation:
                            getObservationWithoutPriority(
                                order.observacaoInterna
                            )
                    });
                }


                /*
                 * Se vier menos de 100 pedidos,
                 * provavelmente chegamos à última página.
                 */

                if (orders.length < 100) {
                    break;
                }


                /*
                 * Pequeno intervalo para não bombardear
                 * o servidor.
                 */

                await new Promise(resolve =>
                    setTimeout(resolve, 150)
                );
            }


            /**********************************************************
             * ORDENAÇÃO
             *
             * 1. Urgentes
             * 2. Importantes
             * 3. Mais antigos primeiro
             **********************************************************/

            priorities.sort((a, b) => {

                if (a.priority !== b.priority) {

                    return a.priority === 'urgente'
                        ? -1
                        : 1;
                }

                return String(a.data)
                    .localeCompare(String(b.data));
            });


            renderPriorities(
                priorities,
                ordersChecked,
                pagesChecked
            );

        } catch (error) {

            console.error(
                '[Simples Lente Prioridades]',
                error
            );

            alert(
                'Não foi possível carregar o Painel de Prioridades.\n\n' +
                error.message +
                '\n\nAbra o Console do navegador para mais detalhes.'
            );

        } finally {

            isLoading = false;

            showLoading(false);
        }
    }


    /******************************************************************
     * ABRIR PEDIDO
     ******************************************************************/

    function openOrder(order) {

        /*
         * Primeiro tentamos usar o ID interno do Bling.
         *
         * Como a URL exata da edição pode variar entre versões
         * do Bling, deixamos a função isolada para ser fácil
         * ajustar depois.
         */

        const possibleUrls = [
            `/vendas.php#edit/${order.id}`,
            `/vendas.php#edit/${order.numeroPedido}`
        ];

        window.open(
            possibleUrls[0],
            '_blank'
        );
    }


    /******************************************************************
     * RENDERIZAR TABELA
     ******************************************************************/

    function renderPriorities(
        orders,
        ordersChecked,
        pagesChecked
    ) {

        const tbody =
            document.querySelector(
                '#sl-priority-table tbody'
            );

        if (!tbody) {
            return;
        }

        tbody.innerHTML = '';


        const urgentCount =
            orders.filter(
                o => o.priority === 'urgente'
            ).length;


        const importantCount =
            orders.filter(
                o => o.priority === 'importante'
            ).length;


        document.querySelector(
            '#sl-summary-urgent'
        ).textContent =
            `🚨 ${urgentCount} Urgentes`;


        document.querySelector(
            '#sl-summary-important'
        ).textContent =
            `⚠ ${importantCount} Importantes`;


        document.querySelector(
            '#sl-summary-info'
        ).textContent =
            `${ordersChecked} pedidos verificados · ${pagesChecked} páginas`;


        updateFloatingButton(
            urgentCount,
            importantCount
        );


        const empty =
            document.querySelector('#sl-empty');

        if (!orders.length) {

            empty.style.display = 'block';

            return;
        }

        empty.style.display = 'none';


        orders.forEach(order => {

            const tr =
                document.createElement('tr');

            tr.className =
                order.priority === 'urgente'
                    ? 'sl-row-urgent'
                    : 'sl-row-important';


            const priorityBadge =
                order.priority === 'urgente'

                    ? `
                        <span class="
                            sl-badge
                            sl-badge-urgent
                        ">
                            🚨 URGENTE
                        </span>
                    `

                    : `
                        <span class="
                            sl-badge
                            sl-badge-important
                        ">
                            ⚠ IMPORTANTE
                        </span>
                    `;


            tr.innerHTML = `

                <td>
                    <a
                        href="#"
                        class="sl-order-link"
                        data-order-id="${escapeHTML(order.id)}"
                        data-order-number="${escapeHTML(order.numeroPedido)}"
                    >
                        ${escapeHTML(order.numeroPedido)}
                    </a>
                </td>

                <td>
                    ${formatDate(order.data)}
                </td>

                <td>
                    ${formatDate(order.dataPrevista)}
                </td>

                <td>
                    ${escapeHTML(order.nome)}
                </td>

                <td>
                    ${escapeHTML(order.status)}
                </td>

                <td>
                    ${priorityBadge}
                </td>

                <td class="sl-observation">
                    ${
                        order.observation
                            ? escapeHTML(order.observation)
                            : '—'
                    }
                </td>

            `;


            tbody.appendChild(tr);
        });


        tbody
            .querySelectorAll('.sl-order-link')
            .forEach(link => {

                link.addEventListener(
                    'click',
                    event => {

                        event.preventDefault();

                        const order = {
                            id:
                                link.dataset.orderId,

                            numeroPedido:
                                link.dataset.orderNumber
                        };

                        openOrder(order);
                    }
                );
            });
    }


    /******************************************************************
     * BOTÃO FLUTUANTE
     ******************************************************************/

    function updateFloatingButton(
        urgentCount = null,
        importantCount = null
    ) {

        const button =
            document.querySelector(
                '#sl-priority-button'
            );

        if (!button) {
            return;
        }

        if (
            urgentCount === null ||
            importantCount === null
        ) {

            button.innerHTML =
                '⚡ Prioridades';

            return;
        }

        button.innerHTML = `
            ⚡ Prioridades

            <span class="sl-urgent-count">
                ${urgentCount}
            </span>

            <span class="sl-important-count">
                ${importantCount}
            </span>
        `;
    }


    /******************************************************************
     * LOADING
     ******************************************************************/

    function showLoading(show) {

        const loading =
            document.querySelector('#sl-loading');

        const table =
            document.querySelector(
                '.sl-table-wrapper'
            );

        if (!loading || !table) {
            return;
        }

        loading.style.display =
            show ? 'block' : 'none';

        table.style.opacity =
            show ? '.35' : '1';
    }


    function updateLoadingText(text) {

        const loading =
            document.querySelector('#sl-loading');

        if (loading) {
            loading.textContent = text;
        }
    }


    /******************************************************************
     * CRIAR INTERFACE
     ******************************************************************/

    function createInterface() {

        if (
            document.querySelector(
                '#sl-priority-button'
            )
        ) {
            return;
        }


        /**************************************************************
         * BOTÃO
         **************************************************************/

        const button =
            document.createElement('button');

        button.id =
            'sl-priority-button';

        button.innerHTML =
            '⚡ Prioridades';

        document.body.appendChild(button);


        /**************************************************************
         * PAINEL
         **************************************************************/

        const overlay =
            document.createElement('div');

        overlay.id =
            'sl-priority-overlay';


        overlay.innerHTML = `

            <div id="sl-priority-panel">

                <div class="sl-panel-header">

                    <div class="sl-panel-title">
                        ⚡ Painel de Prioridades
                    </div>

                    <div class="sl-panel-actions">

                        <button id="sl-refresh-priorities">
                            ↻ Atualizar prioridades
                        </button>

                        <button id="sl-close-priorities">
                            ✕ Fechar
                        </button>

                    </div>

                </div>


                <div class="sl-summary">

                    <span
                        id="sl-summary-urgent"
                        class="sl-summary-urgent"
                    >
                        🚨 0 Urgentes
                    </span>

                    <span
                        id="sl-summary-important"
                        class="sl-summary-important"
                    >
                        ⚠ 0 Importantes
                    </span>

                    <span
                        id="sl-summary-info"
                        class="sl-summary-info"
                    >
                    </span>

                </div>


                <div id="sl-loading">
                    Carregando prioridades...
                </div>


                <div class="sl-table-wrapper">

                    <table id="sl-priority-table">

                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Data</th>
                                <th>Prevista</th>
                                <th>Cliente</th>
                                <th>Situação</th>
                                <th>Prioridade</th>
                                <th>Observação</th>
                            </tr>
                        </thead>

                        <tbody>
                        </tbody>

                    </table>


                    <div id="sl-empty">
                        Nenhum pedido urgente ou importante encontrado.
                    </div>

                </div>

            </div>
        `;


        document.body.appendChild(overlay);


        /**************************************************************
         * EVENTOS
         **************************************************************/

        button.addEventListener(
            'click',
            async () => {

                overlay.style.display =
                    'block';

                /*
                 * Na primeira abertura,
                 * carrega automaticamente.
                 */

                if (!priorities.length) {
                    await loadPriorities();
                }
            }
        );


        document
            .querySelector(
                '#sl-close-priorities'
            )
            .addEventListener(
                'click',
                () => {

                    overlay.style.display =
                        'none';
                }
            );


        document
            .querySelector(
                '#sl-refresh-priorities'
            )
            .addEventListener(
                'click',
                loadPriorities
            );


        /*
         * Clicar fora do painel fecha.
         */

        overlay.addEventListener(
            'click',
            event => {

                if (event.target === overlay) {

                    overlay.style.display =
                        'none';
                }
            }
        );


        /*
         * ESC fecha o painel.
         */

        document.addEventListener(
            'keydown',
            event => {

                if (event.key === 'Escape') {

                    overlay.style.display =
                        'none';
                }
            }
        );
    }


    /******************************************************************
     * INICIALIZAÇÃO
     ******************************************************************/

    function init() {

        if (!document.body) {
            return;
        }

        createInterface();
    }


    if (
        document.readyState === 'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            init
        );

    } else {

        init();
    }

})();
