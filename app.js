// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
};

const parseLocalDate = (dateInput) => {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return new Date(dateInput);
    const dateStr = typeof dateInput === 'string' ? dateInput.substring(0, 10) : dateInput.toString().substring(0, 10);
    const parts = dateStr.split('-');
    if (parts.length < 3) return new Date();
    return new Date(parts[0], parts[1]-1, parts[2]);
};

const parseNumber = (valueString) => {
    if (!valueString) return 0;
    return parseFloat(valueString.toString().replace(',', '.')) || 0;
};

const isPastOrToday = (dateString, refDate) => {
    const ref = new Date(refDate);
    ref.setHours(23, 59, 59, 999);
    const date = parseLocalDate(dateString);
    return date <= ref;
};

const getDaysLeftInMonth = (refDate) => {
    const ref = new Date(refDate);
    const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const diffDays = Math.ceil((lastDay - ref) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
};

const getFaturaMonth = (purchaseDateStr, diaFechamento) => {
    const pDate = parseLocalDate(purchaseDateStr);
    let monthStart = new Date(pDate.getFullYear(), pDate.getMonth(), 1);
    if (diaFechamento && pDate.getDate() >= parseInt(diaFechamento, 10)) {
        monthStart.setMonth(monthStart.getMonth() + 1);
    }
    return monthStart;
};

const countOccurrences = (dia, startDateStr, refDateStr, endDateStr = null) => {
    const start = parseLocalDate(startDateStr);
    
    // refDateStr comes from toISOString().split('T')[0] normally, we parse it as local:
    const ref = parseLocalDate(refDateStr);
    ref.setHours(23, 59, 59, 999);
    
    let end = ref;
    if (endDateStr) {
        const customEnd = parseLocalDate(endDateStr);
        customEnd.setHours(23, 59, 59, 999);
        if (customEnd < ref) end = customEnd;
    }
    
    if (start > end) return 0;

    let count = 0;
    let current = new Date(start);
    
    // Iterate month by month
    while(true) {
        // Find the "dia" in current month
        let targetDay = dia;
        const lastDayOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        if (dia > lastDayOfMonth) targetDay = lastDayOfMonth; // Cap at end of month

        const hitDate = new Date(current.getFullYear(), current.getMonth(), targetDay);
        
        if (hitDate >= start && hitDate <= end) {
            count++;
        }
        
        if (current.getFullYear() > end.getFullYear() || 
           (current.getFullYear() === end.getFullYear() && current.getMonth() >= end.getMonth())) {
            break;
        }
        
        current.setMonth(current.getMonth() + 1);
    }
    
    return count;
};

// --- STORE ---
class Store {
    constructor() {
        this.STORAGE_KEY = 'findash_data';
        this.data = this.loadData();
    }
    loadData() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (!parsed.config) parsed.config = { saldoInicial: null, dataInicial: null };
            if (!parsed.planejamento) parsed.planejamento = {};
            if (!parsed.planejamentoDiario) parsed.planejamentoDiario = {};
            if (!parsed.receitasFixas) parsed.receitasFixas = [];
            if (!parsed.cartao.faturasFechadas) parsed.cartao.faturasFechadas = [];
            // Auto-migrate legacy faturaInicial config to faturasFechadas if exists
            if (parsed.cartao.faturaInicial > 0 && parsed.cartao.vencimentoData) {
                parsed.cartao.faturasFechadas.push({ id: generateId(), valor: parsed.cartao.faturaInicial, vencimentoData: parsed.cartao.vencimentoData });
                parsed.cartao.faturaInicial = 0;
            }
            return parsed;
        }
        return {
            config: { saldoInicial: null, dataInicial: null },
            planejamento: {},
            planejamentoDiario: {},
            receitas: [], receitasFixas: [], despesasFixas: [], despesasVariaveis: [],
            cartao: { faturaInicial: 0, vencimentoData: '', vencimento: '', diaFechamento: '', compras: [], faturasFechadas: [] },
            investimentos: []
        };
    }
    saveData() { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data)); }
    
    setConfig(saldoInicial, dataInicial) {
        this.data.config.saldoInicial = saldoInicial;
        this.data.config.dataInicial = dataInicial;
        this.saveData();
    }

    setFaturaFechamento(fechamento, diaDefault) {
        this.data.cartao.diaFechamento = fechamento;
        this.data.cartao.vencimento = diaDefault;
        this.saveData();
    }

    saveItem(type, item) {
        if (!item.id) item.id = generateId();
        
        const updateOrPush = (arr, newItem) => {
            const index = arr.findIndex(i => i.id === newItem.id);
            if (index > -1) arr[index] = { ...arr[index], ...newItem };
            else arr.push(newItem);
        };

        if (type === 'receita') updateOrPush(this.data.receitas, item);
        else if (type === 'receita-fixa') updateOrPush(this.data.receitasFixas, item);
        else if (type === 'despesa-fixa') updateOrPush(this.data.despesasFixas, item);
        else if (type === 'despesa-variavel') updateOrPush(this.data.despesasVariaveis, item);
        else if (type === 'compra-cartao') updateOrPush(this.data.cartao.compras, item);
        else if (type === 'fatura-fechada') updateOrPush(this.data.cartao.faturasFechadas, item);
        else if (type === 'investimento') updateOrPush(this.data.investimentos, item);
        this.saveData();
    }

    deleteItem(type, id) {
        if (type === 'receita') this.data.receitas = this.data.receitas.filter(i => i.id !== id);
        else if (type === 'receita-fixa') this.data.receitasFixas = this.data.receitasFixas.filter(i => i.id !== id);
        else if (type === 'despesa-fixa') this.data.despesasFixas = this.data.despesasFixas.filter(i => i.id !== id);
        else if (type === 'despesa-variavel') this.data.despesasVariaveis = this.data.despesasVariaveis.filter(i => i.id !== id);
        else if (type === 'compra-cartao') this.data.cartao.compras = this.data.cartao.compras.filter(i => i.id !== id);
        else if (type === 'fatura-fechada') this.data.cartao.faturasFechadas = this.data.cartao.faturasFechadas.filter(i => i.id !== id);
        else if (type === 'investimento') this.data.investimentos = this.data.investimentos.filter(i => i.id !== id);
        this.saveData();
    }

    getItem(type, id) {
        if (type === 'receita') return this.data.receitas.find(i => i.id === id);
        if (type === 'receita-fixa') return this.data.receitasFixas.find(i => i.id === id);
        if (type === 'despesa-fixa') return this.data.despesasFixas.find(i => i.id === id);
        if (type === 'despesa-variavel') return this.data.despesasVariaveis.find(i => i.id === id);
        if (type === 'compra-cartao') return this.data.cartao.compras.find(i => i.id === id);
        if (type === 'fatura-fechada') return this.data.cartao.faturasFechadas.find(i => i.id === id);
        if (type === 'investimento') return this.data.investimentos.find(i => i.id === id);
        return null;
    }

    // Ledger Calculation functions

    // Returns a specific fatura base value regardless of whether it was paid.
    getFaturaBaseForMonth(monthStart) {
        let total = 0;
        const fechamento = this.data.cartao.diaFechamento;
        
        this.data.cartao.compras.forEach(c => {
            const baseInvoiceStart = getFaturaMonth(c.data, fechamento);
            const diffMonths = (monthStart.getFullYear() - baseInvoiceStart.getFullYear()) * 12 + 
                               (monthStart.getMonth() - baseInvoiceStart.getMonth());

            if (c.parcelado) {
                if (diffMonths >= 0 && diffMonths < c.parcelas) total += (c.valor / c.parcelas);
            } else {
                if (diffMonths === 0) total += c.valor;
            }
        });

        // Add fixed expenses on credit whose virtual mapped month is this one
        this.data.despesasFixas.forEach(d => {
            if (d.tipoPagamento === 'Crédito') {
                // Determine if this despesa fixa falls into this invoice month
                // Given its start date (dataInicio), we map it like a purchase
                if(d.dataInicio) {
                    const occurrences = countOccurrences(d.dia, d.dataInicio, monthStart.toISOString().split('T')[0], null);
                    // This creates an infinite stream, if occurrences > 0 and we are looking at a specific invoice month >= start month...
                    // Simply: does its `dia` in whatever preceding days fall into this invoice cycle?
                    // To keep it clean: A fixed expense always contributes to EVERY month after its startDate.
                    const dStartMonth = getFaturaMonth(d.dataInicio, fechamento);
                    if (monthStart >= dStartMonth) {
                        total += d.valor;
                    }
                } else {
                    // Legacy records without dataInicio: assume it always existed
                    total += d.valor;
                }
            }
        });
        
        return total;
    }

    // Sum of all faturas due in the specified range.
    getInvoicesPaidInDateRange(startDateStr, endDateStr) {
        if (!startDateStr || !endDateStr) return 0;
        
        let total = 0;
        const start = parseLocalDate(startDateStr);
        const end = parseLocalDate(endDateStr);
        end.setHours(23, 59, 59, 999);
        
        // Iterate explicit historic faturas
        this.data.cartao.faturasFechadas.forEach(f => {
            const vData = parseLocalDate(f.vencimentoData);
            if (vData >= start && vData <= end) {
                total += f.valor;
            }
        });

        const vencimento = parseInt(this.data.cartao.vencimento, 10) || 5; 

        let current = new Date(start);
        current.setDate(1); 
        
        while(true) {
            let dueDay = vencimento;
            const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
            if (dueDay > lastDay) dueDay = lastDay;
            
            const dueDate = new Date(current.getFullYear(), current.getMonth(), dueDay);
            
            if (dueDate >= start && dueDate <= end) {
                total += this.getFaturaBaseForMonth(current);
            }
            
            if (current.getFullYear() > end.getFullYear() || 
               (current.getFullYear() === end.getFullYear() && current.getMonth() >= end.getMonth())) {
                break;
            }
            current.setMonth(current.getMonth() + 1);
        }
        
        return total;
    }

    getSaldoDisponivel(refDate) {
        if (this.data.config.saldoInicial === null || !this.data.config.dataInicial) return 0;
        
        let total = parseFloat(this.data.config.saldoInicial) || 0;
        const startData = this.data.config.dataInicial;
        const dEnd = refDate.toISOString().split('T')[0];
        
        // 1. Receitas
        this.data.receitas.forEach(r => {
            const rDate = parseLocalDate(r.data);
            const dataInic = parseLocalDate(startData);
            if (rDate >= dataInic && isPastOrToday(r.data, refDate)) {
                total += r.valor;
            }
        });

        // 2. Receitas Fixas
        this.data.receitasFixas.forEach(r => {
            const eStart = r.dataInicio > startData ? r.dataInicio : startData;
            const occurrences = countOccurrences(r.dia, eStart, dEnd, r.dataFim);
            total += (r.valor * occurrences);
        });

        // 3. Despesas Fixas (Débito apenas)
        this.data.despesasFixas.forEach(d => {
            if (d.tipoPagamento !== 'Crédito') {
                const eStart = d.dataInicio > startData ? d.dataInicio : startData;
                const occurrences = countOccurrences(d.dia, eStart, dEnd, null);
                total -= (d.valor * occurrences);
            }
        });

        // 4. Despesas Variáveis
        this.data.despesasVariaveis.forEach(d => {
            const dDate = parseLocalDate(d.data);
            const dataInic = parseLocalDate(startData);
            if (d.tipoPagamento === 'Débito' && dDate >= dataInic && isPastOrToday(d.data, refDate)) {
                total -= d.valor;
            }
        });

        // 5. Investimentos
        this.data.investimentos.forEach(i => {
            const iDate = parseLocalDate(i.data);
            const dataInic = parseLocalDate(startData);
            if (iDate >= dataInic && isPastOrToday(i.data, refDate)) {
                total -= i.valor;
            }
        });

        // 6. Faturas pagas ou vencendo neste intervalo:
        total -= this.getInvoicesPaidInDateRange(startData, refDate);

        return total;
    }

    getSaldoProjetado(refDate, projDate) {
        // Projecting uses the exact same ledger math up to projDate
        if (this.data.config.saldoInicial === null || !this.data.config.dataInicial) return 0;
        return this.getSaldoDisponivel(new Date(projDate));
    }

    getSaldoComprometido(refDate) {
        // Dinheiro Atual: exactly getSaldoDisponivel(refDate)
        const dinheiroLivre = this.getSaldoDisponivel(refDate);

        // Dividas futuras absolutas (All faturas infinitely after refDate)
        // Since credit purchases stop when parcels stop, we can project to 48 months from now to capture all
        const dEnd = new Date(refDate);
        dEnd.setFullYear(dEnd.getFullYear() + 4); 
        const startData = refDate.toISOString().split('T')[0];

        // Wait, getInvoicesPaidInDateRange counts startData to dEnd inclusive. 
        // We only want faturas due AFTER the current refDate. 
        // If refDate is 15-05, and fatura is due 10-05, it was already deducted in `dinheiroLivre`.
        // So we need invoices due starting from tomorrow.
        const startDataTomorrow = new Date(refDate);
        startDataTomorrow.setDate(startDataTomorrow.getDate() + 1);

        let dividasCartao = this.getInvoicesPaidInDateRange(startDataTomorrow.toISOString().split('T')[0], dEnd.toISOString());

        // We only consider 1 month of fixed recurring debit expenses for an "immediate liability" feeling:
        let fixasMensalNoDebito = this.data.despesasFixas.reduce((acc, d) => acc + (d.tipoPagamento !== 'Crédito' ? d.valor : 0), 0); 
        
        let totalDividas = dividasCartao + fixasMensalNoDebito; 
        
        return {
            comprometido: totalDividas - dinheiroLivre,
            totalDividas: totalDividas,
            dinheiroLivre: dinheiroLivre
        };
    }
}

