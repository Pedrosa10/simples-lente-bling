// ==UserScript==
// @name         Simples Lente - Prioridade de Pedidos
// @namespace    https://simpleslente.com.br/
// @version      1.0.0
// @description  Sistema de pedidos Urgentes e Importantes da Simples Lente no Bling
// @match        https://www.bling.com.br/*
// @updateURL    https://raw.githubusercontent.com/Pedrosa10/simples-lente-bling/refs/heads/main/simples-lente-prioridade.user.js
// @downloadURL  https://raw.githubusercontent.com/Pedrosa10/simples-lente-bling/refs/heads/main/simples-lente-prioridade.user.js
// @grant        none
// ==/UserScript==

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

            /* BADGE DO CABEÇALHOS */

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
