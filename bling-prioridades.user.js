// ==UserScript==
// @name         Simples Lente - Prioridades Bling
// @namespace    https://simpleslente.com.br/
// @version      1.0.1
// @description  Sistema completo de prioridades de pedidos da Simples Lente no Bling
// @match        https://www.bling.com.br/*
// @updateURL    https://raw.githubusercontent.com/Pedrosa10/simples-lente-bling/refs/heads/main/bling-prioridades.user.js
// @downloadURL  https://raw.githubusercontent.com/Pedrosa10/simples-lente-bling/refs/heads/main/bling-prioridades.user.js
// @grant        none
// ==/UserScript==

/* ========================================================================
   MÓDULO 1 — MARCAÇÃO E DESTAQUE DE PRIORIDADES (V5 VALIDADA)
   ======================================================================== */


(function () {
    'use strict';


    // ============================================================
    // CONFIGURAÇÃO
    // ============================================================

    const CONFIG = {

        urgente: {
            keyword: 'URGENTE!',
            label: 'Urgente',
            iconClass: 'fas fa-bolt',

            background: '#fff1f0',
            border: '#d92d20',
            badgeBackground: '#d92d20',
            badgeColor: '#ffffff'
        },

        importante: {
            keyword: 'IMPORTANTE!',
            label: 'Importante',
            iconClass: 'fas fa-exclamation',

            background: '#fff8e6',
            border: '#f59e0b',
            badgeBackground: '#f59e0b',
            badgeColor: '#ffffff'
        }

    };


    // Situações nas quais a prioridade deixa de ter efeito
    const FINISHED_STATUSES = [
        'atendido',
        'cancelado'
    ];


    // ============================================================
    // CSS
    // ============================================================

    function injectStyles() {

        if (document.querySelector('#sl-priority-styles')) {
            return;
        }

        const style = document.createElement('style');

        style.id = 'sl-priority-styles';

        style.textContent = `

            /* BADGE DO CABEÇALHO */

            .sl-header-priority {
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;

                margin-top: 2px !important;
                margin-bottom: 4px !important;

                padding: 4px 9px !important;

                border-radius: 4px !important;

                font-size: 12px !important;
                font-weight: 600 !important;
                line-height: 18px !important;

                width: auto !important;
                max-width: max-content !important;

                cursor: default !important;
            }


            /* BADGE DA LISTAGEM */

            .sl-list-priority {
                display: inline-flex !important;
                align-items: center !important;
                gap: 4px !important;

                margin-right: 7px !important;

                padding: 3px 7px !important;

                border-radius: 4px !important;

                font-size: 11px !important;
                font-weight: 600 !important;
                line-height: 16px !important;

                white-space: nowrap !important;

                cursor: default !important;
            }


            /* BOTÕES NAS OBSERVAÇÕES */

            #sl-priority-controls {
                display: flex !important;
                align-items: center !important;
                gap: 7px !important;

                margin-top: 6px !important;
            }


            .sl-priority-action {
                display: inline-flex !important;
                align-items: center !important;
                gap: 5px !important;

                height: 30px !important;

                padding: 0 10px !important;

                border-radius: 4px !important;

                font-size: 12px !important;
                font-weight: 600 !important;

                cursor: pointer !important;

                transition:
                    background-color .15s,
                    border-color .15s,
                    color .15s !important;
            }

        `;

        document.head.appendChild(style);

    }


    // ============================================================
    // FUNÇÕES GERAIS
    // ============================================================

    function normalizeText(text) {

        return (text || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

    }


    function firstLine(text) {

        return (text || '')
            .split(/\r?\n/)[0]
            .trim()
            .toUpperCase();

    }


    function getPriority(text) {

        const line = firstLine(text);

        if (line === CONFIG.urgente.keyword) {
            return 'urgente';
        }

        if (line === CONFIG.importante.keyword) {
            return 'importante';
        }

        return null;

    }


    function setTextareaValue(textarea, value) {

        const setter =
            Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                'value'
            ).set;

        setter.call(textarea, value);

        textarea.dispatchEvent(
            new Event('input', {
                bubbles: true
            })
        );

        textarea.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );

    }


    // ============================================================
    // SITUAÇÃO DO PEDIDO
    // ============================================================

    function isFinishedStatus(status) {

        const normalized =
            normalizeText(status);

        return FINISHED_STATUSES.includes(
            normalized
        );

    }


    // ============================================================
    // DESCOBRE NÚMERO DO PEDIDO ABERTO
    // ============================================================

    function getCurrentOrderNumber() {

        const title =
            document.querySelector('#saleOrderHeader');

        if (!title) {
            return null;
        }


        const text =
            title.textContent || '';


        const match =
            text.match(
                /Pedido de venda\s*-\s*(\d+)/i
            );


        if (!match) {
            return null;
        }


        return match[1];

    }


    // ============================================================
    // DESCOBRE SITUAÇÃO NA TELA DO PEDIDO
    //
    // O Bling mantém uma listagem escondida #lista.
    // Procuramos especificamente a linha do pedido atualmente aberto.
    // ============================================================

    function getCurrentOrderStatus() {

        const orderNumber =
            getCurrentOrderNumber();


        if (!orderNumber) {
            return null;
        }


        const hiddenList =
            document.querySelector('#lista');


        if (!hiddenList) {
            return null;
        }


        const rows =
            hiddenList.querySelectorAll(
                '#datatable tbody tr'
            );


        for (const row of rows) {

            /*
             * Pelo HTML do Bling, a segunda célula contém
             * o número interno do pedido.
             */

            const cells =
                row.querySelectorAll('td');


            if (cells.length < 2) {
                continue;
            }


            const rowOrderNumber =
                (cells[1].textContent || '')
                    .replace('Número:', '')
                    .trim();


            if (rowOrderNumber !== orderNumber) {
                continue;
            }


            const situationElement =
                row.querySelector(
                    '.bagdeListSituation'
                );


            if (!situationElement) {
                return null;
            }


            return situationElement
                .textContent
                .trim();

        }


        return null;

    }


    // ============================================================
    // PEDIDO ATUAL ESTÁ FINALIZADO?
    // ============================================================

    function isCurrentOrderFinished() {

        const status =
            getCurrentOrderStatus();


        /*
         * IMPORTANTE:
         *
         * Se por algum motivo não conseguirmos descobrir a situação,
         * NÃO escondemos a prioridade.
         *
         * É mais seguro mostrar um urgente indevidamente do que
         * esconder um urgente ativo.
         */

        if (!status) {
            return false;
        }


        return isFinishedStatus(status);

    }


    // ============================================================
    // CRIA BADGE
    // ============================================================

    function createBadge(priority, location) {

        const config =
            CONFIG[priority];


        const badge =
            document.createElement('span');


        badge.className =
            location === 'header'
                ? 'Badge sl-header-priority'
                : 'Badge sl-list-priority';


        badge.style.setProperty(
            'background-color',
            config.badgeBackground,
            'important'
        );


        badge.style.setProperty(
            'color',
            config.badgeColor,
            'important'
        );


        // Ícone Font Awesome
        const icon =
            document.createElement('span');

        icon.className =
            config.iconClass;


        const label =
            document.createElement('span');

        label.textContent =
            config.label;


        badge.appendChild(icon);

        badge.appendChild(label);


        return badge;

    }


    // ============================================================
    // CABEÇALHO DO PEDIDO
    // ============================================================

    function updateOrderHeader(priority) {

        const title =
            document.querySelector(
                '#saleOrderHeader'
            );


        if (!title) {
            return;
        }


        // Remove badge anterior
        document
            .querySelectorAll(
                '.sl-header-priority'
            )
            .forEach(
                el => el.remove()
            );


        if (!priority) {
            return;
        }


        const badge =
            createBadge(
                priority,
                'header'
            );


        /*
         * Insere exatamente depois do H1,
         * junto aos badges nativos do Bling.
         */

        title.insertAdjacentElement(
            'afterend',
            badge
        );

    }


    // ============================================================
    // TELA DO PEDIDO
    // ============================================================

    function setupOrderPage() {

        const textarea =
            document.querySelector(
                '#observacaoInterna'
            );


        if (!textarea) {
            return;
        }


        // --------------------------------------------------------
        // CRIA CONTROLES
        // --------------------------------------------------------

        if (
            !document.querySelector(
                '#sl-priority-controls'
            )
        ) {

            const controls =
                document.createElement('div');


            controls.id =
                'sl-priority-controls';


            // ====================================================
            // URGENTE
            // ====================================================

            const urgentButton =
                document.createElement('button');


            urgentButton.id =
                'sl-btn-urgente';


            urgentButton.type =
                'button';


            urgentButton.className =
                'sl-priority-action';


            // ====================================================
            // IMPORTANTE
            // ====================================================

            const importantButton =
                document.createElement('button');


            importantButton.id =
                'sl-btn-importante';


            importantButton.type =
                'button';


            importantButton.className =
                'sl-priority-action';


            controls.appendChild(
                urgentButton
            );


            controls.appendChild(
                importantButton
            );


            textarea.insertAdjacentElement(
                'afterend',
                controls
            );


            // ====================================================
            // ALTERAR PRIORIDADE
            // ====================================================

            function changePriority(type) {

                const currentPriority =
                    getPriority(
                        textarea.value
                    );


                let lines =
                    textarea.value
                        .split(/\r?\n/);


                // Remove marcador atual
                if (
                    currentPriority === 'urgente' ||
                    currentPriority === 'importante'
                ) {

                    lines.shift();


                    // Remove linha vazia imediatamente depois
                    if (
                        lines.length &&
                        lines[0].trim() === ''
                    ) {

                        lines.shift();

                    }

                }


                const remainingText =
                    lines
                        .join('\n')
                        .trim();


                // =================================================
                // CLICOU NO MESMO:
                // REMOVE PRIORIDADE
                // =================================================

                if (
                    currentPriority === type
                ) {

                    setTextareaValue(
                        textarea,
                        remainingText
                    );


                    refreshOrderPage();

                    return;

                }


                // =================================================
                // DEFINE NOVA PRIORIDADE
                // =================================================

                let newValue =
                    CONFIG[type].keyword;


                if (remainingText) {

                    newValue +=
                        '\n' + remainingText;

                }


                setTextareaValue(
                    textarea,
                    newValue
                );


                refreshOrderPage();

            }


            urgentButton.addEventListener(
                'click',
                () => changePriority(
                    'urgente'
                )
            );


            importantButton.addEventListener(
                'click',
                () => changePriority(
                    'importante'
                )
            );


            textarea.addEventListener(
                'input',
                refreshOrderPage
            );

        }


        refreshOrderPage();

    }


    // ============================================================
    // ATUALIZA TELA DO PEDIDO
    // ============================================================

    function refreshOrderPage() {

        const textarea =
            document.querySelector(
                '#observacaoInterna'
            );


        if (!textarea) {
            return;
        }


        const storedPriority =
            getPriority(
                textarea.value
            );


        const finished =
            isCurrentOrderFinished();


        /*
         * AQUI ESTÁ A NOVA REGRA:
         *
         * Atendido ou Cancelado:
         * prioridade visual = nenhuma.
         *
         * O texto URGENTE!/IMPORTANTE! permanece
         * nas observações como histórico.
         */

        const visiblePriority =
            finished
                ? null
                : storedPriority;


        // ========================================================
        // CABEÇALHO
        // ========================================================

        updateOrderHeader(
            visiblePriority
        );


        // ========================================================
        // BOTÕES
        // ========================================================

        const urgentButton =
            document.querySelector(
                '#sl-btn-urgente'
            );


        const importantButton =
            document.querySelector(
                '#sl-btn-importante'
            );


        // --------------------------------------------------------
        // Se pedido já foi finalizado
        // --------------------------------------------------------

        if (finished) {

            /*
             * Escondemos também os botões.
             *
             * Afinal não faz sentido marcar como urgente
             * um pedido Atendido ou Cancelado.
             */

            if (urgentButton) {
                urgentButton.style.display =
                    'none';
            }


            if (importantButton) {
                importantButton.style.display =
                    'none';
            }


            return;

        }


        // Pedido ativo:
        // garante que os botões estejam visíveis

        if (urgentButton) {

            urgentButton.style.display =
                'inline-flex';


            if (
                storedPriority === 'urgente'
            ) {

                urgentButton.innerHTML =
                    '<span class="fas fa-check"></span>' +
                    '<span>Remover urgência</span>';


                urgentButton.style.background =
                    '#ffffff';


                urgentButton.style.color =
                    '#b42318';


                urgentButton.style.border =
                    '1px solid #d92d20';

            }

            else {

                urgentButton.innerHTML =
                    '<span class="fas fa-bolt"></span>' +
                    '<span>Marcar urgente</span>';


                urgentButton.style.background =
                    '#d92d20';


                urgentButton.style.color =
                    '#ffffff';


                urgentButton.style.border =
                    '1px solid #d92d20';

            }

        }


        if (importantButton) {

            importantButton.style.display =
                'inline-flex';


            if (
                storedPriority === 'importante'
            ) {

                importantButton.innerHTML =
                    '<span class="fas fa-check"></span>' +
                    '<span>Remover importante</span>';


                importantButton.style.background =
                    '#ffffff';


                importantButton.style.color =
                    '#b45309';


                importantButton.style.border =
                    '1px solid #f59e0b';

            }

            else {

                importantButton.innerHTML =
                    '<span class="fas fa-exclamation"></span>' +
                    '<span>Marcar importante</span>';


                importantButton.style.background =
                    '#f59e0b';


                importantButton.style.color =
                    '#ffffff';


                importantButton.style.border =
                    '1px solid #f59e0b';

            }

        }

    }


    // ============================================================
    // LIMPA DESTAQUES DE UMA LINHA
    // ============================================================

    function clearRowPriority(row) {

        row.removeAttribute(
            'data-sl-priority'
        );


        row.querySelectorAll(
            '.sl-list-priority'
        ).forEach(
            el => el.remove()
        );


        row.style.removeProperty(
            'background-color'
        );


        row.style.removeProperty(
            'border-left'
        );


        row.querySelectorAll('td')
            .forEach(td => {

                td.style.removeProperty(
                    'background-color'
                );

            });

    }


    // ============================================================
    // LISTAGEM DE PEDIDOS
    // ============================================================

    function highlightOrderList() {

        const comments =
            document.querySelectorAll(
                'span.fas.fa-comment[title]'
            );


        comments.forEach(comment => {

            const row =
                comment.closest('tr');


            if (!row) {
                return;
            }


            // ====================================================
            // SITUAÇÃO DO PEDIDO
            // ====================================================

            const situationElement =
                row.querySelector(
                    '.bagdeListSituation'
                );


            const status =
                situationElement
                    ? situationElement.textContent.trim()
                    : null;


            // ====================================================
            // ATENDIDO / CANCELADO
            // ====================================================

            if (
                status &&
                isFinishedStatus(status)
            ) {

                /*
                 * Mesmo que a observação tenha:
                 *
                 * URGENTE!
                 *
                 * não mostramos nada.
                 */

                clearRowPriority(row);

                return;

            }


            // ====================================================
            // OBSERVAÇÕES INTERNAS
            // ====================================================

            const observation =
                comment.getAttribute(
                    'title'
                ) || '';


            const priority =
                getPriority(
                    observation
                );


            // Sem prioridade
            if (!priority) {

                if (
                    row.dataset.slPriority
                ) {

                    clearRowPriority(
                        row
                    );

                }

                return;

            }


            const config =
                CONFIG[priority];


            // ====================================================
            // MUDOU DE IMPORTANTE -> URGENTE ETC.
            // ====================================================

            if (
                row.dataset.slPriority &&
                row.dataset.slPriority !== priority
            ) {

                clearRowPriority(
                    row
                );

            }


            // ====================================================
            // JÁ PROCESSADO
            // ====================================================

            if (
                row.dataset.slPriority === priority &&
                row.querySelector(
                    '.sl-list-priority'
                )
            ) {

                return;

            }


            row.dataset.slPriority =
                priority;


            // ====================================================
            // FUNDO SUAVE
            // ====================================================

            row.style.setProperty(
                'border-left',
                `4px solid ${config.border}`,
                'important'
            );


            row.querySelectorAll('td')
                .forEach(td => {

                    td.style.setProperty(
                        'background-color',
                        config.background,
                        'important'
                    );

                });


            // ====================================================
            // BADGE
            // ====================================================

            const badge =
                createBadge(
                    priority,
                    'list'
                );


            const markers =
                comment.closest(
                    '.marcadores'
                );


            if (markers) {

                markers.insertAdjacentElement(
                    'afterbegin',
                    badge
                );

            }

        });

    }


    // ============================================================
    // EXECUÇÃO PRINCIPAL
    // ============================================================

    function run() {

        injectStyles();

        setupOrderPage();

        highlightOrderList();

    }


    // Primeira execução
    setTimeout(
        run,
        300
    );


    // ============================================================
    // BLING ALTERA O DOM DINAMICAMENTE
    // ============================================================

    let timer;


    const observer =
        new MutationObserver(() => {

            clearTimeout(timer);


            timer =
                setTimeout(
                    run,
                    150
                );

        });


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    console.log(
        '[Simples Lente] Prioridades Bling v5 carregadas.'
    );

})();