// --- APP MAIN ---
class App {
    constructor() {
        this.store = new Store();
        
        const today = new Date();
        this.referenceDate = new Date(today);
        
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.projectedDate = new Date(endOfMonth);

        this.bindEvents();
        
        document.getElementById('global-date').value = today.toISOString().split('T')[0];
        document.getElementById('projecao-date').value = endOfMonth.toISOString().split('T')[0];
        
        // Onboarding Check
        if (this.store.data.config.saldoInicial === null) {
            this.openModal('onboarding');
        } else {
            this.render();
        }
    }

    bindEvents() {
        window.app = this;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                const targetViewId = 'view-' + item.dataset.view;
                document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
                const targetEl = document.getElementById(targetViewId);
                if (targetEl) targetEl.style.display = 'block';

                const pageTitle = document.getElementById('page-title');
                if (pageTitle) pageTitle.textContent = item.textContent.trim();
            });
        });

        document.getElementById('global-date').addEventListener('change', (e) => {
            if(e.target.value) {
                this.referenceDate = new Date(e.target.value + 'T12:00:00'); 
                this.render();
            }
        });

        document.getElementById('projecao-date').addEventListener('change', (e) => {
            if(e.target.value) {
                this.projectedDate = new Date(e.target.value + 'T12:00:00');
                this.render();
            }
        });

        const inlineSaldo = document.getElementById('inline-saldo-base');
        if (inlineSaldo) {
            inlineSaldo.addEventListener('input', (e) => {
                this.store.setConfig(parseNumber(e.target.value), this.store.data.config.dataInicial || new Date().toISOString().split('T')[0]);
                this.render();
            });
        }

        document.getElementById('modal-container').addEventListener('click', (e) => {
            if (e.target.id === 'modal-container') {
                // block closing onboarding
                if (this.store.data.config.saldoInicial !== null) {
                    this.closeModal();
                }
            }
        });
    }

    openModal(type, id = null) {
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        
        let item = id ? this.store.getItem(type, id) : {};
        if (type === 'config-cartao') item = this.store.data.cartao;
        if (type === 'onboarding') item = this.store.data.config;

        let html = '';

        if (type === 'onboarding') {
            modalTitle.textContent = 'Configure seu Saldo Inicial (Base)';
            html = `
                <form id="form-onboarding" onsubmit="window.app.handleFormSubmit(event, 'onboarding')">
                    <p class="text-muted mb-4">A base matemática: digite quanto tem fisicamente hoje e a data desse preenchimento. O sistema projeta o resto.</p>
                    <div class="form-group"><label>Saldo em Conta (R$)</label><input type="number" step="0.01" class="form-control" name="valor" value="${item.saldoInicial !== null && item.saldoInicial !== undefined ? item.saldoInicial : '0.00'}" required></div>
                    <div class="form-group"><label>Data desse Saldo</label><input type="date" class="form-control" name="dataInicial" value="${item.dataInicial || new Date().toISOString().split('T')[0]}" required></div>
                    <div class="form-actions"><button type="submit" class="btn btn-primary" style="width:100%">Iniciar Painel</button></div>
                </form>`;
        } else if (type === 'receita') {
            modalTitle.textContent = id ? 'Editar Receita' : 'Nova Receita';
            html = `
                <form id="form-receita" onsubmit="window.app.handleFormSubmit(event, 'receita')">
                    <input type="hidden" name="id" value="${item.id || ''}">
                    <div class="form-group"><label>Nome / Descrição</label><input type="text" class="form-control" name="descricao" value="${item.descricao || ''}" required></div>
                    <div class="form-group"><label>Valor (R$)</label><input type="number" step="0.01" class="form-control" name="valor" value="${item.valor || ''}" required></div>
                    <div class="form-group"><label>Data</label><input type="date" class="form-control" name="data" value="${item.data || ''}" required></div>
                    <div class="form-group"><label>Status</label><select class="form-control" name="status"><option value="Recebido" ${item.status === 'Recebido' ? 'selected' : ''}>Recebido</option><option value="Previsto" ${item.status === 'Previsto' ? 'selected' : ''}>Previsto</option></select></div>
                    <div class="form-actions"><button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">${id ? 'Atualizar' : 'Salvar'}</button></div>
                </form>`;
        } else if (type === 'receita-fixa') {
            modalTitle.textContent = id ? 'Editar Receita Fixa' : 'Nova Receita Fixa';
            const defaultStart = new Date().toISOString().split('T')[0];
            html = `
                <form id="form-receita-fixa" onsubmit="window.app.handleFormSubmit(event, 'receita-fixa')">
                    <input type="hidden" name="id" value="${item.id || ''}">
                    <p style="font-size:0.8rem;color:var(--info);margin-bottom:1rem">Atenção: Apenas abaterá (somará) no saldo quando a data simulada passar pelo dia de recebimento.</p>
                    <div class="form-group"><label>Nome</label><input type="text" class="form-control" name="descricao" value="${item.descricao || ''}" required></div>
                    <div class="form-group"><label>Valor (R$)</label><input type="number" step="0.01" class="form-control" name="valor" value="${item.valor || ''}" required></div>
                    <div class="form-group"><label>Dia do Recebimento (1 a 31)</label><input type="number" min="1" max="31" class="form-control" name="dia" value="${item.dia || ''}" required></div>
                    <div style="display:flex; gap:10px;">
                        <div class="form-group" style="flex:1"><label>Data de Início</label><input type="date" class="form-control" name="dataInicio" value="${item.dataInicio || defaultStart}" required></div>
                        <div class="form-group" style="flex:1"><label>Data Fim (Opcional)</label><input type="date" class="form-control" name="dataFim" value="${item.dataFim || ''}"></div>
                    </div>
                    <div class="form-actions"><button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">${id ? 'Atualizar' : 'Salvar'}</button></div>
                </form>`;
        } else if (type === 'despesa-fixa') {
            modalTitle.textContent = id ? 'Editar Despesa Fixa' : 'Nova Despesa Fixa';
            const defaultStart = new Date().toISOString().split('T')[0];
            html = `
                <form id="form-despesa-fixa" onsubmit="window.app.handleFormSubmit(event, 'despesa-fixa')">
                    <input type="hidden" name="id" value="${item.id || ''}">
                    <p style="font-size:0.8rem;color:var(--info);margin-bottom:1rem">No Débito: Diminui o saldo no momento que o dia cruza o calendário. No Crédito: Abatido automaticamente da fatura no dia do vencimento do cartão.</p>
                    <div class="form-group"><label>Nome</label><input type="text" class="form-control" name="nome" value="${item.nome || ''}" required></div>
                    <div class="form-group"><label>Valor (R$)</label><input type="number" step="0.01" class="form-control" name="valor" value="${item.valor || ''}" required></div>
                    <div class="form-group"><label>Dia de Cobrança (1 a 31)</label><input type="number" min="1" max="31" class="form-control" name="dia" value="${item.dia || ''}" required></div>
                    <div class="form-group"><label>Data de Início da Cobrança</label><input type="date" class="form-control" name="dataInicio" value="${item.dataInicio || defaultStart}" required></div>
                    <div class="form-group"><label>Tipo de Pagamento</label><select class="form-control" name="tipoPagamento"><option value="Débito" ${item.tipoPagamento === 'Débito' ? 'selected' : ''}>Débito</option><option value="Crédito" ${item.tipoPagamento === 'Crédito' ? 'selected' : ''}>Crédito (Cai na Fatura)</option></select></div>
                    <div class="form-actions"><button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">${id ? 'Atualizar' : 'Salvar'}</button></div>
                </form>`;
        } else if (type === 'despesa-variavel') {
            modalTitle.textContent = id ? 'Editar Despesa Variável' : 'Nova Despesa Variável';
            html = `
                <form id="form-despesa-variavel" onsubmit="window.app.handleFormSubmit(event, 'despesa-variavel')">
                    <input type="hidden" name="id" value="${item.id || ''}">
                    <div class="form-group"><label>Categoria / Descrição</label><input type="text" class="form-control" name="categoria" value="${item.categoria || ''}" required></div>
                    <div class="form-group"><label>Valor (R$)</label><input type="number" step="0.01" class="form-control" name="valor" value="${item.valor || ''}" required></div>
                    <div class="form-group"><label>Data</label><input type="date" class="form-control" name="data" value="${item.data || ''}" required></div>
                    <input type="hidden" name="tipoPagamento" value="Débito">
                    <div class="form-actions"><button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">${id ? 'Atualizar' : 'Salvar'}</button></div>
                </form>`;
        } else if (type === 'compra-cartao') {
            modalTitle.textContent = id ? 'Editar Compra' : 'Nova Compra no Cartão';
            html = `
                <form id="form-compra-cartao" onsubmit="window.app.handleFormSubmit(event, 'compra-cartao')">
                    <input type="hidden" name="id" value="${item.id || ''}">
                    <div class="form-group"><label>Descrição</label><input type="text" class="form-control" name="descricao" value="${item.descricao || ''}" required></div>
                    <div class="form-group"><label>Valor Total (R$)</label><input type="number" step="0.01" class="form-control" name="valor" value="${item.valor || ''}" required></div>
                    <div class="form-group"><label>Data da Compra</label><input type="date" class="form-control" name="data" value="${item.data || ''}" required></div>
                    <div class="form-group"><label>Parcelas (1 para à vista)</label><input type="number" min="1" max="48" class="form-control" name="parcelas" value="${item.parcelas || 1}" required></div>
                    <div class="form-actions"><button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">${id ? 'Atualizar' : 'Salvar'}</button></div>
                </form>`;
        } else if (type === 'fatura-fechada') {
            modalTitle.textContent = id ? 'Editar Dívida/Fatura' : 'Nova Fatura Histórica';
            html = `
                <form id="form-fatura-fechada" onsubmit="window.app.handleFormSubmit(event, 'fatura-fechada')">
                    <input type="hidden" name="id" value="${item.id || ''}">
                    <p style="font-size:0.8rem;color:var(--info);margin-bottom:1rem">Dívidas fixas prontas para bater no saldo na data que você disser.</p>
                    <div class="form-group"><label>Valor da Dívida (R$)</label><input type="number" step="0.01" class="form-control" name="valor" value="${item.valor || ''}" required></div>
                    <div class="form-group"><label>Data Exata de Vencimento</label><input type="date" class="form-control" name="vencimentoData" value="${item.vencimentoData || ''}" required></div>
                    <div class="form-actions"><button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">${id ? 'Atualizar' : 'Salvar'}</button></div>
                </form>`;
        } else if (type === 'investimento') {
            modalTitle.textContent = id ? 'Editar Investimento' : 'Novo Investimento';
            html = `
                <form id="form-investimento" onsubmit="window.app.handleFormSubmit(event, 'investimento')">
                    <input type="hidden" name="id" value="${item.id || ''}">
                    <div class="form-group"><label>Tipo (Ex: CDB, Ações...)</label><input type="text" class="form-control" name="tipo" value="${item.tipo || ''}" required></div>
                    <div class="form-group"><label>Valor (R$)</label><input type="number" step="0.01" class="form-control" name="valor" value="${item.valor || ''}" required></div>
                    <div class="form-group"><label>Data</label><input type="date" class="form-control" name="data" value="${item.data || ''}" required></div>
                    <div class="form-actions"><button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">${id ? 'Atualizar' : 'Salvar'}</button></div>
                </form>`;
        } else if (type === 'config-cartao') {
            modalTitle.textContent = 'Configuração do Cartão (Geral)';
            html = `
                <form id="form-config-cartao" onsubmit="window.app.handleFormSubmit(event, 'config-cartao')">
                    <p style="font-size:0.8rem;color:var(--info);margin-bottom:1rem">Regras base para o ciclo das compras novas informadas no sistema.</p>
                    <div class="form-group"><label>Dia Padrão de Vencimento das faturas</label><input type="number" min="1" max="31" class="form-control" name="diaDefault" value="${item.vencimento || 5}" required></div>
                    <div class="form-group"><label>Dia do Fechamento (Opcional - p/ faturas longas)</label><input type="number" min="1" max="31" class="form-control" name="fechamento" value="${item.diaFechamento || ''}"></div>
                    <div class="form-actions"><button type="button" class="btn btn-outline" onclick="window.app.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar Configuração</button></div>
                </form>`;
        }
        
        modalBody.innerHTML = html;
        document.getElementById('modal-container').classList.add('active');
        
        // Hide close button if onboarding
        const closeBtn = document.querySelector('.modal-header .close-btn');
        if (type === 'onboarding') closeBtn.style.display = 'none';
        else closeBtn.style.display = 'block';
    }

    closeModal() { document.getElementById('modal-container').classList.remove('active'); }

    handleFormSubmit(e, type) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const id = formData.get('id');
        let payload = { id };

        if (type === 'onboarding') {
            this.store.setConfig(parseNumber(formData.get('valor')), formData.get('dataInicial'));
        } else if (type === 'receita') {
            payload = { ...payload, descricao: formData.get('descricao'), valor: parseNumber(formData.get('valor')), data: formData.get('data'), status: formData.get('status') };
            this.store.saveItem('receita', payload);
        } else if (type === 'receita-fixa') {
            payload = { ...payload, descricao: formData.get('descricao'), valor: parseNumber(formData.get('valor')), dia: formData.get('dia'), dataInicio: formData.get('dataInicio'), dataFim: formData.get('dataFim') || null };
            this.store.saveItem('receita-fixa', payload);
        } else if (type === 'despesa-fixa') {
            payload = { ...payload, nome: formData.get('nome'), valor: parseNumber(formData.get('valor')), dia: formData.get('dia'), dataInicio: formData.get('dataInicio'), tipoPagamento: formData.get('tipoPagamento') || 'Débito' };
            this.store.saveItem('despesa-fixa', payload);
        } else if (type === 'despesa-variavel') {
            payload = { ...payload, categoria: formData.get('categoria'), valor: parseNumber(formData.get('valor')), data: formData.get('data'), tipoPagamento: formData.get('tipoPagamento') };
            this.store.saveItem('despesa-variavel', payload);
        } else if (type === 'compra-cartao') {
            const parcelas = parseInt(formData.get('parcelas'), 10) || 1;
            payload = { ...payload, descricao: formData.get('descricao'), valor: parseNumber(formData.get('valor')), data: formData.get('data'), parcelado: parcelas > 1, parcelas: parcelas };
            this.store.saveItem('compra-cartao', payload);
        } else if (type === 'fatura-fechada') {
            payload = { ...payload, valor: parseNumber(formData.get('valor')), vencimentoData: formData.get('vencimentoData') };
            this.store.saveItem('fatura-fechada', payload);
        } else if (type === 'investimento') {
            payload = { ...payload, tipo: formData.get('tipo'), valor: parseNumber(formData.get('valor')), data: formData.get('data') };
            this.store.saveItem('investimento', payload);
        } else if (type === 'config-cartao') {
            this.store.setFaturaFechamento(formData.get('fechamento'), formData.get('diaDefault'));
        }
        this.closeModal();
        this.render();
    }

    updatePlanejamento(e) {
        const monthKey = e.target.dataset.month;
        const val = Number(e.target.value) || 0;
        this.store.data.planejamento[monthKey] = val;
        this.store.saveData();
        this.render();
    }

    updatePlanejamentoDiario(e) {
        const dateKey = e.target.dataset.date;
        const val = Number(e.target.value) || 0;
        this.store.data.planejamentoDiario[dateKey] = val;
        this.store.saveData();
        this.render();
    }

    deleteItem(type, id) {
        if(confirm('Tem certeza que deseja excluir?')) { this.store.deleteItem(type, id); this.render(); }
    }

    render() {
        if (this.store.data.config.saldoInicial === null) return;
        
        const inlineSaldo = document.getElementById('inline-saldo-base');
        if (inlineSaldo && document.activeElement !== inlineSaldo) {
            inlineSaldo.value = parseFloat(this.store.data.config.saldoInicial) || 0;
        }

        // --- 1. DASHBOARD OVERVIEW --- 
        const sDisponivel = this.store.getSaldoDisponivel(this.referenceDate);
        document.getElementById('label-saldo-disponivel').textContent = `Saldo Disponível em ${formatDate(this.referenceDate.toISOString().split('T')[0])}`;
        document.getElementById('saldo-disponivel').textContent = formatCurrency(sDisponivel);
        
        document.getElementById('saldo-projetado').textContent = formatCurrency(this.store.getSaldoProjetado(this.referenceDate, this.projectedDate));
        
        const comprometidoData = this.store.getSaldoComprometido(this.referenceDate);
        document.getElementById('saldo-comprometido').textContent = formatCurrency(comprometidoData.comprometido);
        document.getElementById('total-dividas-abs').textContent = formatCurrency(comprometidoData.totalDividas);
        document.getElementById('total-dinheiro-abs').textContent = formatCurrency(comprometidoData.dinheiroLivre);
        
        
        // Limite diario
        const vencimento = parseInt(this.store.data.cartao.vencimento, 10) || 5; 
        let nextFaturaDate = new Date(this.referenceDate.getFullYear(), this.referenceDate.getMonth(), vencimento);
        if (nextFaturaDate <= this.referenceDate) {
            nextFaturaDate.setMonth(nextFaturaDate.getMonth() + 1);
        }
        
        let nextFaturaValor = this.store.getFaturaBaseForMonth(new Date(nextFaturaDate.getFullYear(), nextFaturaDate.getMonth(), 1));
        this.store.data.cartao.faturasFechadas.forEach(f => {
            const vData = parseLocalDate(f.vencimentoData);
            if (vData.getFullYear() === nextFaturaDate.getFullYear() && vData.getMonth() === nextFaturaDate.getMonth()) {
                nextFaturaValor += f.valor;
            }
        });
        
        const diffDaysFatura = Math.ceil((nextFaturaDate - this.referenceDate) / (1000 * 60 * 60 * 24));
        const daysToNextInvoice = diffDaysFatura > 0 ? diffDaysFatura : 1;
        
        const limEl = document.getElementById('limite-diario');
        const limResumoEl = document.getElementById('limite-diario-ate-fatura');
        const limMesEl = document.getElementById('limite-diario-mes');
        const limitHint = document.getElementById('limite-diario-hint');

        const limiteDiarioMes = sDisponivel > 0 ? sDisponivel / getDaysLeftInMonth(this.referenceDate) : 0;
        if (limMesEl) limMesEl.textContent = formatCurrency(limiteDiarioMes);

        if (sDisponivel <= 0) {
            limEl.textContent = "R$ 0,00";
            if (limResumoEl) limResumoEl.textContent = "R$ 0,00";
            limEl.style.color = "var(--danger)";
            if (limitHint) limitHint.innerHTML = `<span style="color:var(--danger); font-weight:bold;">⚠️ Saldo atual está negativo ou zerado.</span> Margem indisponível para gastos diários.`;
        } else if (sDisponivel >= nextFaturaValor) {
            const limiteDiario = (sDisponivel - nextFaturaValor) / daysToNextInvoice;
            limEl.textContent = formatCurrency(limiteDiario);
            if (limResumoEl) limResumoEl.textContent = formatCurrency(limiteDiario);
            limEl.style.color = "inherit";
            if (limitHint) limitHint.innerHTML = `A reserva para a próxima fatura (${formatDate(nextFaturaDate.toISOString().split('T')[0])}) de <strong>${formatCurrency(nextFaturaValor)}</strong> está protegida neste cálculo para os próximos ${daysToNextInvoice} dia(s).`;
        } else {
            limEl.textContent = "⚠️ R$ 0,00";
            if (limResumoEl) limResumoEl.textContent = "R$ 0,00";
            limEl.style.color = "var(--warning)";
            if (limitHint) limitHint.innerHTML = `<span style="color:var(--warning); font-weight:bold;">⚠️ Saldo atual de ${formatCurrency(sDisponivel)} é insuficiente para cobrir a próxima fatura de ${formatCurrency(nextFaturaValor)}.</span> O limite foi zerado como alerta!`;
        }
        
        // Cores Dinâmicas
        const sDispEl = document.getElementById('saldo-disponivel').parentElement;
        if (sDisponivel < 0) sDispEl.className = 'metric-card glass-panel danger-card';
        else if (sDisponivel < 200) sDispEl.className = 'metric-card glass-panel info-card';
        else sDispEl.className = 'metric-card glass-panel primary-card';
        
        const compEl = document.getElementById('saldo-comprometido').parentElement;
        if (comprometidoData.comprometido > 0) compEl.className = 'metric-card glass-panel danger-card';
        else compEl.className = 'metric-card glass-panel primary-card';
        
        // Cartão (Dashboard View)
        const currentMonth = this.referenceDate.getMonth();
        const currentYear = this.referenceDate.getFullYear();
        const currentMonthDate = new Date(currentYear, currentMonth, 1);
        
        let faturaAtualValor = this.store.getFaturaBaseForMonth(currentMonthDate);
        this.store.data.cartao.faturasFechadas.forEach(f => {
            const vData = parseLocalDate(f.vencimentoData);
            if (vData.getFullYear() === currentYear && vData.getMonth() === currentMonth) {
                faturaAtualValor += f.valor;
            }
        });
        
        const faturaEl = document.getElementById('fatura-atual');
        faturaEl.textContent = formatCurrency(faturaAtualValor);
        
        // Filtros Mês Específico pro Dashboard 
        const fechamento = this.store.data.cartao.diaFechamento;
        
        const faturasHistoricasEsteMes = this.store.data.cartao.faturasFechadas.filter(f => {
             const dp = parseLocalDate(f.vencimentoData);
             return dp.getMonth() === currentMonth && dp.getFullYear() === currentYear;
        }).map(f => `
            <li class="list-item"><div class="item-info"><h4>Fatura Histórica / Débito Prévio</h4><p>${formatDate(f.vencimentoData)}</p></div><div class="item-amount text-danger">${formatCurrency(f.valor)}</div></li>
        `);
        
        const comprasEsteMes = [];
        this.store.data.cartao.compras.forEach(c => {
            const baseInvoiceStart = getFaturaMonth(c.data, fechamento);
            const diffMonths = (currentYear - baseInvoiceStart.getFullYear()) * 12 + 
                               (currentMonth - baseInvoiceStart.getMonth());
            if (c.parcelado) {
                if (diffMonths >= 0 && diffMonths < c.parcelas) {
                     comprasEsteMes.push(`
                        <li class="list-item"><div class="item-info"><h4>${c.descricao} (${diffMonths + 1}/${c.parcelas})</h4><p>Adquirido em: ${formatDate(c.data)}</p></div><div class="item-amount text-danger">${formatCurrency(c.valor/c.parcelas)}</div></li>
                     `);
                }
            } else {
                if (diffMonths === 0) {
                     comprasEsteMes.push(`
                        <li class="list-item"><div class="item-info"><h4>${c.descricao}</h4><p>Adquirido em: ${formatDate(c.data)}</p></div><div class="item-amount text-danger">${formatCurrency(c.valor)}</div></li>
                     `);
                }
            }
        });
        
        document.getElementById('lista-fatura-atual').innerHTML = [...faturasHistoricasEsteMes, ...comprasEsteMes].slice(0, 7).join('') || '<p class="text-muted" style="font-size:0.85rem">Nenhuma compra faturada no mês selecionado.</p>';
        
        document.getElementById('lista-receitas').innerHTML = this.store.data.receitas.filter(r => {
             const dp = new Date(r.data + 'T00:00:00'); 
             return dp.getMonth() === currentMonth && dp.getFullYear() === currentYear;
        }).slice(0, 5).map(r => {
            const displayStatus = isPastOrToday(r.data, this.referenceDate) ? 'Recebido' : r.status;
            return `
            <li class="list-item"><div class="item-info"><h4>${r.descricao} - <em style="${displayStatus==='Recebido'?'color:var(--success)':'color:var(--warning)'}">${displayStatus}</em></h4><p>${formatDate(r.data)}</p></div><div class="item-amount text-success">+${formatCurrency(r.valor)}</div></li>
            `;
        }).join('') || '<p class="text-muted" style="font-size:0.85rem">Nenhuma receita no mês selecionado.</p>';
        
        document.getElementById('lista-investimentos-dashboard').innerHTML = this.store.data.investimentos.filter(i => {
             const dp = parseLocalDate(i.data); 
             return dp.getMonth() === currentMonth && dp.getFullYear() === currentYear;
        }).slice(0, 5).map(i => `
            <li class="list-item"><div class="item-info"><h4>${i.tipo}</h4><p>${formatDate(i.data)}</p></div><div class="item-amount text-success">${formatCurrency(i.valor)}</div></li>
        `).join('') || '<p class="text-muted" style="font-size:0.85rem">Nenhum investimento no mês selecionado.</p>';
        
        const badgeFatura = document.getElementById('badge-fatura-inicial');
        // Badge will be handled individually or dropped, we will just manage history

        // --- 2. SUB-PAGES RENDER ---
        const btnStyles = "background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem; margin-left:8px; transition:color 0.2s;";
        
        document.getElementById('page-lista-receitas').innerHTML = this.store.data.receitas.map(r => {
            const displayStatus = isPastOrToday(r.data, this.referenceDate) ? 'Recebido' : r.status;
            return `
            <li class="list-item">
                <div class="item-info"><h4>${r.descricao} - <em style="${displayStatus==='Recebido'?'color:var(--success)':'color:var(--warning)'}">${displayStatus}</em></h4><p>${formatDate(r.data)}</p></div>
                <div style="display:flex; align-items:center;">
                    <div class="item-amount text-success">+${formatCurrency(r.valor)}</div>
                    <button style="${btnStyles}" onclick="window.app.openModal('receita', '${r.id}')" title="Editar">✏️</button>
                    <button style="${btnStyles}" onclick="window.app.deleteItem('receita', '${r.id}')" title="Excluir">❌</button>
                </div>
            </li>
        `;
        }).join('') || '<p class="text-muted" style="margin-top:1rem">Nenhuma receita cadastrada.</p>';

        document.getElementById('page-lista-receitas-fixas').innerHTML = this.store.data.receitasFixas.map(r => `
            <li class="list-item">
                <div class="item-info"><h4>${r.descricao} <span style="font-size:10px;background:var(--success);padding:2px 6px;border-radius:10px;color:white;margin-left:5px">TODO DIA ${r.dia}</span></h4>
                <p>Data Inicial: ${formatDate(r.dataInicio)} ${r.dataFim ? ` | Fim: ${formatDate(r.dataFim)}` : ''}</p></div>
                <div style="display:flex; align-items:center;">
                    <div class="item-amount text-success">+${formatCurrency(r.valor)}</div>
                    <button style="${btnStyles}" onclick="window.app.openModal('receita-fixa', '${r.id}')" title="Editar">✏️</button>
                    <button style="${btnStyles}" onclick="window.app.deleteItem('receita-fixa', '${r.id}')" title="Excluir">❌</button>
                </div>
            </li>
        `).join('') || '<p class="text-muted" style="margin-top:1rem">Nenhuma receita fixa cadastrada.</p>';
        
        document.getElementById('page-lista-despesas-fixas').innerHTML = this.store.data.despesasFixas.map(d => `
            <li class="list-item">
                <div class="item-info"><h4>${d.nome} <span style="font-size:10px;background:var(--primary);padding:2px 6px;border-radius:10px;color:white;margin-left:5px">TODO DIA ${d.dia}</span></h4>
                <p>Pagamento: ${d.tipoPagamento} | Data Inicial: ${formatDate(d.dataInicio)}</p></div>
                <div style="display:flex; align-items:center;">
                    <div class="item-amount text-danger">-${formatCurrency(d.valor)}</div>
                    <button style="${btnStyles}" onclick="window.app.openModal('despesa-fixa', '${d.id}')" title="Editar">✏️</button>
                    <button style="${btnStyles}" onclick="window.app.deleteItem('despesa-fixa', '${d.id}')" title="Excluir">❌</button>
                </div>
            </li>
        `).join('') || '<p class="text-muted" style="margin-top:1rem">Nenhuma despesa fixa cadastrada.</p>';

        const groupedVariaveis = {};
        this.store.data.despesasVariaveis.forEach(d => {
            if(!groupedVariaveis[d.data]) groupedVariaveis[d.data] = [];
            groupedVariaveis[d.data].push(d);
        });
        const sortedDates = Object.keys(groupedVariaveis).sort((a,b) => parseLocalDate(b) - parseLocalDate(a));
        document.getElementById('page-lista-despesas-variaveis').innerHTML = sortedDates.map(date => {
            let html = `<li class="list-item" style="background: rgba(255,255,255,0.05); padding: 5px 15px; margin-top: 10px; border-radius: 8px;"><strong>📅 ${formatDate(date)}</strong></li>`;
            groupedVariaveis[date].forEach(d => {
                html += `
                <li class="list-item" style="border-top:none; margin-top:0;">
                    <div class="item-info"><h4>${d.categoria}</h4></div>
                    <div style="display:flex; align-items:center;">
                        <div class="item-amount text-danger">-${formatCurrency(d.valor)}</div>
                        <button style="${btnStyles}" onclick="window.app.openModal('despesa-variavel', '${d.id}')" title="Editar">✏️</button>
                        <button style="${btnStyles}" onclick="window.app.deleteItem('despesa-variavel', '${d.id}')" title="Excluir">❌</button>
                    </div>
                </li>`;
            });
            return html;
        }).join('') || '<p class="text-muted" style="margin-top:1rem">Nenhuma despesa variável cadastrada.</p>';

        document.getElementById('page-lista-cartao').innerHTML = comprasEsteMes.join('') || '<p class="text-muted" style="margin-top:1rem">Nenhuma compra no cartão faturada no mês selecionado.</p>';

        const ulHist = document.getElementById('page-lista-faturas-fechadas');
        if(ulHist) {
            ulHist.innerHTML = this.store.data.cartao.faturasFechadas.map(f => `
                <li class="list-item">
                    <div class="item-info"><h4>Fatura Histórica / Débito Prévio</h4><p>Vence/Venceu: ${formatDate(f.vencimentoData)}</p></div>
                    <div style="display:flex; align-items:center;">
                        <div class="item-amount text-danger">${formatCurrency(f.valor)}</div>
                        <button style="${btnStyles}" onclick="window.app.openModal('fatura-fechada', '${f.id}')" title="Editar">✏️</button>
                        <button style="${btnStyles}" onclick="window.app.deleteItem('fatura-fechada', '${f.id}')" title="Excluir">❌</button>
                    </div>
                </li>
            `).join('') || '<p class="text-muted" style="margin-top:0.5rem">Nenhuma fatura histórica lançada.</p>';
        }

        document.getElementById('page-total-investido').textContent = formatCurrency(this.store.data.investimentos.reduce((a, b) => a + b.valor, 0));
        document.getElementById('page-lista-investimentos').innerHTML = [...this.store.data.investimentos]
            .sort((a,b) => parseLocalDate(b.data) - parseLocalDate(a.data))
            .map(i => `
            <li class="list-item">
                <div class="item-info"><h4>${i.tipo}</h4><p>${formatDate(i.data)}</p></div>
                <div style="display:flex; align-items:center;">
                    <div class="item-amount text-success">${formatCurrency(i.valor)}</div>
                    <button style="${btnStyles}" onclick="window.app.openModal('investimento', '${i.id}')" title="Editar">✏️</button>
                    <button style="${btnStyles}" onclick="window.app.deleteItem('investimento', '${i.id}')" title="Excluir">❌</button>
                </div>
            </li>
        `).join('') || '<p class="text-muted" style="margin-top:1rem">Nenhum investimento cadastrado.</p>';

        const planHeader = document.getElementById('planejamento-header');
        const planBody = document.getElementById('planejamento-body');
        if (planHeader && planBody && this.store.data.config.dataInicial) {
            let colsHtml = `<th>Período</th>`;
            const months = [];
            const baseDate = new Date();
            baseDate.setDate(1); 
            
            for(let i=0; i<6; i++) {
                const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
                const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2, '0')}`;
                months.push({ date: targetDate, key: monthStr });
                const monthName = targetDate.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
                colsHtml += `<th>${monthName.toUpperCase()}</th>`;
            }
            planHeader.innerHTML = colsHtml;

            const rowSInicial = [`<td>Saldo Inicial do Mês</td>`];
            const rowReceitas = [`<td>Receitas (+)</td>`];
            const rowDebitoReal = [`<td>Gastos no Débito (Real) (-)</td>`];
            const rowDebitoPlan = [`<td>Gastos no Débito (Plan.) (-)</td>`];
            const rowInvest = [`<td>Investimentos (-)</td>`];
            const rowFixas = [`<td>Despesas Fixas (Débito) (-)</td>`];
            const rowFixasCredito = [`<td style="color:var(--text-muted); font-size:0.85em;">+ Desp. Fixas (Crédito) (Info)</td>`];
            const rowFaturas = [`<td>Fatura do Cartão (-)</td>`];
            const rowCreditoAcum = [`<td style="color:var(--text-muted); font-size:0.85em;">+ Novas Compras Crédito (Info)</td>`];
            const rowSFinal = [`<td><strong>Saldo Final do Mês</strong></td>`];

            const endOfPrevMonth = new Date(months[0].date.getFullYear(), months[0].date.getMonth(), 0);
            let runningBalance = this.store.getSaldoDisponivel(endOfPrevMonth);

            for(let m of months) {
                const y = m.date.getFullYear();
                const mo = m.date.getMonth();
                const startM = new Date(y, mo, 1);
                const endM = new Date(y, mo + 1, 0);
                const strStart = startM.toISOString().split('T')[0];
                const strEnd = endM.toISOString().split('T')[0];
                const endPrevMStr = new Date(y, mo, 0).toISOString().split('T')[0];

                let rec = 0;
                this.store.data.receitas.forEach(r => {
                     const dp = parseLocalDate(r.data);
                     if (dp >= startM && dp <= endM) rec += r.valor;
                });
                let recFixasInMonth = 0;
                this.store.data.receitasFixas.forEach(r => {
                     const a = countOccurrences(r.dia, r.dataInicio, strEnd, r.dataFim);
                     const b = countOccurrences(r.dia, r.dataInicio, endPrevMStr, r.dataFim);
                     recFixasInMonth += (a - b) * r.valor;
                });
                rec += recFixasInMonth;

                let debReal = 0;
                this.store.data.despesasVariaveis.forEach(d => {
                     const dp = parseLocalDate(d.data);
                     if (dp >= startM && dp <= endM && d.tipoPagamento==='Débito') debReal += d.valor;
                });

                let planejado = this.store.data.planejamento[m.key] || 0;

                let inv = 0;
                this.store.data.investimentos.forEach(i => {
                     const dp = parseLocalDate(i.data);
                     if (dp >= startM && dp <= endM) inv += i.valor;
                });

                let fixasDebito = 0;
                let fixasCredito = 0;
                this.store.data.despesasFixas.forEach(d => {
                     const a = countOccurrences(d.dia, d.dataInicio, strEnd, null);
                     const b = countOccurrences(d.dia, d.dataInicio, endPrevMStr, null);
                     const occurrences = a - b;
                     if (occurrences > 0) {
                         if (d.tipoPagamento !== 'Crédito') fixasDebito += occurrences * d.valor;
                         else fixasCredito += occurrences * d.valor;
                     }
                });

                let faturasInMonth = this.store.getInvoicesPaidInDateRange(strStart, strEnd);

                let creditoAcumulado = 0;
                this.store.data.cartao.compras.forEach(c => {
                    const dp = parseLocalDate(c.data);
                    if (dp >= startM && dp <= endM) creditoAcumulado += c.valor;
                });

                rowSInicial.push(`<td>${formatCurrency(runningBalance)}</td>`);
                rowReceitas.push(`<td class="text-success">+${formatCurrency(rec)}</td>`);
                rowDebitoReal.push(`<td class="text-danger">-${formatCurrency(debReal)}</td>`);
                
                rowDebitoPlan.push(`<td><input type="number" step="1" class="plan-input text-danger" data-month="${m.key}" value="${planejado}" onchange="window.app.updatePlanejamento(event)"></td>`);
                
                rowInvest.push(`<td class="text-info">-${formatCurrency(inv)}</td>`);
                rowFixas.push(`<td class="text-danger">-${formatCurrency(fixasDebito)}</td>`);
                rowFixasCredito.push(`<td style="color:var(--text-muted); font-size:0.85em;">(${formatCurrency(fixasCredito)})</td>`);
                rowFaturas.push(`<td class="text-danger">-${formatCurrency(faturasInMonth)}</td>`);
                rowCreditoAcum.push(`<td style="color:var(--text-muted); font-size:0.85em;">(${formatCurrency(creditoAcumulado)})</td>`);

                runningBalance = runningBalance + rec - debReal - planejado - inv - fixasDebito - faturasInMonth;

                const sfClass = runningBalance < 0 ? 'text-danger' : (runningBalance < 200 ? 'text-warning' : 'text-success');
                rowSFinal.push(`<td class="${sfClass}"><strong>${formatCurrency(runningBalance)}</strong></td>`);
            }

            planBody.innerHTML = `
                <tr>${rowSInicial.join('')}</tr>
                <tr>${rowReceitas.join('')}</tr>
                <tr>${rowDebitoReal.join('')}</tr>
                <tr>${rowDebitoPlan.join('')}</tr>
                <tr>${rowInvest.join('')}</tr>
                <tr>${rowFixas.join('')}</tr>
                <tr style="background:rgba(255,255,255,0.02)">${rowFixasCredito.join('')}</tr>
                <tr>${rowFaturas.join('')}</tr>
                <tr style="background:rgba(255,255,255,0.02)">${rowCreditoAcum.join('')}</tr>
                <tr style="border-top:2px solid var(--glass-border)">${rowSFinal.join('')}</tr>
            `;
        }

        const plandHeader = document.getElementById('pland-header');
        const plandBody = document.getElementById('pland-body');
        if (plandHeader && plandBody && this.store.data.config.dataInicial) {
            let colsHtml = `<th>Dia</th>`;
            const days = [];
            
            const startOfMonth = new Date(this.referenceDate.getFullYear(), this.referenceDate.getMonth(), 1);
            
            for(let i=0; i<90; i++) {
                const targetDate = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), startOfMonth.getDate() + i);
                const dateStr = targetDate.toISOString().split('T')[0];
                days.push({ date: targetDate, key: dateStr });
                const dayName = targetDate.toLocaleString('pt-BR', { day: '2-digit', month: 'short' });
                const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
                const isRef = dateStr === this.referenceDate.toISOString().split('T')[0];
                colsHtml += `<th id="col-${dateStr}" ${isWeekend ? 'style="color:var(--warning)"' : (isRef ? 'style="color:var(--primary); font-weight:800; background:var(--glass-border); padding:5px; border-radius:5px;"' : '')}>${dayName}</th>`;
            }
            plandHeader.innerHTML = colsHtml;

            const rowSInicial = [`<td>Saldo Inicial</td>`];
            const rowReceitas = [`<td>Receitas (+)</td>`];
            const rowDebitoReal = [`<td>Gastos no Débito (Real) (-)</td>`];
            const rowDebitoPlan = [`<td>Gastos no Débito (Plan.) (-)</td>`];
            const rowInvest = [`<td>Investimentos (-)</td>`];
            const rowFixas = [`<td>Despesas Fixas (Débito) (-)</td>`];
            const rowFixasCredito = [`<td style="color:var(--text-muted); font-size:0.85em;">+ Desp. Fixas (Crédito) (Info)</td>`];
            const rowCreditoAcum = [`<td style="color:var(--text-muted); font-size:0.85em;">+ Novas Compras Crédito (Info)</td>`];
            const rowFaturas = [`<td>Fatura do Cartão (-)</td>`];
            const rowSFinal = [`<td><strong>Saldo Final do Dia</strong></td>`];

            const endOfPrevDay = new Date(days[0].date.getFullYear(), days[0].date.getMonth(), days[0].date.getDate() - 1);
            let runningBalance = this.store.getSaldoDisponivel(endOfPrevDay);

            for(let d of days) {
                const strDate = d.key;
                const localD = d.date;

                let rec = 0;
                this.store.data.receitas.forEach(r => {
                     if (r.data === strDate) rec += r.valor;
                });
                let recFixasInDay = 0;
                this.store.data.receitasFixas.forEach(r => {
                     const a = countOccurrences(r.dia, r.dataInicio, strDate, r.dataFim);
                     const dPrev = new Date(localD); dPrev.setDate(dPrev.getDate()-1);
                     const b = countOccurrences(r.dia, r.dataInicio, dPrev.toISOString().split('T')[0], r.dataFim);
                     recFixasInDay += (a - b) * r.valor;
                });
                rec += recFixasInDay;

                let debReal = 0;
                this.store.data.despesasVariaveis.forEach(dv => {
                     if (dv.data === strDate && dv.tipoPagamento==='Débito') debReal += dv.valor;
                });

                let planejado = this.store.data.planejamentoDiario[d.key] || 0;

                let inv = 0;
                this.store.data.investimentos.forEach(i => {
                     if (i.data === strDate) inv += i.valor;
                });

                let fixasDebito = 0;
                let fixasCredito = 0;
                this.store.data.despesasFixas.forEach(df => {
                     const a = countOccurrences(df.dia, df.dataInicio, strDate, null);
                     const dPrev = new Date(localD); dPrev.setDate(dPrev.getDate()-1);
                     const b = countOccurrences(df.dia, df.dataInicio, dPrev.toISOString().split('T')[0], null);
                     const occurrences = a - b;
                     if (occurrences > 0) {
                         if (df.tipoPagamento !== 'Crédito') fixasDebito += occurrences * df.valor;
                         else fixasCredito += occurrences * df.valor;
                     }
                });

                let faturasInDay = this.store.getInvoicesPaidInDateRange(strDate, strDate);

                let creditoAcumulado = 0;
                this.store.data.cartao.compras.forEach(c => {
                    if (c.data === strDate) creditoAcumulado += c.valor;
                });

                rowSInicial.push(`<td>${formatCurrency(runningBalance)}</td>`);
                rowReceitas.push(`<td class="text-success">${rec > 0 ? '+'+formatCurrency(rec) : '-'}</td>`);
                rowDebitoReal.push(`<td class="text-danger">${debReal > 0 ? '-'+formatCurrency(debReal) : '-'}</td>`);
                
                rowDebitoPlan.push(`<td><input type="number" step="1" class="plan-input text-danger" data-date="${d.key}" value="${planejado}" onchange="window.app.updatePlanejamentoDiario(event)" style="width:70px;"></td>`);
                
                rowInvest.push(`<td class="text-info">${inv > 0 ? '-'+formatCurrency(inv) : '-'}</td>`);
                rowFixas.push(`<td class="text-danger">${fixasDebito > 0 ? '-'+formatCurrency(fixasDebito) : '-'}</td>`);
                rowFixasCredito.push(`<td style="color:var(--text-muted); font-size:0.85em;">${fixasCredito > 0 ? '('+formatCurrency(fixasCredito)+')' : '-'}</td>`);
                rowCreditoAcum.push(`<td style="color:var(--text-muted); font-size:0.85em;">${creditoAcumulado > 0 ? '('+formatCurrency(creditoAcumulado)+')' : '-'}</td>`);
                rowFaturas.push(`<td class="text-danger">${faturasInDay > 0 ? '-'+formatCurrency(faturasInDay) : '-'}</td>`);

                runningBalance = runningBalance + rec - debReal - planejado - inv - fixasDebito - faturasInDay;

                const sfClass = runningBalance < 0 ? 'text-danger' : (runningBalance < 200 ? 'text-warning' : 'text-success');
                rowSFinal.push(`<td class="${sfClass}"><strong>${formatCurrency(runningBalance)}</strong></td>`);
            }

            plandBody.innerHTML = `
                <tr>${rowSInicial.join('')}</tr>
                <tr>${rowReceitas.join('')}</tr>
                <tr>${rowDebitoReal.join('')}</tr>
                <tr>${rowDebitoPlan.join('')}</tr>
                <tr>${rowInvest.join('')}</tr>
                <tr>${rowFixas.join('')}</tr>
                <tr style="background:rgba(255,255,255,0.02)">${rowFixasCredito.join('')}</tr>
                <tr style="background:rgba(255,255,255,0.02)">${rowCreditoAcum.join('')}</tr>
                <tr>${rowFaturas.join('')}</tr>
                <tr style="border-top:2px solid var(--glass-border)">${rowSFinal.join('')}</tr>
            `;

            setTimeout(() => {
                const activeCol = document.getElementById('col-' + this.referenceDate.toISOString().split('T')[0]);
                if (activeCol && activeCol.scrollIntoView) {
                    activeCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }, 100);
        }
    }
}
document.addEventListener('DOMContentLoaded', () => { new App(); });
