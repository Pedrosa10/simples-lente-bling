// ==UserScript==
// @name         Bling - Prioridades Woodz e Simples Lente
// @namespace    https://simpleslente.com.br/
// @version      1.1.10
// @description  Prioridades, atalhos Shopify/LensAdvizor e painel para Woodz e Simples Lente
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
                position: fixed; right: 25px; bottom: 25px; z-index: 99998; touch-action: none; user-select: none; cursor: grab;
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

    // Posição armazenada apenas neste navegador/perfil do Chrome.
    function setupDraggablePriorityButton(button) {
        const STORAGE_KEY = 'bling-prioridades-button-position-v1';
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}

        function position(left, top) {
            const maxX = Math.max(0, window.innerWidth - button.offsetWidth);
            const maxY = Math.max(0, window.innerHeight - button.offsetHeight);
            button.style.left = Math.min(maxX, Math.max(0, left)) + 'px';
            button.style.top = Math.min(maxY, Math.max(0, top)) + 'px';
            button.style.right = 'auto';
            button.style.bottom = 'auto';
        }

        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
            requestAnimationFrame(() => position(saved.x, saved.y));
        }
        window.addEventListener('resize', () => {
            if (button.style.left) {
                position(parseFloat(button.style.left), parseFloat(button.style.top));
            }
        });

        let drag = null;
        button.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            const rect = button.getBoundingClientRect();
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
                     left: rect.left, top: rect.top, moved: false };
            button.setPointerCapture(event.pointerId);
            button.style.cursor = 'grabbing';
        });
        button.addEventListener('pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (Math.hypot(dx, dy) > 5) drag.moved = true;
            if (drag.moved) position(drag.left + dx, drag.top + dy);
        });
        function finish(event) {
            if (!drag || drag.id !== event.pointerId) return;
            if (drag.moved) {
                button.dataset.slSuppressClick = '1';
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({
                        x: parseFloat(button.style.left), y: parseFloat(button.style.top)
                    }));
                } catch (_) {}
            }
            button.style.cursor = 'grab';
            drag = null;
        }
        button.addEventListener('pointerup', finish);
        button.addEventListener('pointercancel', finish);
    }

    function createInterface() {
        if (!document.body || document.querySelector('#sl-priority-button')) return;

        injectPanelStyles();

        const button = document.createElement('button');
        button.id = 'sl-priority-button';
        button.innerHTML = '⚡ Prioridades';
        document.body.appendChild(button);
        setupDraggablePriorityButton(button);

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
            if (button.dataset.slSuppressClick === '1') {
                button.dataset.slSuppressClick = '0';
                return;
            }
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

/* ========================================================================
   MÓDULO 3 — ATALHOS SHOPIFY / LENSADVIZOR (WOODZ E SIMPLES LENTE)
   ======================================================================== */
(function () {
    'use strict';

    const STORE_SLUGS = { woodz: 'woodz-br', simpleslente: 'simpleslente' };
    const LENS_SHOPS = { woodz: 'woodz-br.myshopify.com', simpleslente: '7c0c46-2.myshopify.com' };
    const ID_PATTERN = /\b\d{13,16}\b/;
    const LINK_CLASS = 'bling-external-order-links';

    function inferStore(text) {
        const value = String(text || '').toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        if (/woodz|\bwsz?\b|\bwz\b/.test(value)) return 'woodz';
        if (/simples\s*lente|simpleslente|\bsl\b/.test(value)) return 'simpleslente';
        return null;
    }

    function accountStore() {
        // Identifica a EMPRESA (não o usuário logado), inclusive em logins de funcionários.
        const companyId = document.querySelector('#id_company_track_events')?.value?.trim();
        const knownCompanies = {
            '14880163957': 'simpleslente',
            '368928151': 'woodz'
        };
        if (companyId) {
            // Não adivinha quando a empresa não está cadastrada.
            return knownCompanies[companyId] || null;
        }

        // Compatibilidade com páginas do Bling que não expõem o ID da empresa.
        const companyName = document.querySelector('#name_company_track_events')?.value;
        if (companyName) {
            const normalized = companyName.toUpperCase().trim();
            if (normalized === 'SIMPLES OTICA LTDA') return 'simpleslente';
            if (normalized === 'WZ COMERCIO E IMPORTACAO LTDA') return 'woodz';
        }
        const companyEmail = document.querySelector('#email_company_track_events')?.value?.toLowerCase().trim();
        if (companyEmail?.endsWith('@simpleslente.com.br')) return 'simpleslente';
        if (companyEmail?.endsWith('@woodz.com.br')) return 'woodz';

        // Último recurso: nome exibido no menu da conta.
        return inferStore(document.querySelector('#accountMenu .menu-username')?.textContent);
    }

    function orderStore() {
        // Prioriza a loja escolhida no formulário do pedido.
        for (const select of document.querySelectorAll('select')) {
            const label = [select.id, select.name,
                select.closest('div')?.parentElement?.textContent?.slice(0, 150)].join(' ');
            if (!/loja/i.test(label)) continue;
            const option = select.selectedOptions?.[0];
            const store = inferStore(option?.textContent);
            if (store) return store;
        }
        for (const el of document.querySelectorAll('input, [role="combobox"]')) {
            const nearby = el.closest('div')?.parentElement?.textContent?.slice(0, 120) || '';
            if (!/loja/i.test(nearby)) continue;
            const store = inferStore(el.value || el.textContent || nearby);
            if (store) return store;
        }
        return accountStore();
    }

    function chooseStore() {
        // Não presumir a loja quando não houver identificação confiável.
        const answer = window.prompt(
            'Qual loja Shopify corresponde a esta conta Bling?\nDigite woodz ou simpleslente:',
            ''
        );
        if (answer === null) return null;
        const normalized = String(answer).trim().toLowerCase().replace(/\s+/g, '');
        if (normalized === 'woodz' || normalized === 'woodz-br') return 'woodz';
        if (normalized === 'simpleslente') return 'simpleslente';
        window.alert('Loja não reconhecida. Digite woodz ou simpleslente.');
        return null;
    }

    function makeLinks(id, store) {
        if (!/^\d{13,16}$/.test(id)) return null;
        const holder = document.createElement('span');
        holder.className = LINK_CLASS;
        holder.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-left:9px;vertical-align:middle;white-space:nowrap;';

        const shopify = document.createElement('a');
        shopify.href = store ? `https://admin.shopify.com/store/${STORE_SLUGS[store]}/orders/${id}` : '#';
        shopify.target = '_blank';
        shopify.rel = 'noopener noreferrer';
        shopify.title = store ? 'Abrir pedido no Shopify' : 'Selecionar loja e abrir no Shopify';
        shopify.style.cssText = 'color:#248a49;font-size:15px;text-decoration:none;cursor:pointer;';
        shopify.innerHTML = '<i class="fas fa-shopping-bag"></i>';
        shopify.addEventListener('click', event => {
            event.stopPropagation();
            if (!store) {
                event.preventDefault();
                const selected = chooseStore();
                if (selected) window.open(`https://admin.shopify.com/store/${STORE_SLUGS[selected]}/orders/${id}`, '_blank', 'noopener');
            }
        });
        holder.appendChild(shopify);

        const lens = document.createElement('a');
        lens.href = store
            ? `https://app.lensadvisor.com/shopify-admin/order/?id=${encodeURIComponent(id)}&shop=${encodeURIComponent(LENS_SHOPS[store])}`
            : '#';
        lens.target = '_blank';
        lens.rel = 'noopener noreferrer';
        lens.title = store ? 'Abrir receita no LensAdvisor' : 'Selecionar loja e abrir receita no LensAdvisor';
        lens.style.cssText = 'color:#1676d2;font-size:15px;text-decoration:none;cursor:pointer;';
        lens.innerHTML = '<img alt="LensAdvizor" src="data:image/png;base64,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" style="width:21px;height:18px;object-fit:contain;vertical-align:middle;">';
        lens.addEventListener('click', event => {
            event.stopPropagation();
            if (!store) {
                event.preventDefault();
                const selected = chooseStore();
                if (selected) {
                    window.open(
                        `https://app.lensadvisor.com/shopify-admin/order/?id=${encodeURIComponent(id)}&shop=${encodeURIComponent(LENS_SHOPS[selected])}`,
                        '_blank', 'noopener'
                    );
                }
            }
        });
        holder.appendChild(lens);
        return holder;
    }

    function findTextNode(root, id) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.parentElement || node.parentElement.closest('.' + LINK_CLASS)) continue;
            if (String(node.textContent).includes(id)) return node;
        }
        return null;
    }

    function updateList() {
        // Mesma identificação de pedidos da v1.1.5 (já testada).
        const images = document.querySelectorAll(
            'tr .marcadores img[numeropedidodalojavirtual]'
        );
        const store = accountStore();

        for (const image of images) {
            const id = (image.getAttribute('numeropedidodalojavirtual') || '').trim();
            if (!/^\d{13,16}$/.test(id)) continue;

            const markers = image.closest('.marcadores');
            if (!markers) continue;

            const number = image.nextElementSibling;
            const validNumber = number?.tagName === 'P' &&
                number.textContent.trim() === id;

            // Link no número do Shopify, preservando o elemento nativo.
            if (validNumber) {
                let link = number.querySelector('a.bling-shopify-number-link');
                if (!link) {
                    link = document.createElement('a');
                    link.className = 'bling-shopify-number-link';
                    link.textContent = id;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.title = 'Abrir pedido no Shopify';
                    link.style.cssText =
                        'color:inherit;text-decoration:none;cursor:pointer;';
                    number.replaceChildren(link);
                }
                const storeKey = store || '';
                if (link.dataset.orderId !== id || link.dataset.store !== storeKey) {
                    link.dataset.orderId = id;
                    link.dataset.store = storeKey;
                    link.href = store
                        ? `https://admin.shopify.com/store/${STORE_SLUGS[store]}/orders/${id}`
                        : '#';
                    link.onclick = event => {
                        event.stopPropagation();
                        if (!store) {
                            event.preventDefault();
                            const selected = chooseStore();
                            if (selected) {
                                window.open(
                                    `https://admin.shopify.com/store/${STORE_SLUGS[selected]}/orders/${id}`,
                                    '_blank', 'noopener'
                                );
                            }
                        }
                    };
                }
            }

            const existing = markers.querySelector(
                '.' + LINK_CLASS + '[data-list-links="1"]'
            );
            const storeKey = store || '';
            if (existing?.dataset.orderId === id &&
                existing?.dataset.store === storeKey &&
                existing?.dataset.numberLinkOnly === (validNumber ? '1' : '0')) {
                continue;
            }
            existing?.remove();

            // Reutiliza integralmente a geração de ícones da v1.1.5.
            const links = makeLinks(id, store);
            if (!links) continue;

            // Se o ID já é clicável, mantém apenas o ícone LensAdvizor.
            if (validNumber) links.querySelector('a')?.remove();

            links.dataset.orderId = id;
            links.dataset.store = storeKey;
            links.dataset.listLinks = '1';
            links.dataset.numberLinkOnly = validNumber ? '1' : '0';
            (validNumber ? number : image).insertAdjacentElement('afterend', links);
        }
    }

    function getOpenOrderId() {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const input of inputs) {
            const id = String(input.value || '').trim();
            if (!/^\d{13,16}$/.test(id)) continue;
            const labelText = [input.id, input.name,
                input.labels?.[0]?.textContent,
                input.previousElementSibling?.textContent,
                input.closest('div')?.querySelector('label')?.textContent,
                input.closest('div')?.parentElement?.textContent?.slice(0, 140)].join(' ');
            if (/loja\s*virtual|numero.*loja|numero.*ecommerce/i.test(labelText)) return { input, id };
        }
        return null;
    }

    function updateOpenOrder() {
        const title = document.querySelector('#saleOrderHeader');
        if (!title) return;
        const order = getOpenOrderId();
        const existing = document.querySelector('#bling-open-order-external-links');
        if (!order) { existing?.remove(); return; }
        const store = orderStore();
        if (existing?.dataset.orderId === order.id && existing?.dataset.store === store) return;
        existing?.remove();
        const links = makeLinks(order.id, store);
        if (!links) return;
        links.id = 'bling-open-order-external-links';
        links.dataset.orderId = order.id;
        links.dataset.store = store;
        title.insertAdjacentElement('afterend', links);
    }

    let scheduled = false;
    function run() {
        scheduled = false;
        updateList();
        updateOpenOrder();
    }
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(run, 250);
    }
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    console.log('[Bling Prioridades] Atalhos Shopify e LensAdvizor v1.1.5 carregados.');
})();