/* ========================================================================
   MÓDULO 2 — PAINEL DE PRIORIDADES
   ======================================================================== */

(function () {
    'use strict';

    const MAX_PAGES = 10;
    const IGNORED_STATUS_IDS = new Set(['9', '12', '18']);

    // Situações que já conhecemos
    const STATUS_NAMES = {
        '6':      'Em aberto',
        '411304': 'Importado Shopify', // Simples Lente
        '8971': 'Importado Shopify', // Woodz
        '320917': 'Montagem Interna', // Simples Lente
        '31528': 'Montagem Interna', // Woodz
        '734015': 'Em Separação', // Simples Lente
        '734013': 'Em Separação', // Woodz
        '731217': 'Aguardando Cliente', // Simples Lente
        '15476': 'Aguardando Cliente', // Woodz
        '715698': 'Em Aberto (sem lente)', // Simples Lente
        '452359': 'Em Aberto (sem lente)', // Woodz
        '828946': 'Em Aberto (grade)', // Simples Lente
        '830550': 'Em Aberto (grade)', // Woodz
        '829314': 'Em Aberto (lente externa)', // Simples Lente
        '830551': 'Em Aberto (lente externa)',// Woodz
        '828947': 'Receita em Digitação', // Simples Lente
        '830527': 'Receita em Digitação', // Woodz
        '731251': 'Conferido', // Simples Lente
        '731247': 'Conferido', // Woodz
        '828948': 'Erro ou Pendência', // Simples Lente
        '830525': 'Erro ou Pendência', // Woodz
        '9':      'Atendido',
        '12':     'Cancelado',
        '18':     'Venda Agenciada'
    };

    let panelPriorities = [];
    let isLoading = false;

    function injectPanelStyles() {
        if (document.querySelector('#sl-priority-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'sl-priority-panel-styles';
        style.textContent = `
            #sl-priority-button {
                position: fixed; right: 25px; bottom: 25px; z-index: 99998;
                background: #343a40; color: white; border: 0; border-radius: 6px;
                padding: 11px 17px; font-size: 14px; font-weight: 600;
                cursor: pointer; box-shadow: 0 3px 10px rgba(0,0,0,.25);
            }
            #sl-priority-button:hover { background: #23272b; }
            #sl-priority-button .sl-urgent-count {
                background: #dc3545; color: white; padding: 2px 7px;
                margin-left: 7px; border-radius: 10px; font-size: 12px;
            }
            #sl-priority-button .sl-important-count {
                background: #ffc107; color: #212529; padding: 2px 7px;
                margin-left: 4px; border-radius: 10px; font-size: 12px;
            }
            #sl-priority-overlay {
                display: none; position: fixed; inset: 0; background: rgba(0,0,0,.45);
                z-index: 99999; padding: 30px; box-sizing: border-box;
            }
            #sl-priority-panel {
                background: white; max-width: 1400px; height: calc(100vh - 60px);
                margin: auto; border-radius: 8px; display: flex; flex-direction: column;
                overflow: hidden; box-shadow: 0 10px 35px rgba(0,0,0,.35);
            }
            .sl-panel-header {
                padding: 18px 22px; border-bottom: 1px solid #ddd;
                display: flex; align-items: center; justify-content: space-between;
            }
            .sl-panel-title { font-size: 21px; font-weight: 600; }
            .sl-panel-actions { display: flex; gap: 8px; }
            .sl-panel-actions button {
                border: 1px solid #ccc; background: white; border-radius: 4px;
                padding: 7px 12px; cursor: pointer;
            }
            .sl-panel-actions button:hover { background: #f5f5f5; }
            .sl-summary {
                padding: 13px 22px; background: #f8f9fa; border-bottom: 1px solid #ddd;
                display: flex; align-items: center; gap: 10px;
            }
            .sl-summary-urgent {
                background: #dc3545; color: white; padding: 5px 10px;
                border-radius: 4px; font-weight: 600;
            }
            .sl-summary-important {
                background: #ffc107; color: #212529; padding: 5px 10px;
                border-radius: 4px; font-weight: 600;
            }
            .sl-summary-info { color: #777; margin-left: 5px; }
            .sl-table-wrapper { flex: 1; overflow: auto; }
            #sl-priority-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            #sl-priority-table th {
                position: sticky; top: 0; background: #f1f3f5; text-align: left;
                padding: 10px; border-bottom: 2px solid #ccc; z-index: 2;
            }
            #sl-priority-table td {
                padding: 9px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top;
            }
            #sl-priority-table tr:hover td { background: #f7f7f7; }
            #sl-priority-table tr.sl-row-urgent td:first-child { border-left: 5px solid #dc3545; }
            #sl-priority-table tr.sl-row-important td:first-child { border-left: 5px solid #ffc107; }
            .sl-badge {
                display: inline-block; padding: 4px 8px; border-radius: 4px;
                font-size: 11px; font-weight: 600; white-space: nowrap;
            }
            .sl-badge-urgent { background: #dc3545; color: white; }
            .sl-badge-important { background: #ffc107; color: #212529; }
            .sl-order-link { color: #007bff; font-weight: 600; cursor: pointer; text-decoration: none; }
            .sl-order-link:hover { text-decoration: underline; }
            .sl-observation { max-width: 400px; white-space: pre-line; color: #555; }
            #sl-loading { display: none; padding: 40px; text-align: center; font-size: 16px; }
            #sl-empty { display: none; padding: 40px; text-align: center; color: #777; }
        `;
        document.head.appendChild(style);
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function panelGetPriority(text) {
        const first = (text || '').split(/\r?\n/)[0].trim().toUpperCase();
        if (first === 'URGENTE!') return 'urgente';
        if (first === 'IMPORTANTE!') return 'importante';
        return null;
    }

    function getObservationWithoutPriority(text) {
        if (!text) return '';
        const lines = text.split(/\r?\n/);
        const first = lines[0].trim().toUpperCase();
        if (first === 'URGENTE!' || first === 'IMPORTANTE!') lines.shift();
        return lines.join('\n').trim();
    }

    function shouldIgnoreOrder(order) {
        return IGNORED_STATUS_IDS.has(String(order.idSituacao));
    }

    function getStatusName(order) {
        const id = String(order.idSituacao);
        return STATUS_NAMES[id] || `Situação ${id}`;
    }

    function formatDate(date) {
        if (!date || date === '0000-00-00') return '—';
        const parts = date.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
    }

    function buildApiUrl(page) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 90);

        const formatBR = date => {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            return `${d}/${m}/${date.getFullYear()}`;
        };

        const params = new URLSearchParams({
            pesquisa: '', idContatoConsulta: '0', unidadesNegocioSelect: '0',
            toggleDefinirSituacaoPadrao: 'false', fatura: 'T', idPsqVendedor: '0',
            psqVendedor: '', idProduto: '0', nomePsqProduto: '', filtroLote: '',
            tipoPedido: '', postalCode: '', pesquisaBairro: '', municipioPsq: '',
            idMunicipioPsq: '', psqEstado: '', idIntegracaoLogistica: '',
            situacaoObjetoCorreios: '', situacaoAutoBuyMe: '', filtroFretesPrioritarios: '',
            codRastreio: '', idComponente: '0', nomePsqComponente: '',
            idPsqTransportador: '0', psqTransportador: '',
            psqNumeroPedidoDaLojaVirtual: '', numeroOrdemCompra: '',
            pagina: String(page), lojasVinculadas: 'todas',
            dataAlteracaoIni: formatBR(start), dataAlteracaoFim: formatBR(end),
            criterio: 'periodo', criterioPeriod: 'Período customizado', situacao: '',
            idVendedor: '0', idTransportador: '0', situacaoRastro: '', transportador: '',
            idLoja: 'todas', idConfUnidadeNegocio: '0', situacaoEnvioFatura: 'T',
            idContato: '0', uf: '', idMunicipio: '', bairro: '',
            dataIni: formatBR(start), dataFim: formatBR(end), view: 'custom-columns'
        });

        return 'https://www.bling.com.br/Api/v3/vendasinternal/list?' + params.toString();
    }

    async function fetchPage(page) {
        const response = await fetch(buildApiUrl(page), {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json, text/plain, */*' }
        });

        if (!response.ok) {
            throw new Error(`Erro ao carregar página ${page}: HTTP ${response.status}`);
        }
        return response.json();
    }

    async function loadPriorities() {
        if (isLoading) return;

        isLoading = true;
        showLoading(true);
        panelPriorities = [];

        let ordersChecked = 0;
        let pagesChecked = 0;

        try {
            for (let page = 1; page <= MAX_PAGES; page++) {
                updateLoadingText(`Verificando página ${page} de ${MAX_PAGES}...`);

                const response = await fetchPage(page);
                const orders = Array.isArray(response.data) ? response.data : [];

                pagesChecked++;
                ordersChecked += orders.length;

                for (const order of orders) {
                    if (shouldIgnoreOrder(order)) continue;

                    const priority = panelGetPriority(order.observacaoInterna);
                    if (!priority) continue;

                    panelPriorities.push({
                        id: order.id,
                        numeroPedido: order.numeroPedido,
                        data: order.data,
                        dataPrevista: order.dataPrevista,
                        nome: order.nome || '',
                        transportador: order.transportador || '',
                        idSituacao: order.idSituacao,
                        status: getStatusName(order),
                        priority,
                        observation: getObservationWithoutPriority(order.observacaoInterna)
                    });
                }

                if (orders.length < 100) break;
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            panelPriorities.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority === 'urgente' ? -1 : 1;
                return String(a.data).localeCompare(String(b.data));
            });

            renderPriorities(panelPriorities, ordersChecked, pagesChecked);

        } catch (error) {
            console.error('[Simples Lente Prioridades - Painel]', error);
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

    function openOrder(order) {
        // Mantido igual ao painel já testado.
        window.open(`/vendas.php#edit/${order.id}`, '_blank');
    }

    function renderPriorities(orders, ordersChecked, pagesChecked) {
        const tbody = document.querySelector('#sl-priority-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const urgentCount = orders.filter(o => o.priority === 'urgente').length;
        const importantCount = orders.filter(o => o.priority === 'importante').length;

        document.querySelector('#sl-summary-urgent').textContent = `🚨 ${urgentCount} Urgentes`;
        document.querySelector('#sl-summary-important').textContent = `⚠ ${importantCount} Importantes`;
        document.querySelector('#sl-summary-info').textContent =
            `${ordersChecked} pedidos verificados · ${pagesChecked} páginas`;

        updateFloatingButton(urgentCount, importantCount);

        const empty = document.querySelector('#sl-empty');

        if (!orders.length) {
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';

        orders.forEach(order => {
            const tr = document.createElement('tr');
            tr.className = order.priority === 'urgente'
                ? 'sl-row-urgent'
                : 'sl-row-important';

            const priorityBadge = order.priority === 'urgente'
                ? '<span class="sl-badge sl-badge-urgent">🚨 URGENTE</span>'
                : '<span class="sl-badge sl-badge-important">⚠ IMPORTANTE</span>';

            tr.innerHTML = `
                <td>
                    <a href="#" class="sl-order-link"
                       data-order-id="${escapeHTML(order.id)}"
                       data-order-number="${escapeHTML(order.numeroPedido)}">
                        ${escapeHTML(order.numeroPedido)}
                    </a>
                </td>
                <td>${formatDate(order.data)}</td>
                <td>${formatDate(order.dataPrevista)}</td>
                <td>${escapeHTML(order.nome)}</td>
                <td>${escapeHTML(order.status)}</td>
                <td>${priorityBadge}</td>
                <td class="sl-observation">${order.observation ? escapeHTML(order.observation) : '—'}</td>
            `;

            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.sl-order-link').forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                openOrder({
                    id: link.dataset.orderId,
                    numeroPedido: link.dataset.orderNumber
                });
            });
        });
    }

    function updateFloatingButton(urgentCount = null, importantCount = null) {
        const button = document.querySelector('#sl-priority-button');
        if (!button) return;

        if (urgentCount === null || importantCount === null) {
            button.innerHTML = '⚡ Prioridades';
            return;
        }

        button.innerHTML = `
            ⚡ Prioridades
            <span class="sl-urgent-count">${urgentCount}</span>
            <span class="sl-important-count">${importantCount}</span>
        `;
    }

    function showLoading(show) {
        const loading = document.querySelector('#sl-loading');
        const table = document.querySelector('.sl-table-wrapper');
        if (!loading || !table) return;

        loading.style.display = show ? 'block' : 'none';
        table.style.opacity = show ? '.35' : '1';
    }

    function updateLoadingText(text) {
        const loading = document.querySelector('#sl-loading');
        if (loading) loading.textContent = text;
    }

    function createInterface() {
        if (!document.body || document.querySelector('#sl-priority-button')) return;

        injectPanelStyles();

        const button = document.createElement('button');
        button.id = 'sl-priority-button';
        button.innerHTML = '⚡ Prioridades';
        document.body.appendChild(button);

        const overlay = document.createElement('div');
        overlay.id = 'sl-priority-overlay';
        overlay.innerHTML = `
            <div id="sl-priority-panel">
                <div class="sl-panel-header">
                    <div class="sl-panel-title">⚡ Painel de Prioridades</div>
                    <div class="sl-panel-actions">
                        <button id="sl-refresh-priorities">↻ Atualizar prioridades</button>
                        <button id="sl-close-priorities">✕ Fechar</button>
                    </div>
                </div>

                <div class="sl-summary">
                    <span id="sl-summary-urgent" class="sl-summary-urgent">🚨 0 Urgentes</span>
                    <span id="sl-summary-important" class="sl-summary-important">⚠ 0 Importantes</span>
                    <span id="sl-summary-info" class="sl-summary-info"></span>
                </div>

                <div id="sl-loading">Carregando prioridades...</div>

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
                        <tbody></tbody>
                    </table>
                    <div id="sl-empty">Nenhum pedido urgente ou importante encontrado.</div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        button.addEventListener('click', async () => {
            overlay.style.display = 'block';
            if (!panelPriorities.length) await loadPriorities();
        });

        document.querySelector('#sl-close-priorities')
            .addEventListener('click', () => overlay.style.display = 'none');

        document.querySelector('#sl-refresh-priorities')
            .addEventListener('click', loadPriorities);

        overlay.addEventListener('click', event => {
            if (event.target === overlay) overlay.style.display = 'none';
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') overlay.style.display = 'none';
        });
    }

    function initPanel() {
        if (!document.body) return;
        createInterface();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPanel);
    } else {
        initPanel();
    }

    console.log('[Simples Lente] Painel de Prioridades carregado.');
})();
